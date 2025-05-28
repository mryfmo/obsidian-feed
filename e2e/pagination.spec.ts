import { test, expect } from './fixtures';

test('Pagination hotkeys', async ({ win }) => {
  // Dismiss the command palette overlay shown at startup so the navigation
  // link becomes clickable. Remove directly in case Escape fires too early.
  await win.waitForTimeout(100);
  await win.evaluate(() => {
    document.querySelector('.prompt')?.remove();
  });

  await win.click('#fr-nav >> text=Test');
  // Navigate to next page and verify that an item from page 2 is now visible.
  await win.keyboard.press('j');
  await expect(win.locator(".fr-item:has-text('Item 6')")).toBeVisible();

  // Navigate back to page 1 and ensure Item 1 is visible again.
  await win.keyboard.press('k');
  await expect(win.locator(".fr-item:has-text('Item 1')")).toBeVisible();
});
