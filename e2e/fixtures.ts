import { test as base, expect, type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import * as path from "node:path";

// This fixture boots the plugin inside a bare Electron process with the
// obsidian module mocked by tests/__mocks__/obsidian.ts. This is for "light" E2E.

export const test = base.extend<{
  electronApp: ElectronApplication;
  win: Page;
}>({
  electronApp: async ({}, use) => {
    const appPath = path.resolve("./e2e/runtime/bootstrap.js"); // custom bootstrap
    const vaultPath = path.resolve("./e2e-vault");

    // Preload stub that overrides `require('obsidian')` before plugin loads.
    const electronApp = await electron.launch({
      args: [appPath, vaultPath],
      env: {
        ...process.env,
        OBSIDIAN_FEED_DEBUG: "true", // Enable verbose debug logs inside plugin
        NODE_ENV: "test",
      },
    });

    await use(electronApp);
    await electronApp.close();
  },

  win: async ({ electronApp }, use) => {
    const win = await electronApp.firstWindow();

    // Pipe console messages from the renderer to the test runner output so we
    // can view the exact sequence later in the test results.
    win.on('console', (msg) => {
      // We prefix with [renderer] and include the message type for clarity.
      console.log(`[renderer:${msg.type()}] ${msg.text()}`);
    });

    // Work around Playwright not accepting "Mod" alias in Electron context
    // by monkey-patching keyboard.press inside the page.
    const originalPress = win.keyboard.press.bind(win.keyboard);
    win.keyboard.press = (key: string, options?: unknown) => {
      if (key.startsWith('Mod+')) {
        const replacement = (process.platform === 'darwin' ? 'Meta+' : 'Control+') + key.slice(4);
        return originalPress(replacement, options);
      }
      return originalPress(key, options);
    };
    await use(win);
  },
});

export { expect };
