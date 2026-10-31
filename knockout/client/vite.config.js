import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const serverPort = process.env.SERVER_PORT || 3001;

export default defineConfig({
  root,
  base: './',
  server: {
    host: true,
    port: 5173,
    proxy: { '/ws': { target: `ws://localhost:${serverPort}`, ws: true } },
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
