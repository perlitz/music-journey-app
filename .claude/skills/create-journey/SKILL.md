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
> for an independent radio station, presented by someone who knows the music well and
> is teaching it plainly to non-experts. Every sentence must teach the listener
> something concrete they did not already know. If a sentence could be cut without
> the listener losing a fact, cut it.
> Structure: open with a short framing narration, then alternate song/narration,
> end on a closing narration (10 songs = 11 narration blocks; first and last are
> narration).
> Bridges are 2-3 short, direct sentences. The FIRST short sentence refers back to
> the song just heard (name a specific moment in the recording); the next 1-2 short
> sentences move to the next song via a concrete musical or historical link — a
> producer, an instrument, a sample, a label, a technique, a year — rather than a
> thematic segue.
> VOICE (this matters most):
>  - Write plain, active-voice, subject-verb-object sentences. Keep them short.
>  - Every sentence must deliver a specific fact: a name, a year, an instrument, a
>    technique, a label, a place. Sentences that only set mood or frame a concept
>    ("X is not just Y; it is Z") are not allowed.
>  - NO definitions or thesis statements. Don't tell the listener what a genre "is".
>    Instead, state what happened: who made it, when, where, with what.
>  - NO participial openers ("Emerging from...", "Drawing on..."). Just state the
>    fact directly: "It emerged from..." / "He drew on...".
>  - NO superlatives, grand claims, or vague praise ("the definitive expression of",
>    "a masterpiece", "singular voice", "devastating"). State what the music does
>    technically and let the listener decide.
>  - NO theatrics, drama, taglines, slogans, or punchy one-liners. No "mic drop" /
>    "thesis statement" / "cathedral" rhetoric, no marketing gloss.
>  - NO rhetorical questions, second-person hype ("Picture this..."), or commands.
>  - BAD: "French chanson is not just a musical style; it is a literary tradition
>    set to music." → GOOD: "Chanson grew out of Parisian cabaret and music halls
>    in the early 1900s. The lyrics mattered more than the melody."
>  - BAD: "Emerging from cabaret, music halls, and Parisian streets, it puts the
>    lyricist at the absolute center." → GOOD: "It started in cabaret. The
>    singer usually wrote the words."
>  - BAD: "these songs document the private dramas of ordinary life" →
>    GOOD: "most of the songs were about love, loss, or street life in Paris."
>  - The closing narration is short (2-3 sentences), NOT a moral or call to action.
>    End on a concrete fact or small unresolved detail.
> listenFor: ONE short sentence pointing out a specific technical or musical detail
> (a production choice, an instrument, a rhythm). Must fit in under 5 seconds
> spoken aloud. The app already prepends "Listen for:" at playback, so do NOT
> start the value with "Listen for" — just write the detail directly
> (e.g. "the muted trumpet accents behind the vocal"). No dramatization.
> Songs: exact canonical artist + widely-available studio recording; avoid
> ambiguous covers/live/remixes; pick catalog-available tracks.
> Output ONLY a JSON object (no prose/fence):
> { "title": "...", "subject": "{SUBJECT}", "segments": [
>   { "type": "narration", "text": "..." },
>   { "type": "song", "title": "...", "artist": "...", "listenFor": "..." } ] }
> Do NOT include spotifyUri, audio, or cueAudio.
