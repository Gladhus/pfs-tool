import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pfs-tool/',
  server: {
    port: 8080,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
