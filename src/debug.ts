/*
  Simple debug utility that disables or enables console.log output globally
  depending on a runtime flag.

  The behaviour is:

  1.  If the environment variable `OBSIDIAN_FEED_DEBUG` is set to the string
      "true" **or**
  2.  If `localStorage.getItem("feedsReaderDebug")` is set to "true"

  then `console.log` behaves normally.  Otherwise it is replaced with a
  no-operation function so all calls become silent.  The replacement preserves
  the original implementation internally so it can be restored programmatically
  (e.g. from the developer console) by calling `enableDebugLogs()`.

  This approach lets us keep every existing `console.log(...)` while gaining a
  clean switch for turning the output on and off without sprinkling explicit
  `if (DEBUG) { ... }` checks throughout the codebase.
*/

// Store the original implementation once so we can restore it later if needed
const originalConsoleLog: typeof console.log = console.log.bind(console);

// Utility to determine whether debug logging should be enabled
function isDebugEnabled(): boolean {
  // 1. Environment variable (works for tests / CLI execution)
  if (typeof process !== "undefined" &&
      // Some bundlers replace `process.env` with a plain object literal, so we
      // cast to `NodeJS.Process` only when it is actually available.
      (process as NodeJS.Process).env?.OBSIDIAN_FEED_DEBUG === "true") {
    return true;
  }

  // 2. Browser/Electron localStorage flag (works inside Obsidian)
  if (typeof window !== "undefined" &&
      window?.localStorage?.getItem("feedsReaderDebug") === "true") {
    return true;
  }

  return false;
}

// Replace or restore `console.log` according to the current flag
function updateConsolePatch(): void {
  if (isDebugEnabled()) {
    console.log = originalConsoleLog;
  } else {
    console.log = () => {
      /* noop when debug disabled */
    };
  }
}

// Apply immediately on module load
updateConsolePatch();

// --- Optional helpers ----------------------------------------------------

/**
 * Enable debug logging for the current session.  Useful from DevTools.
 */
export function enableDebugLogs(): void {
  if (typeof window !== "undefined") {
    window.localStorage?.setItem("feedsReaderDebug", "true");
  }
  if (typeof process !== "undefined") {
    const env = (process as NodeJS.Process).env as Record<string, string | undefined>;
    env.OBSIDIAN_FEED_DEBUG = "true";
  }
  updateConsolePatch();
}

/**
 * Disable debug logging for the current session.
 */
export function disableDebugLogs(): void {
  if (typeof window !== "undefined") {
    window.localStorage?.removeItem("feedsReaderDebug");
  }
  if (typeof process !== "undefined") {
    delete (process as NodeJS.Process).env.OBSIDIAN_FEED_DEBUG;
  }
  updateConsolePatch();
}
