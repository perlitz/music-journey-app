// Spotify Authorization Code flow with PKCE — safe for a browser-only app
// (no client secret required). Docs:
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
// Derive the redirect from wherever the app is served (origin + Vite base path),
// so the same code works on localhost and on a GitHub Pages subpath. Register
// each full URL in the Spotify dashboard.
const REDIRECT_URI = window.location.origin + import.meta.env.BASE_URL;

// Scopes:
//  - streaming + user-read-email/private: required by the Web Playback SDK
//  - user-modify/read-playback-state: start/observe playback on our device
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ');

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const STORAGE_KEY = 'spotify_token';
const VERIFIER_KEY = 'pkce_verifier';

function randomString(length) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

async function sha256(plain) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Step 1: send the user to Spotify to authorize.
export async function login() {
  if (!CLIENT_ID) {
    alert('Missing VITE_SPOTIFY_CLIENT_ID. Copy .env.example to .env and fill it in.');
    return;
  }
  const verifier = randomString(64);
  const challenge = base64url(await sha256(verifier));
  localStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location = `${AUTH_URL}?${params}`;
}

function saveToken(data) {
  const token = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
  return token;
}

// Step 2: after Spotify redirects back with ?code=..., exchange it for tokens.
export async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;

  const verifier = localStorage.getItem(VERIFIER_KEY);
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();

  // Clean the ?code=... out of the URL bar.
  window.history.replaceState({}, document.title, new URL(REDIRECT_URI).pathname);

  if (data.access_token) return saveToken(data);
  console.error('Token exchange failed', data);
  return null;
}

// Returns a valid access token, refreshing it if it's expired.
export async function getAccessToken() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  let token = JSON.parse(raw);

  // Still valid (with a 60s safety margin)?
  if (Date.now() < token.expires_at - 60_000) return token.access_token;

  // Otherwise refresh.
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: token.refresh_token,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error('Token refresh failed', data);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  // A refresh response may omit a new refresh_token — keep the old one.
  token = saveToken({ ...data, refresh_token: data.refresh_token || token.refresh_token });
  return token.access_token;
}

export function isLoggedIn() {
  return !!localStorage.getItem(STORAGE_KEY);
}
