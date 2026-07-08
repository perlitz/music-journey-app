import { defineConfig } from 'vite';

// On GitHub Pages a *project* site is served from /<repo>/, so the production
// build needs that base path. Local dev stays at root. If you name the repo
// something other than "music-journey-app", change this string to match.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/music-journey-app/' : '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
}));
