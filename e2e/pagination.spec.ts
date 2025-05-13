import { test, expect } from "./fixtures";

test("Pagination hotkeys", async ({ win }) => {
  await win.click("#fr-nav >> text=Test");
  // assume more than one page exists
  await win.keyboard.press("j"); // next page hotkey
  await expect(win.locator(".fr-item").first()).toBeVisible();
  await win.keyboard.press("k"); // prev page hotkey
  await expect(win.locator(".fr-item").first()).toBeVisible();
});
