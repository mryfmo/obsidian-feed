import { test, expect } from "./fixtures";

test("Search within feed", async ({ win }) => {
  await win.click("#fr-nav >> text=Test");
  await win.keyboard.press("Mod+P");
  await win.locator('.prompt input').fill("Search In Current Feed…");
  await win.keyboard.press("Enter");

  await win.fill('.modal-container input[placeholder="Enter keywords..."]', "hello");
  await win.click(".modal-container button:text('Search')");
  await expect(win.locator(".fr-search-result")).toContainText("hello");
});
