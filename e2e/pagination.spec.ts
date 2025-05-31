import { test, expect } from './fixtures';
import { TestStability } from './test-helpers';

test('Pagination hotkeys', async ({ win }) => {
  // Properly dismiss command palette if it appears
  await TestStability.dismissModal(win, '.prompt');

  // Select Test feed with stability checks
  await TestStability.clickElement(win, '#fr-nav >> text=Test');
  // Navigate to next page and verify that an item from page 2 is now visible.
  await win.keyboard.press('j');
  await expect(win.locator(".fr-item:has-text('Item 6')")).toBeVisible();

  // Navigate back to page 1 and ensure Item 1 is visible again.
  await win.keyboard.press('k');
  await expect(win.locator(".fr-item:has-text('Item 1')")).toBeVisible();
});
