---
name: create-journey
description: Generate a guided music listening journey (a narrative arc plus 10 songs) for any subject, resolve the songs on Spotify, and pre-render narration audio. Use when the user types /create-journey or asks to create/generate a new music journey or tour.
---

# Create Journey

Produces a self-contained journey: src/journeys/<slug>.json with baked Spotify
track URIs, plus pre-rendered audio in public/audio/<slug>/. The app just plays
it. Creative writing is delegated to Fable (claude-fable-5).

## Prerequisites
.env must have ELEVENLABS_API_KEY, VITE_SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET,
and ELEVENLABS_MODEL_ID (eleven_multilingual_v2 or eleven_turbo_v2_5; NOT eleven_v3).
If missing, tell the user and stop.

## Steps
1. Slug: kebab-case from the subject.
2. Draft with Fable: Agent tool, model "fable", subagent_type "general-purpose",
   passing the brief below with {SUBJECT} filled in. Write valid JSON to
   src/journeys/<slug>.json (ask Fable to fix once if malformed).
3. node scripts/resolve.mjs src/journeys/<slug>.json
   If any ✗, ask Fable to swap ONLY those songs, rewrite, re-run. Max 2 rounds.
4. node scripts/prerender.mjs src/journeys/<slug>.json <slug>
5. Validate: valid JSON; first & last narration; exactly 10 songs; each song has
   title/artist/listenFor/spotifyUri/cueAudio; each narration has text/audio.
6. Summarize (title + 10 songs) and tell the user to refresh and pick it.

## The Fable brief (fill in {SUBJECT})
> You are writing a guided listening journey about: {SUBJECT}. It's a themed set
> for an independent radio station, presented by someone who studies music and is
> explaining it plainly to non-experts — imagine a music student talking to their
> parents: precise, informed, a little dry, genuinely curious. Not a polished
> podcast host.
> Structure: open with a short framing narration, then alternate song/narration,
> end on a closing narration (10 songs = 11 narration blocks; first and last are
> narration).
> Bridges are 3-4 sentences. The FIRST sentence refers back to the song just heard
> (name a specific moment in the recording); then move to the next song via a
> concrete musical or historical link — a producer, an instrument, a sample, a
> label, a technique, a year — rather than a thematic segue.
> VOICE (this matters most):
>  - Lead with specifics: instruments, gear, production choices, personnel, labels,
>    years, musical terms. Assume the listener is smart but untrained.
>  - NO taglines, slogans, or punchy one-liners. No "mic drop" / "thesis statement"
>    / "cathedral" rhetoric, no marketing gloss, no neat setups-and-payoffs.
>  - Don't be smooth. Plain declarative sentences are good. Avoid rhetorical
>    questions and second-person hype ("Look down...", "Picture this...").
>  - The closing narration is NOT a moral or a call to action. End on a concrete
>    observation or an unresolved detail — the way a host just stops talking and
>    lets the last record breathe.
> listenFor: one specific, technical thing to notice per song — a production
> detail, an instrument, a structural move — in 1-2 plain sentences (spoken as
> "Listen for: ..." over the intro). No dramatization.
> Songs: exact canonical artist + widely-available studio recording; avoid
> ambiguous covers/live/remixes; pick catalog-available tracks.
> Output ONLY a JSON object (no prose/fence):
> { "title": "...", "subject": "{SUBJECT}", "segments": [
>   { "type": "narration", "text": "..." },
>   { "type": "song", "title": "...", "artist": "...", "listenFor": "..." } ] }
> Do NOT include spotifyUri, audio, or cueAudio.
