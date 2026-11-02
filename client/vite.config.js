import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const root = fileURLToPath(new URL('.', import.meta.url));

// `--mode demo` builds a single HTML file that runs with no server, on fictional in-memory data.
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  return {
    root,
    plugins: [react(), ...(demo ? [viteSingleFile()] : [])],
    define: { __DEMO__: JSON.stringify(demo) },
    server: {
      port: 5173,
      fs: { allow: ['..'] },
      proxy: { '/api': 'http://localhost:3001' },
    },
    build: {
      outDir: demo ? '../dist-demo' : '../dist',
      emptyOutDir: true,
    },
  };
});
