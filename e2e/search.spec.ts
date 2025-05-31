import { test, expect } from './fixtures';
import { TestStability } from './test-helpers';

test('Search within feed', async ({ win }) => {
  // Properly dismiss command palette if it appears
  await TestStability.dismissModal(win, '.prompt');

  // Select Test feed with stability checks
  await TestStability.clickElement(win, '#fr-nav >> text=Test');
  await win.keyboard.press('Mod+P');
  await win.locator('.prompt input').fill('Search In Current Feed…');
  await win.keyboard.press('Enter');

  await win.fill('.modal-container input[placeholder="Enter keywords..."]', 'hello');
  // Click Search button with stability checks
  await TestStability.clickElement(win, ".modal-container button:text('Search')");
  await expect(win.locator('.fr-search-result')).toContainText('hello');
});
