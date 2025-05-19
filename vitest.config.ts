import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^obsidian$/,
        replacement: resolve(__dirname, 'tests/__mocks__/obsidian.ts'),
      },
    ],
  },
  // Root config does not run tests, only workspace-side project definitions are used
  test: {
    include: [],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
