import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds to ../web-viewer, which `mcts-mem serve` serves and the root npm
// package includes. For live dev (`npm run
// dev`), Vite proxies /api to a running `mcts-mem serve` on port 4173.
export default defineConfig({
  plugins: [react()],
  build: { outDir: '../web-viewer', emptyOutDir: true },
  server: {
    proxy: { '/api': 'http://localhost:4173' },
  },
});
