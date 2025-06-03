import js from '@eslint/js';
// eslint-disable-next-line import/no-unresolved
import tseslint from 'typescript-eslint';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: new URL('.', import.meta.url).pathname,
});

export default tseslint.config(
  // Ignore patterns - MUST be first
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'dist/**',
      'main.js',
      '*.min.js',
      'coverage/**',
      '.tmp/**',
      '.cache/**',
      'docs/templates/**/*.template.ts',
      '.claude/scripts/**',
      '*.template.ts',
      'docs/api/**',
      'docs/api-md/**',
      '.mcp/**',
      'e2e/runtime/**/*.js',
    ],
  },

  // Base configurations
  js.configs.recommended,
  ...compat.config({
    extends: [
      'airbnb-base',
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended',
    ],
  }),
  ...tseslint.configs.recommended,

  // Global settings for all files
  {
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        globalThis: 'readonly',
      },
    },
  },

  // TypeScript configuration
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2024,
      },
      globals: {
        globalThis: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
          alwaysTryTypes: true,
        },
        node: {
          extensions: ['.js', '.mjs', '.ts', '.json'],
        },
      },
      'import/core-modules': ['obsidian', 'electron'],
    },
    rules: {
      // TypeScript specific
      '@typescript-eslint/no-explicit-any': 'error',
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': ['error', { classes: false }],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],

      // Import rules
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          ts: 'never',
          tsx: 'never',
          js: 'never',
          mjs: 'never',
        },
      ],
      'import/no-unresolved': 'error',
      'import/prefer-default-export': 'off',

      // Best practices
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-await-in-loop': 'off',
      'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
      'prefer-const': 'error',
      'no-param-reassign': ['error', { props: false }],
      'no-underscore-dangle': [
        'error',
        {
          allow: ['__dirname', '__filename', '__sourceFeed', '_scrollCb', '_lastProgressUpdate'],
          allowAfterThis: true,
          allowAfterSuper: true,
          allowAfterThisConstructor: true,
        },
      ],
      'no-plusplus': 'error',
      'no-nested-ternary': 'error',
      'no-return-await': 'error',
      'no-shadow': 'error',
      'no-void': ['error', { allowAsStatement: true }],
      'no-script-url': 'error',
      radix: 'error',
      'max-classes-per-file': ['error', 1],
      'no-lonely-if': 'error',
      'prefer-destructuring': ['error', { object: true, array: true }],

      // Obsidian specific
      'no-new': 'off', // new Notice() is a pattern
      'class-methods-use-this': 'off', // Plugin methods often don't use this

      // Obsidian plugins bundle their dependencies
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: true,
          packageDir: '.',
        },
      ],
    },
  },

  // Test files configuration
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'tests/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      // Test files have different requirements
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'import/no-extraneous-dependencies': 'off',
      'no-console': 'off',
      'max-classes-per-file': 'off', // Test mocks often have multiple classes

      // Test-specific patterns
      'func-names': 'off',
      'prefer-arrow-callback': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': false,
          'ts-expect-error': 'allow-with-description',
        },
      ],
    },
  },

  // Mock files configuration
  {
    files: ['tests/__mocks__/**/*.ts', 'e2e/runtime/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        window: 'readonly',
        document: 'readonly',
      },
    },
    rules: {
      // Mocks have special requirements
      'class-methods-use-this': 'off',
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-underscore-dangle': 'off',
      'max-classes-per-file': 'off',
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',

      // CommonJS in runtime stubs
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'global-require': 'off',
      'import/no-dynamic-require': 'off',
    },
  },

  // Configuration files
  {
    files: ['*.config.{js,mjs,ts}', 'scripts/**/*.js'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
      'no-console': 'off',
      'no-underscore-dangle': 'off', // Allow __dirname in config files
    },
  },

  // Build scripts
  {
    files: ['version-bump.mjs', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off', // Build scripts need console output
      'no-process-exit': 'off', // Build scripts can exit with error codes
      'import/no-extraneous-dependencies': 'off',
    },
  }
);
