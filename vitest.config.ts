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
    testTimeout: 20000, // Increase timeout for coverage runs
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'e2e/',
        '*.config.*',
        'docs/templates/**',
        '.mcp/',
        '.claude/',
        'dist/',
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/*.test.ts',
        'tests/__mocks__/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
