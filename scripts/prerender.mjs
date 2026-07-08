#!/usr/bin/env node
// Pre-render all narration + cue audio for a journey into public/audio/<slug>/
// and bake the file paths into the journey. The strings rendered here must
// match exactly what the app plays (main.js): narration `text`, and the cue
// `Listen for: ${listenFor}`.
//
//   node scripts/prerender.mjs src/journeys/<slug>.json [slug]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { generateTTS, ttsConfig } from '../server/tts.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/prerender.mjs <journey.json> [slug]');
  process.exit(2);
}

const journey = JSON.parse(readFileSync(file, 'utf8'));
const slug =
  process.argv[3] ||
  (journey.title || 'journey')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const outDir = join('public', 'audio', slug);
mkdirSync(outDir, { recursive: true });

const { voiceId, modelId } = ttsConfig();
console.log(`Voice ${voiceId} · model ${modelId} · → ${outDir}`);

let nCount = 0;
let cCount = 0;
let hits = 0;

try {
  for (const seg of journey.segments) {
    let text;
    let name;
    if (seg.type === 'narration') {
      text = seg.text;
      name = `n${String(nCount++).padStart(2, '0')}.mp3`;
    } else if (seg.type === 'song') {
      text = `Listen for: ${seg.listenFor}`;
      name = `c${String(cCount++).padStart(2, '0')}.mp3`;
    } else {
      continue;
    }

    const { buffer, cached } = await generateTTS(text);
    writeFileSync(join(outDir, name), buffer);
    const url = `/audio/${slug}/${name}`;
    if (seg.type === 'narration') seg.audio = url;
    else seg.cueAudio = url;
    if (cached) hits++;
    process.stdout.write(cached ? '·' : '+'); // + = generated, · = cache hit
  }
  console.log(
    `\nPre-rendered ${nCount} narration + ${cCount} cue clips (${hits} cache hits).`
  );
} finally {
  // Persist whatever we baked so a partial run (e.g. quota hit) isn't lost —
  // a later re-run resumes from cache and only fills the gaps.
  writeFileSync(file, JSON.stringify(journey, null, 2) + '\n');
}
