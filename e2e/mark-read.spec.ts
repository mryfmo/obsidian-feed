import { test, expect } from './fixtures';
import { TestStability } from './test-helpers';

test('Mark item as read', async ({ win }) => {
  // Properly dismiss command palette if it appears
  await TestStability.dismissModal(win, '.prompt');

  // Click on Test feed with stability checks
  await TestStability.clickElement(win, '#fr-nav >> text=Test');
  
  // Expand first item (use .first() to avoid multiple elements)
  await TestStability.clickElement(win, '.fr-item-title >> nth=0');
  
  // Click Mark Read button (use .first() to target the first item's button)
  await TestStability.clickElement(win, "button:text('Mark Read') >> nth=0");
  await expect(win.locator("button:text('Read')").first()).toBeVisible();
});
