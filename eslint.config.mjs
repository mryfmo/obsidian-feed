import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended, // Equivalent to eslint:recommended
  ...tseslint.configs.recommended, // Equivalent to plugin:@typescript-eslint/recommended
  {
    // Global settings for TypeScript files
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      // sourceType: "module" is usually default/inferred with TypeScript
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // Migrate rules from .eslintrc
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-empty-function": "off",
      "no-empty-pattern": ["error", { "allowObjectPatternsAsParameters": true }],
      // Add other rules if needed
    },
  },
  // Configuration for e2e/runtime JavaScript files
  {
    files: ["e2e/runtime/**/*.js"],
    languageOptions: {
      globals: {
        // For bootstrap.js and renderer-preload.js (Electron main/preload context)
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        // For renderer-preload.js (Electron preload context also has browser globals)
        window: "readonly",
        document: "readonly",
        console: "readonly", // console is generally available
        setTimeout: "readonly",
        HTMLElement: "readonly",
        // Add any other specific globals if needed for these files
      },
      sourceType: "commonjs", // Treat these files as CommonJS modules
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "warn",
    },
  },
  {
    // Patterns to ignore (from .eslintignore and build output)
    ignores: ["node_modules/", "build/", "dist/", "main.js"],
  }
); 