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
    coverage: {
      provider: 'v8',
      // Floors sit just below current coverage so the suite can only grow, not
      // erode. Raise these as coverage improves.
      thresholds: {
        lines: 65,
        statements: 62,
        functions: 48,
        branches: 42,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
