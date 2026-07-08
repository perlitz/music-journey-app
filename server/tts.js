// ElevenLabs text-to-speech with an on-disk cache, used by the build scripts
// (scripts/prerender.mjs). The app no longer generates TTS at runtime — it
// plays pre-rendered files — so this lives on the backend/build side only.
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, ROOT } from './env.mjs';

loadEnv();

const CACHE_DIR = join(ROOT, '.tts-cache');
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'nPczCjzI2devNBz1zQrb'; // Brian
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

export function ttsConfig() {
  return { voiceId: VOICE_ID, modelId: MODEL_ID };
}

function cacheKey(text) {
  return createHash('sha1').update(`${VOICE_ID}|${MODEL_ID}|${text}`).digest('hex');
}

// Returns { buffer, cached }. Bills ElevenLabs only on a cache miss.
export async function generateTTS(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set in .env');
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const path = join(CACHE_DIR, `${cacheKey(text)}.mp3`);
  if (existsSync(path)) return { buffer: readFileSync(path), cached: true };

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buffer);
  return { buffer, cached: false };
}
