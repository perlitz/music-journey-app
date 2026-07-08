// Spotify playback control via the Web API + Spotify Connect. Instead of playing
// audio in the browser (the Web Playback SDK, which is desktop-only), we send
// commands to a Spotify app already running on some device — desktop or, on
// mobile, the phone's Spotify app. This works from a mobile browser.
import { getAccessToken } from './auth.js';

const API = 'https://api.spotify.com/v1';

async function authHeaders(extra = {}) {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}`, ...extra };
}

// List devices the account can target (each has id, name, type, is_active).
export async function getDevices() {
  const res = await fetch(`${API}/me/player/devices`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`devices ${res.status}`);
  return (await res.json()).devices || [];
}

// Make a device the active one (does not start playback).
export async function transferPlayback(deviceId) {
  await fetch(`${API}/me/player`, {
    method: 'PUT',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
}

export async function playUri(deviceId, uri) {
  const res = await fetch(`${API}/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ uris: [uri] }),
  });
  if (!res.ok && res.status !== 204) throw new Error(`play ${res.status}`);
}

export async function pausePlayback(deviceId) {
  await fetch(`${API}/me/player/pause?device_id=${deviceId}`, {
    method: 'PUT',
    headers: await authHeaders(),
  });
}

// Resume with no body continues the current track.
export async function resumePlayback(deviceId) {
  await fetch(`${API}/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: await authHeaders(),
  });
}

// Volume as an integer percent 0..100. Used for the radio ducking.
export async function setVolume(deviceId, percent) {
  const v = Math.max(0, Math.min(100, Math.round(percent)));
  await fetch(`${API}/me/player/volume?volume_percent=${v}&device_id=${deviceId}`, {
    method: 'PUT',
    headers: await authHeaders(),
  });
}

// Current playback snapshot, or null if nothing is active.
// Returns { isPlaying, progressMs, durationMs, uri } for song-end polling.
export async function getPlaybackState() {
  const res = await fetch(`${API}/me/player`, { headers: await authHeaders() });
  if (res.status === 204) return null; // no active device/playback
  if (!res.ok) throw new Error(`state ${res.status}`);
  const data = await res.json();
  return {
    isPlaying: data.is_playing,
    progressMs: data.progress_ms ?? 0,
    durationMs: data.item?.duration_ms ?? 0,
    uri: data.item?.uri ?? null,
  };
}
