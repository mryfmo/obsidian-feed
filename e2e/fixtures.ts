import { test as base, expect, type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import * as path from "node:path";

export const test = base.extend<{
  electronApp: ElectronApplication;
  win: Page;
}>({
  electronApp: async (_: unknown, use) => {
    const appPath = path.resolve("./.obsidian-unpacked/main.js"); // Obsidian dev build
    const vaultPath = path.resolve("./e2e-vault");
    const electronApp = await electron.launch({
      args: [appPath, "open", `obsidian://open?path=${encodeURIComponent(vaultPath)}`],
    });
    await use(electronApp);
    await electronApp.close();
  },

  win: async ({ electronApp }, use) => {
    const win = await electronApp.firstWindow();
    await use(win);
  },
});

export { expect };
