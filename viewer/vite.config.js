import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds to viewer/dist, which `mcts-mem serve` serves. For live dev (`npm run
// dev`), Vite proxies /api to a running `mcts-mem serve` on port 4173.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:4173' },
  },
});
