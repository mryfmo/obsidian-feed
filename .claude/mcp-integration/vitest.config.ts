import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', 'tests/**', '*.config.ts', 'bridge.ts', 'test.ts'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    deps: {
      interopDefault: true,
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
    conditions: ['node', 'import', 'require'],
  },
});
