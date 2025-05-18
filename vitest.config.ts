import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^obsidian$/,
        replacement: resolve(__dirname, "tests/__mocks__/obsidian.ts"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    // デフォルトは「ユニット」だけ。結合テストは tests/integration で個別実行する。
    exclude: ["e2e/**"],
    include: [
      'tests/unit/**/*.spec.ts',
      'tests/unit/**/*.test.ts',
    ],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
