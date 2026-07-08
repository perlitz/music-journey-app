import { login, handleRedirect, getAccessToken, isLoggedIn } from './auth.js';
import {
  getDevices,
  transferPlayback,
  playUri,
  pausePlayback,
  resumePlayback,
  setVolume,
  getPlaybackState,
} from './spotify.js';
import { playAudio, cancelAudio, pauseAudio, resumeAudio } from './tts.js';

// Load every journey at build time; the app just plays baked data.
const modules = import.meta.glob('./journeys/*.json', { eager: true });
const journeys = Object.entries(modules)
  .map(([path, mod]) => ({
    slug: path.split('/').pop().replace('.json', ''),
    data: mod.default,
  }))
  .sort((a, b) => a.slug.localeCompare(b.slug));

let journey = journeys[0]?.data;

// Prefix baked absolute audio paths (/audio/...) with the Vite base so they
// resolve correctly under a GitHub Pages subpath as well as at localhost root.
const asset = (p) => import.meta.env.BASE_URL + String(p).replace(/^\//, '');

const el = (id) => document.getElementById(id);
const statusEl = el('status');
const loginBtn = el('login');
const advanceBtn = el('advance');
const pauseBtn = el('pause');
const journeyPicker = el('journeyPicker');
const devicePicker = el('devicePicker');
const refreshBtn = el('refreshDevices');
const journeyEl = el('journey');

let deviceId = null; // the Spotify Connect device we drive
const segNodes = [];

// ----- Rendering ---------------------------------------------------------
function render() {
  el('title').textContent = journey.title;
  el('subtitle').textContent = journey.subject;
  journeyEl.innerHTML = '';
  segNodes.length = 0;

  journey.segments.forEach((seg) => {
    if (seg.type === 'narration') {
      const p = document.createElement('p');
      p.className = 'narration';
      p.textContent = seg.text;
      journeyEl.appendChild(p);
      segNodes.push({ node: p });
      return;
    }
    const card = document.createElement('div');
    card.className = 'song';
    const match = seg.spotifyUri
      ? `<div class="match ok">✓ ${seg.spotifyName} — ${seg.spotifyArtists}</div>`
      : `<div class="match bad">⚠ not resolved</div>`;
    card.innerHTML = `
      <h3>${seg.title} — ${seg.artist}</h3>
      <div class="listen-for">Listen for: ${seg.listenFor || ''}</div>
      ${match}`;
    journeyEl.appendChild(card);
    segNodes.push({ node: card });
  });
}

function setCurrent(i) {
  segNodes.forEach((s, k) => s.node.classList.toggle('current', k === i));
  segNodes[i]?.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ----- Overlay -----------------------------------------------------------
const overlay = el('overlay');
const overlaySong = overlay.querySelector('.overlay-song');
const overlayText = overlay.querySelector('.overlay-text');
let overlayTimer = null;

function showOverlay(seg) {
  overlaySong.textContent = `${seg.title} — ${seg.artist}`;
  overlayText.textContent = seg.listenFor || '';
  overlay.classList.add('show');
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(hideOverlay, 20000);
}
function hideOverlay() {
  clearTimeout(overlayTimer);
  overlay.classList.remove('show');
}

// ----- Radio-style talk-over (volume via Connect) ------------------------
const SONG_VOLUME = 85; // percent
const DUCK_VOLUME = 40;
const INTRO_HOLD_MS = 3000;
const POLL_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Helper to smoothly fade out Spotify volume before pausing
async function fadeOutSpotify(deviceId, durationMs = 2000) {
  const steps = 8;
  const stepMs = durationMs / steps;
  const volumeStep = SONG_VOLUME / steps;
  let currentVolume = SONG_VOLUME;

  for (let i = 0; i < steps; i++) {
    currentVolume = Math.max(0, currentVolume - volumeStep);
    await setVolume(deviceId, currentVolume).catch(() => {});
    await sleep(stepMs);
  }
}

async function duckAndPlay(url, myStep) {
  if (deviceId) await setVolume(deviceId, DUCK_VOLUME).catch(() => {});
  try {
    await playAudio(url);
  } catch (e) {
    console.error('cue audio failed:', e);
  } finally {
    if (myStep === step && deviceId) {
      await setVolume(deviceId, SONG_VOLUME).catch(() => {});
      
      // On mobile (iOS/Android), the OS pauses Spotify when the browser plays audio.
      // Resume Spotify playback automatically only on mobile devices.
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        await resumePlayback(deviceId).catch(() => {});
      }
    }
  }
}

// ----- Sequencer ---------------------------------------------------------
let index = -1;
let step = 0; // async callbacks compare against this to detect a Skip
let paused = false;

// Poll Spotify until the current song ends, then advance. Guarded by `step`.
function pollSongEnd(uri, myStep) {
  let sawPlaying = false;
  let lastProgress = 0;
  let lastDuration = 0;
  let consecutiveInactive = 0;

  const tick = async () => {
    if (myStep !== step) return;
    let st = null;
    let success = false;
    try {
      st = await getPlaybackState();
      success = true;
    } catch (e) {
      console.warn('Failed to get Spotify playback state:', e);
    }
    
    if (myStep !== step) return;

    if (success) {
      if (st) {
        consecutiveInactive = 0;
        if (st.uri === uri) {
          if (st.isPlaying) {
            sawPlaying = true;
          }
          lastProgress = st.progressMs;
          lastDuration = st.durationMs;
        } else {
          // The URI changed. If we saw it playing, or if it changed to another track, it's ended.
          if (sawPlaying) {
            advance(false);
            return;
          }
        }

        // If it's not playing anymore, but it's still the same track
        if (!st.isPlaying && st.uri === uri) {
          // If it's paused/stopped near the end
          const nearEnd = lastDuration > 0 && lastProgress >= lastDuration - 4000;
          if (nearEnd) {
            advance(false);
            return;
          }
        }
      } else {
        // st is null (204 No Content - no active playback/device)
        // If we saw it playing and it was near the end, we can assume it finished.
        if (sawPlaying) {
          const nearEnd = lastDuration > 0 && lastProgress >= lastDuration - 10000;
          if (nearEnd) {
            advance(false);
            return;
          }
          consecutiveInactive++;
          if (consecutiveInactive >= 3 && lastDuration > 0 && lastProgress >= lastDuration - 15000) {
            advance(false);
            return;
          }
        }
      }
    }

    setTimeout(tick, POLL_MS);
  };
  
  setTimeout(tick, POLL_MS);
}

async function advance(fade = false) {
  const myStep = ++step;

  cancelAudio();
  hideOverlay();

  // Fade out Spotify if requested and we are currently playing a song
  const currentSeg = journey.segments[index];
  if (fade && currentSeg?.type === 'song' && deviceId && !paused) {
    statusEl.textContent = '🎵 Fading out…';
    await fadeOutSpotify(deviceId, 2000);
    if (myStep !== step) return;
  }
  
  if (deviceId) await pausePlayback(deviceId).catch(() => {});
  if (deviceId) await setVolume(deviceId, SONG_VOLUME).catch(() => {});
  paused = false;

  index++;
  if (index >= journey.segments.length) return finish();

  setCurrent(index);
  const seg = journey.segments[index];
  advanceBtn.textContent = 'Skip ▶';

  if (seg.type === 'narration') {
    pauseBtn.hidden = false;
    pauseBtn.textContent = '⏸ Pause';
    statusEl.textContent = '🗣 Narrating…';
    try {
      await playAudio(asset(seg.audio));
      if (myStep === step) advance(false); // natural narration end, no fade
    } catch (e) {
      statusEl.textContent = '❌ Narration audio failed — ' + e.message;
      console.error(e);
    }
    return;
  }

  // Song.
  if (!seg.spotifyUri) {
    statusEl.textContent = `“${seg.title}” has no Spotify link — Skip.`;
    pauseBtn.hidden = true;
    return;
  }
  if (!deviceId) {
    statusEl.textContent = 'Pick a Spotify device first.';
    return;
  }
  try {
    await playUri(deviceId, seg.spotifyUri);
    pauseBtn.hidden = false;
    pauseBtn.textContent = '⏸ Pause';
    statusEl.textContent = `▶ ${seg.title} — ${seg.artist}`;
    pollSongEnd(seg.spotifyUri, myStep);

    if (seg.cueAudio) {
      await setVolume(deviceId, SONG_VOLUME).catch(() => {});
      await sleep(INTRO_HOLD_MS);
      if (myStep !== step) return;
      showOverlay(seg);
      await duckAndPlay(asset(seg.cueAudio), myStep);
      if (myStep === step) hideOverlay();
    }
  } catch (e) {
    statusEl.textContent = 'Play failed: ' + e.message + ' (is the device awake?)';
  }
}

function finish() {
  setCurrent(-1);
  pauseBtn.hidden = true;
  if (deviceId) setVolume(deviceId, SONG_VOLUME).catch(() => {});
  advanceBtn.textContent = 'Restart journey';
  statusEl.textContent = 'Journey complete. 🎧';
}

async function togglePause() {
  const seg = journey.segments[index];
  paused = !paused;
  if (seg?.type === 'narration') {
    paused ? pauseAudio() : resumeAudio();
  } else if (deviceId) {
    if (paused) {
      await pausePlayback(deviceId).catch(() => {});
      pauseAudio();
    } else {
      await resumePlayback(deviceId).catch(() => {});
      resumeAudio();
    }
  }
  pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
}

// ----- Journey + device pickers -----------------------------------------
function populateJourneyPicker() {
  journeyPicker.innerHTML = '';
  for (const j of journeys) {
    const opt = document.createElement('option');
    opt.value = j.slug;
    opt.textContent = j.data?.title || j.slug;
    journeyPicker.appendChild(opt);
  }
  journeyPicker.value = journeys.find((j) => j.data === journey)?.slug ?? '';
}

async function switchJourney(slug) {
  const found = journeys.find((j) => j.slug === slug);
  if (!found) return;
  step++;
  cancelAudio();
  hideOverlay();
  if (deviceId) await pausePlayback(deviceId).catch(() => {});
  journey = found.data;
  index = -1;
  paused = false;
  render();
  advanceBtn.textContent = 'Start journey';
  if (isLoggedIn()) advanceBtn.hidden = false;
  statusEl.textContent = `Loaded “${journey.title}”. Press Start.`;
}

async function refreshDevices() {
  let devices = [];
  try {
    devices = await getDevices();
  } catch (e) {
    statusEl.textContent = 'Could not list devices: ' + e.message;
    return;
  }
  devicePicker.innerHTML = '';
  if (!devices.length) {
    deviceId = null;
    const opt = document.createElement('option');
    opt.textContent = 'No devices — open Spotify, then ⟳';
    devicePicker.appendChild(opt);
    statusEl.textContent = 'Open Spotify on the device you want to hear, then press ⟳.';
    return;
  }
  for (const d of devices) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.name} (${d.type})${d.is_active ? ' • active' : ''}`;
    devicePicker.appendChild(opt);
  }
  const active = devices.find((d) => d.is_active) || devices[0];
  deviceId = active.id;
  devicePicker.value = deviceId;
  statusEl.textContent = `Device: ${active.name}. Press “Start journey”.`;
}

// ----- Boot --------------------------------------------------------------
loginBtn.addEventListener('click', () => login());
advanceBtn.addEventListener('click', () => advance(true));
pauseBtn.addEventListener('click', togglePause);
journeyPicker.addEventListener('change', () => switchJourney(journeyPicker.value));
devicePicker.addEventListener('change', async () => {
  deviceId = devicePicker.value || null;
  if (deviceId) await transferPlayback(deviceId).catch(() => {});
});
refreshBtn.addEventListener('click', refreshDevices);

async function init() {
  populateJourneyPicker();
  render();

  if (new URLSearchParams(location.search).has('code')) {
    statusEl.textContent = 'Finishing login…';
    await handleRedirect();
  }
  if (!isLoggedIn()) {
    statusEl.textContent = 'Not connected — log in to begin.';
    return;
  }
  const token = await getAccessToken();
  if (!token) {
    statusEl.textContent = 'Session expired — please log in again.';
    return;
  }

  loginBtn.hidden = true;
  devicePicker.hidden = false;
  refreshBtn.hidden = false;
  advanceBtn.hidden = false;
  advanceBtn.textContent = 'Start journey';
  await showProfile(token);
  await refreshDevices();
}

async function showProfile(token) {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const me = await res.json();
  if (me.product !== 'premium') {
    statusEl.textContent =
      '⚠️ Logged in, but this account is not Premium — Spotify playback control needs Premium.';
  }
}

init();
