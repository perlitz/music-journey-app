// Minimal .env loader for standalone Node scripts (the app itself uses Vite's
// own env handling). Parses KEY=VALUE lines from the project-root .env into
// process.env without adding a dependency. Existing process.env wins.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue; // skips blanks, comments (#…), and malformed lines
      const key = m[1];
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      } else {
        val = val.replace(/\s+#.*$/, '').trim();
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // no .env — rely on the ambient environment
  }
  return process.env;
}

export { ROOT };
