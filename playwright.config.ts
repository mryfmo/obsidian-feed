import { defineConfig } from "@playwright/test";

// Unified E2E configuration (previously "light")
export default defineConfig({
  timeout: 3 * 60 * 1000, // 3 min per test
  testDir: "./e2e",
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
});
