#!/usr/bin/env node
// Resolve every song in a journey file against Spotify and bake the track URI
// (+ resolved name/artists) into it. Prints a ✓/✗ table and exits nonzero if
// any song could not be resolved, so the caller (the create-journey skill) can
// swap the offending songs and re-run.
//
//   node scripts/resolve.mjs src/journeys/<slug>.json
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveTrack } from '../server/spotify-resolve.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/resolve.mjs <journey.json>');
  process.exit(2);
}

const journey = JSON.parse(readFileSync(file, 'utf8'));
let unresolved = 0;

for (const seg of journey.segments) {
  if (seg.type !== 'song') continue;
  let hit = null;
  try {
    hit = await resolveTrack(seg.title, seg.artist);
  } catch (e) {
    console.error(`!  ${seg.title} — ${seg.artist}: ${e.message}`);
    process.exit(3); // token/network problem, not a per-song miss
  }
  if (!hit) {
    unresolved++;
    delete seg.spotifyUri;
    delete seg.spotifyName;
    delete seg.spotifyArtists;
    console.log(`✗  ${seg.title} — ${seg.artist}`);
    continue;
  }
  seg.spotifyUri = hit.uri;
  seg.spotifyName = hit.name;
  seg.spotifyArtists = hit.artists;
  console.log(
    `✓  ${seg.title} — ${seg.artist}  →  ${hit.name} — ${hit.artists} (${hit.year || '?'})`
  );
}

writeFileSync(file, JSON.stringify(journey, null, 2) + '\n');

if (unresolved) {
  console.error(`\n${unresolved} unresolved song(s) — swap them and re-run.`);
  process.exit(1);
}
console.log('\nAll songs resolved ✓');
