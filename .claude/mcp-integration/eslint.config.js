// eslint-disable-next-line import/no-extraneous-dependencies
import js from '@eslint/js';
// eslint-disable-next-line import/no-unresolved
import typescript from '@typescript-eslint/eslint-plugin';
// eslint-disable-next-line import/no-unresolved
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'writable',
        require: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off', // Console allowed for CLI tools
      'no-debugger': 'error',
      'no-fallthrough': ['error', { commentPattern: 'break[\\s\\w]*omitted' }],
      'no-case-declarations': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', '*.js', '*.d.ts', 'eslint.config.js'],
  },
];
