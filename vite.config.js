import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Serve the marketing landing page at "/" in dev; the dashboard app
// stays reachable at every other path (e.g. /login).
function landingAtRoot() {
  return {
    name: 'landing-at-root',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(fs.readFileSync(path.join(root, 'landing.html')));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), landingAtRoot()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
