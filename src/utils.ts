import { URL } from 'url';

// ---------------------------------------------------------------------------
// Feed-item helpers
// ---------------------------------------------------------------------------

import type { RssFeedItem } from './types';

// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

/**
 * Resolves a possibly-relative URL against a base and returns the absolute
 * URL.  If either URL is invalid the original `relative` value is returned
 * unchanged so that the caller can decide how to proceed.
 */
export function absolute(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

// ---------------------------------------------------------------------------
// Identifier generation
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic, *synchronous* identifier for a feed item. The
 * implementation prefers the Node.js `crypto` module (SHA-1, 160-bit; more
 * than sufficient for deduplication) and falls back to a quick 32-bit FNV-1a
 * hash in environments where `crypto` is unavailable (e.g. very old
 * browsers/tests without polyfills).
 *
 * The returned value is a lower-case hexadecimal string with **no prefix** so
 * it can be safely compared against <guid> or other IDs without additional
 * normalization.
 */
export function generateDeterministicItemId(input: string): string {
  // Try Node.js crypto when available *synchronously*.
  // Using a try/catch on a static ESM import keeps tree-shaking simple.
  /* c8 ignore start */
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('node:crypto');
    if (typeof crypto?.createHash === 'function') {
      return crypto.createHash('sha1').update(input).digest('hex');
    }
  } catch {
    // noop – will fall through to FNV-1a
  }
  /* c8 ignore stop */

  // FNV-1a 32-bit fallback (deterministic, fast, non-crypto-secure)
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * RFC-4122 v4 compliant but *non-cryptographically-secure* UUID.  Good enough
 * as a last-ditch fallback when the deterministic hash fails or collides.
 */
export function generateRandomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Determine if an item is visible based on read/deleted flags. */
export function isVisibleItem(item: RssFeedItem, showAll: boolean): boolean {
  if (showAll) return true;
  return item.read === '0' && item.deleted === '0';
}

// ---------------------------------------------------------------------------
// Misc utilities
// ---------------------------------------------------------------------------

/** Fisher-Yates shuffle.  Prioritizes determinism in tests by using Math.random(). */
export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ---------------------------------------------------------------------------
// Backwards-compat – keep the old name so existing imports don't break.
// ---------------------------------------------------------------------------

export const generateDeterministicItemIdSync = generateDeterministicItemId;

// ---------------------------------------------------------------------------
// Image URL helpers (centralised)
// ---------------------------------------------------------------------------

/**
 * Very small allow-list check to avoid XSS vectors such as
 * `javascript:alert(1)` via <img src>.
 *
 *  • Allows http/https URLs
 *  • Allows protocol-relative URLs (//example.com)
 *  • Rejects everything else (data:, javascript:, ftp:, relative paths…)
 */
export function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^(https?:)?\/\//i.test(trimmed);
}

/** What rss-parser may give us for media:thumbnail / enclosure etc. */
type ImageInput = string | { url?: string } | Array<string | { url?: string }> | undefined;

/**
 * Extract the first usable thumbnail URL from various RSS shapes.
 */
export function pickImageUrl(input: ImageInput): string | undefined {
  if (!input) return undefined;

  if (typeof input === 'string') {
    return isSafeImageUrl(input) ? input : undefined;
  }

  if (Array.isArray(input)) {
    // Prefer first string element
    const str = input.find(i => typeof i === 'string' && isSafeImageUrl(i)) as string | undefined;
    if (str) return str;

    // Fallback: first object with safe url property
    const obj = input.find(
      i =>
        typeof i === 'object' &&
        i !== null &&
        typeof (i as { url?: string }).url === 'string' &&
        isSafeImageUrl((i as { url: string }).url)
    );
    if (obj && typeof obj === 'object' && (obj as { url: string }).url)
      return (obj as { url: string }).url;
    return undefined;
  }

  if (typeof input === 'object' && input !== null && typeof input.url === 'string') {
    return isSafeImageUrl(input.url) ? input.url : undefined;
  }

  return undefined;
}
