import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { FlatCompat } from '@eslint/eslintrc';

// ---------------------------------------------------------------------------
// Flat-config helper – converts legacy "extends" presets (Airbnb, Prettier …)
// into the flat-config shape understood by ESLint ≥ v9.  Nothing fancy here –
// we just want to re-use the upstream configs without maintaining forks.
// ---------------------------------------------------------------------------

const compat = new FlatCompat({
  baseDirectory: new URL('.', import.meta.url).pathname,
});

export default tseslint.config(
  // 1) ESLint recommended base rules (JS) ---------------------------------
  js.configs.recommended,

  // 2) Airbnb **Base** rules (JavaScript) + Prettier formatting -------------
  //    We purposely avoid `airbnb-typescript` because it still references
  //    rules that were removed in @typescript-eslint v6.  Instead we layer:
  //      – airbnb-base  (JS best-practices)
  //      – plugin:@typescript-eslint/recommended (TS-specific rules)
  //      – plugin:prettier/recommended           (formatting)
  ...compat.config({
    extends: [
      'airbnb-base',
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended',
    ],
  }),

  // 3) TypeScript recommended rules ---------------------------------------
  ...tseslint.configs.recommended,

  // 4) Global TS-specific settings & overrides -----------------------------
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    settings: {
      // Let eslint-plugin-import understand TypeScript resolution
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
          alwaysTryTypes: true,
        },
        // Treat certain Obsidian/Electron-specific packages as “core modules”
        // (i.e. provided at runtime, not present on disk).
        node: {
          extensions: ['.js', '.mjs', '.ts', '.json'],
        },
      },
      // Obsidian API is resolved at runtime inside the host app
      'import/core-modules': ['obsidian', 'electron'],
    },
    rules: {
      // Allow TS paths without explicit extension (Airbnb complains by default)
      'import/extensions': ['error', 'ignorePackages', { ts: 'never', tsx: 'never' }],
    },
  },

  // 5) Electron preload / test-runner stubs (plain JS) ---------------------
  {
    files: ['e2e/runtime/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        window: 'readonly',
        document: 'readonly',
      },
      sourceType: 'commonjs', // Electron main & preload scripts are CJS
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',

      // Import / dependency checks are meaningless in stubs
      'import/no-unresolved': 'off',
      'import/no-extraneous-dependencies': 'off',

      // The files intentionally violate many style rules; disable locally
      'max-classes-per-file': 'off',
      'class-methods-use-this': 'off',
      'no-param-reassign': 'off',
      'no-underscore-dangle': 'off',
      'no-new': 'off',
      'no-plusplus': 'off',
      'no-void': 'off',
      'no-empty-function': 'off',
      'no-use-before-define': 'off',
      'no-shadow': 'off',
      'no-undef': 'off',
    },
  },

  // 7) End-to-End (Playwright) test helpers – TypeScript -------------------
  {
    files: ['e2e/**/*.ts'],
    rules: {
      // Playwright helpers live in devDependencies by design
      'import/no-extraneous-dependencies': 'off',
    },
  },

  // 6) Ignore build artifacts & vendored stuff ----------------------------
  {
    ignores: ['node_modules/', 'build/', 'dist/', 'main.js'],
  },
);
