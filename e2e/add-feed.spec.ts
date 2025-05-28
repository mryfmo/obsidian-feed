import { test, expect } from './fixtures';

test('Add feed and refresh', async ({ win }) => {
  // open command palette
  await win.keyboard.press('Mod+P');
  await win.locator('.prompt input').fill('Add New Feed…');
  await win.keyboard.press('Enter');

  // modal should appear
  await expect(win.locator('.modal-container')).toBeVisible();
  await win.fill('input[placeholder="Feed name (unique)"]', 'Test');
  await win.fill('input[placeholder="Feed URL (RSS/Atom link)"]', 'https://example.com/rss');
  await win.click("button:text('Add')");
  await expect(win.locator('.modal-container')).toBeHidden();

  // Feed list should have the new entry
  await expect(win.locator('#fr-nav')).toContainText('Test');
});
