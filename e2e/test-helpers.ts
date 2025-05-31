import type { Page } from '@playwright/test';

/**
 * Test stability helpers for Obsidian plugin E2E tests
 */
export class TestStability {
  /**
   * Retry a function with exponential backoff
   */
  static async retryOnFailure<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * Wait for and dismiss modal dialogs properly
   */
  static async dismissModal(page: Page, selector = '.prompt'): Promise<void> {
    try {
      const modal = page.locator(selector);
      
      // Wait for modal to appear with timeout
      await modal.waitFor({ 
        state: 'visible', 
        timeout: 5000 
      });
      
      // Use Escape key to close naturally
      await page.keyboard.press('Escape');
      
      // Verify modal is hidden
      await modal.waitFor({ 
        state: 'hidden', 
        timeout: 5000 
      });
    } catch (error) {
      // Modal might not appear, which is fine
      console.log(`Modal ${selector} not found or already dismissed`);
    }
  }

  /**
   * Wait for element with retry logic
   */
  static async waitForElement(
    page: Page, 
    selector: string, 
    options: { timeout?: number; retries?: number } = {}
  ): Promise<void> {
    const { timeout = 5000, retries = 3 } = options;
    
    await this.retryOnFailure(async () => {
      const element = page.locator(selector);
      await element.waitFor({ state: 'visible', timeout });
    }, retries);
  }

  /**
   * Click element with stability checks
   */
  static async clickElement(
    page: Page,
    selector: string,
    options: { force?: boolean; timeout?: number } = {}
  ): Promise<void> {
    const element = page.locator(selector);
    
    // Ensure element is ready
    await element.waitFor({ state: 'visible', timeout: options.timeout ?? 5000 });
    await element.waitFor({ state: 'attached' });
    
    // Scroll into view if needed
    await element.scrollIntoViewIfNeeded();
    
    // Click with optional force
    await element.click({ force: options.force });
  }
}

/**
 * Platform-specific keyboard helpers
 */
export class KeyboardHelpers {
  static getModifierKey(): string {
    return process.platform === 'darwin' ? 'Meta' : 'Control';
  }
  
  static getModifiedKey(key: string): string {
    if (key.startsWith('Mod+')) {
      return `${this.getModifierKey()}+${key.slice(4)}`;
    }
    return key;
  }
}