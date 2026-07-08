---
name: create-journey
description: Generate a guided music listening journey (a narrative arc plus 10 songs) for any subject, resolve the songs on Spotify, and pre-render narration audio. Use when the user types /create-journey or asks to create/generate a new music journey or tour.
---

# Create Journey

Produces a self-contained journey: src/journeys/<slug>.json with baked Spotify
track URIs, plus pre-rendered audio in public/audio/<slug>/. The app just plays
it. Creative writing is delegated to an AI subagent or model.

## Prerequisites
.env must have ELEVENLABS_API_KEY, VITE_SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET,
and ELEVENLABS_MODEL_ID (eleven_multilingual_v2 or eleven_turbo_v2_5; NOT eleven_v3).
If missing, tell the user and stop.

## Steps
1. Slug: kebab-case from the subject.
2. Draft the journey JSON: Invoke an AI subagent or model, passing the brief below
   with {SUBJECT} filled in. Write valid JSON to src/journeys/<slug>.json (if malformed,
   ask the model to fix it once).
3. node scripts/resolve.mjs src/journeys/<slug>.json
   If any ✗, ask the model to swap ONLY those songs, rewrite, re-run. Max 2 rounds.
4. node scripts/prerender.mjs src/journeys/<slug>.json <slug>
5. Validate: valid JSON; first & last narration; exactly 10 songs; each song has
   title/artist/listenFor/spotifyUri/cueAudio; each narration has text/audio.
6. Summarize (title + 10 songs) and tell the user to refresh and pick it.

## The Journey Brief (fill in {SUBJECT})
> You are writing a guided listening journey about: {SUBJECT}. It's a themed set
> for an independent radio station, presented by someone who studies music and is
> explaining it plainly to non-experts — precise, informed, completely matter-of-fact,
> and concise. Not a dramatic or polished podcast host.
> Structure: open with a short framing narration, then alternate song/narration,
> end on a closing narration (10 songs = 11 narration blocks; first and last are
> narration).
> Bridges are 2-3 short, direct sentences. The FIRST short sentence refers back to
> the song just heard (name a specific moment in the recording); the next 1-2 short
> sentences move to the next song via a concrete musical or historical link — a
> producer, an instrument, a sample, a label, a technique, a year — rather than a
> thematic segue.
> VOICE (this matters most):
>  - Keep all sentences very short, crisp, and conversational. Avoid long compound
>    sentences or rambling explanations.
>  - Lead with specifics: instruments, gear, production choices, personnel, labels,
>    years, musical terms. Assume the listener is smart but untrained.
>  - NO theatrics, drama, taglines, slogans, or punchy one-liners. No "mic drop" /
>    "thesis statement" / "cathedral" rhetoric, no marketing gloss, no elaborate setups.
>  - Be completely plain and declarative. Avoid rhetorical questions and second-person
>    hype ("Look down...", "Picture this...").
>  - The closing narration is short (2-3 sentences), NOT a moral or a call to action.
>    End on a concrete observation or an unresolved detail — the way a host simply
>    stops talking and lets the last record breathe.
> listenFor: ONE short, concise sentence pointing out a specific technical or musical
> detail to notice (e.g. a production choice, an instrument, a rhythm shift). Must be
> brief enough to speak clearly in under 5 seconds over the intro (spoken as
> "Listen for: ..."). No dramatization or fluff.
> Songs: exact canonical artist + widely-available studio recording; avoid
> ambiguous covers/live/remixes; pick catalog-available tracks.
> Output ONLY a JSON object (no prose/fence):
> { "title": "...", "subject": "{SUBJECT}", "segments": [
>   { "type": "narration", "text": "..." },
>   { "type": "song", "title": "...", "artist": "...", "listenFor": "..." } ] }
> Do NOT include spotifyUri, audio, or cueAudio.
