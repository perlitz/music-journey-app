// Server-side Spotify track resolution via the Client-Credentials flow (no user
// login). Used by scripts/resolve.mjs to bake track URIs into journeys. Search
// does not require a user scope, so an app token is enough.
import { loadEnv } from './env.mjs';

loadEnv();

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

let cached = null; // { token, expiresAt }

export async function getAppToken() {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const id = process.env.VITE_SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('Need VITE_SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) {
    throw new Error(`Spotify token failed ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  const data = await res.json();
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

// Cover/tribute/karaoke acts that should never outrank the real recording.
const TRIBUTE =
  /(ukulele|tribute|karaoke|made famous|in the light of|as made famous|cover version|string quartet|8[ -]?bit|lullaby|instrumental version|originally performed|renditions?)/i;

// Strip "- Remastered 2009", "- Mono", "- Single Version" etc. so a remastered
// original still counts as an exact title match against a bare-titled cover.
function stripVersion(s) {
  return s
    .replace(
      /\s*-\s*(\d{4}\s*)?(remaster(ed)?|mono|stereo|single version|album version|mix|version)\b.*$/i,
      ''
    )
    .trim();
}

function score(track, title, artist) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const wantTitle = norm(title);
  const wantArtist = norm(artist);
  const gotTitle = norm(stripVersion(track.name));
  const gotArtists = track.artists.map((a) => norm(a.name)).join(' ');

  let s = 0;
  if (gotTitle === wantTitle) s += 1;
  else if (gotTitle.includes(wantTitle) || wantTitle.includes(gotTitle)) s += 0.6;

  // Artist: strong bonus for an exact match, partial for word overlap.
  if (gotArtists === wantArtist) s += 1.5;
  const artistWords = wantArtist.split(' ').filter((w) => w.length > 2);
  const hits = artistWords.filter((w) => gotArtists.includes(w)).length;
  if (artistWords.length) s += (hits / artistWords.length) * 1;

  // Push tributes/karaoke/ukulele acts well below the real thing.
  if (TRIBUTE.test(track.artists.map((a) => a.name).join(' '))) s -= 3;

  s += (track.popularity || 0) / 1000;
  return s;
}

function summarize(track) {
  return {
    uri: track.uri,
    name: track.name,
    artists: track.artists.map((a) => a.name).join(', '),
    album: track.album?.name,
    year: track.album?.release_date?.slice(0, 4),
  };
}

// Resolve title+artist to the best Spotify track, or null if nothing found.
export async function resolveTrack(title, artist) {
  const token = await getAppToken();
  const queries = [`track:${title} artist:${artist}`, `${title} ${artist}`];
  for (const q of queries) {
    const params = new URLSearchParams({ q, type: 'track', limit: '10' });
    const res = await fetch(`${API}/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Search failed (${res.status})`);
    const items = (await res.json()).tracks?.items || [];
    if (items.length) {
      items.sort((a, b) => score(b, title, artist) - score(a, title, artist));
      return summarize(items[0]);
    }
  }
  return null;
}
