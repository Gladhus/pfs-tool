import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/utils/**', 'src/core/**'],
      exclude: ['src/tests/**'],
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: '/pfs-tool-react/',
  server: {
    port: 8080,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
