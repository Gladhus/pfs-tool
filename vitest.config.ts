import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.test.js'],
    reporters: ['default', 'json'],
    outputFile: { json: './test-results/vitest-results.json' },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
