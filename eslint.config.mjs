import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: new URL('.', import.meta.url).pathname,
});

export default tseslint.config(
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
      ecmaVersion: 2020,
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
        ecmaVersion: 2020,
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
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],

      // Obsidian specific
      'no-new': 'off', // new Notice() is a pattern
      'class-methods-use-this': 'off', // Plugin methods often don't use this
    },
  },

  // MCP module configuration
  {
    files: ['.mcp/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './.mcp/tsconfig.json',
        ecmaVersion: 2020,
      },
      globals: {
        globalThis: 'readonly',
      },
    },
    rules: {
      // CLI tools can use console
      'no-console': 'off',

      // ES modules with .js extensions
      'import/extensions': [
        'error',
        'always',
        {
          ts: 'never',
          js: 'always',
        },
      ],

      // Allow process.exit in CLI
      'no-process-exit': 'off',
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

  // Ignore patterns
  {
    ignores: [
      'node_modules/',
      'build/',
      'dist/',
      'main.js',
      '*.min.js',
      'coverage/',
      '.tmp/',
      '.cache/',
      'e2e/runtime/**/*.js', // E2E runtime stubs have special requirements
    ],
  }
);
