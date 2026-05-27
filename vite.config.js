import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: '/pfs-tool/',
  server: {
    port: 8080,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
