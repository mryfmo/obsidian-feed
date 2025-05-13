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
      // Add other rules if needed
    },
  },
  {
    // Patterns to ignore (from .eslintignore and build output)
    ignores: ["node_modules/", "build/", "dist/", "main.js"],
  }
); 