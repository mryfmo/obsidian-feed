import { defineWorkspace } from 'vitest/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const alias = [
  {
    find: /^obsidian$/,
    replacement: resolve(__dirname, 'tests/__mocks__/obsidian.ts'),
  },
];

export default defineWorkspace([
  {
    resolve: { alias },
    test: {
      name: 'unit',
      environment: 'jsdom',
      globals: true,
      testTimeout: 10000,
      include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.test.ts'],
      exclude: ['**/node_modules/**', 'e2e/**'],
    },
  },
  {
    resolve: { alias },
    test: {
      name: 'integration',
      environment: 'jsdom',
      globals: true,
      testTimeout: 10000,
      include: ['tests/integration/**/*.int.spec.ts'],
      exclude: ['**/node_modules/**', 'tests/unit/**', 'e2e/**'],
    },
  },
]);
