# Music Journey

A personal app that turns a subject ("the evolution of the drum machine", "songs
about heat") into a guided *listening tour* — narration written by Claude,
spoken via text-to-speech, interleaved with real songs.

This is step 1: **de-risk Spotify auth + full-song playback in the browser.**
Everything else (journey generation, TTS, sequencing) is easy by comparison, so
we prove this first.

## One-time setup

1. **Use a Spotify Premium account.** The Web Playback SDK will not play full
   songs without Premium.

2. **Create a Spotify app** at https://developer.spotify.com/dashboard →
   *Create app*:
   - **Redirect URI:** `http://127.0.0.1:5173/` (must be exact — Spotify
     requires `127.0.0.1`, not `localhost`)
   - **APIs used:** check **Web API** and **Web Playback SDK**
   - Copy the **Client ID** (the secret is not needed — this app uses PKCE)

3. **Configure the app:**
   ```sh
   cp .env.example .env
   # then edit .env and paste your Client ID into VITE_SPOTIFY_CLIENT_ID
   ```

4. **Install & run:**
   ```sh
   npm install
   npm run dev
   ```
   Open http://127.0.0.1:5173/ in a **desktop** browser (Chrome/Firefox/Safari).

## What to expect

- Click **Log in with Spotify**, approve the scopes.
- You'll see your name + account type. If it says `premium`, good.
- Click **Play test song** — a full track should start playing *in this browser
  tab* (the tab becomes a Spotify Connect device called "Music Journey (web)").

## Known limitation

The Web Playback SDK only works in **desktop browsers**, not mobile ones. This
milestone validates auth + playback control. Getting the finished journeys onto
your phone is a later, separate decision (a small native app, or Spotify's
local-files feature).
