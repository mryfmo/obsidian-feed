import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 3 * 60 * 1000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
});
