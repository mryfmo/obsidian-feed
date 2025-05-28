import { test, expect } from './fixtures';

test('Mark item as read', async ({ win }) => {
  // Close the command-palette prompt automatically opened by the test
  // bootstrap so it does not block subsequent clicks. It may open a few
  // milliseconds after the page is ready, therefore we poll for its
  // existence and remove it explicitly rather than relying on an Escape
  // key-press (which might execute too early).
  await win.waitForTimeout(100); // give preload script a moment
  await win.evaluate(() => {
    const el = document.querySelector('.prompt');
    if (el) el.remove();
  });

  await win.click('#fr-nav >> text=Test');
  await win.click('.fr-item-title'); // expand first item
  await win.click("button:text('Mark Read')");
  await expect(win.locator("button:text('Read')").first()).toBeVisible();
});
