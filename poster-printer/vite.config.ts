import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5180, proxy: { '/api': 'http://127.0.0.1:8787' } },
  preview: { host: '0.0.0.0', port: 5180, proxy: { '/api': 'http://127.0.0.1:8787' } },
  build: { rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), lab: resolve(import.meta.dirname, 'lab.html'), color: resolve(import.meta.dirname, 'color.html'), rate: resolve(import.meta.dirname, 'rate.html') } } },
});
