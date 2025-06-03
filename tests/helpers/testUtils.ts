/**
 * Test utilities for async operations
 */

/**
 * Flushes all pending promises in the microtask queue.
 * This is more elegant than setTimeout(0) for waiting on async operations.
 */
export async function flushPromises(): Promise<void> {
  await Promise.resolve();
}

/**
 * Waits for the next macrotask (like setTimeout callbacks).
 * Use this when you need to wait for timers or DOM updates.
 */
export async function nextTick(): Promise<void> {
  await new Promise<void>(resolve => {
    queueMicrotask(resolve);
  });
}
