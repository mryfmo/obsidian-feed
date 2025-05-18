import { mergeConfig } from 'vitest/config';
import base from './vitest.config';

// Integration tests should *only* run files located in tests/integration/**
// and must NOT be filtered out by the `exclude` pattern present in the base
// config.  Therefore we *override* both `include` and `exclude`.

export default mergeConfig(
  base,
  {
    test: {
      include: ['tests/integration/**/*.int.spec.ts'],
      exclude: ['e2e/**', 'tests/unit/**'],
    },
  },
);
