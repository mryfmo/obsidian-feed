import { test, expect } from "./fixtures";

test("Mark item as read", async ({ win }) => {
  await win.click("#fr-nav >> text=Test");
  await win.click(".fr-item-title"); // expand first item
  await win.click("button:text('Mark Read')");
  await expect(win.locator("button:text('Read')").first()).toBeVisible();
});
