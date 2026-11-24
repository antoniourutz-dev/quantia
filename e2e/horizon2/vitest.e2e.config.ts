/* global __dirname */
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  root: repoRoot,
  plugins: [react()],
  test: {
    root: repoRoot,
    globals: true,
    environment: 'jsdom',
    testTimeout: 20000,
    setupFiles: ['./vitest.setup.ts'],
    include: ['e2e/horizon2/**/*.{test,spec}.{ts,tsx}'],
  },
});
