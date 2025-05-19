import { test, expect } from "./fixtures";

// This test mocks network error to ensure UI shows toast/notification.
// Since the actual implementation shows console + notice, we assert that at
// least the modal closes and an error banner appears.

test("Shows error toast when feed fetch fails", async ({ win }) => {
  // Intercept network requests inside the page context (axios uses fetch in fallback)
  await win.route('**/example.com/rss', route => {
    route.fulfill({ status: 404, body: 'Not Found' });
  });

  await win.keyboard.press("Mod+P");
  await win.locator('.prompt input').fill("Add New Feed…");
  await win.keyboard.press("Enter");

  await expect(win.locator(".modal-container")).toBeVisible();
  await win.fill('input[placeholder="Feed name (unique)"]', "ErrFeed");
  await win.fill('input[placeholder="Feed URL (RSS/Atom link)"]', "https://example.com/rss");
  await win.click("button:text('Add')");

  // Error notice should appear
  await expect(win.locator('.notification-container')).toContainText(/Failed to fetch/i);
});
