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
    // 오프라인 단일 파일 빌드에서는 청크를 나누지 않는다
    rollupOptions: process.env.VITE_OFFLINE === '1' ? {} : { output: { manualChunks: { three: ['three'] } } },
  },
});
