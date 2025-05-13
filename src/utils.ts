import { URL } from 'url'; // Use Node.js URL module for robustness

/**
 * Resolves a relative URL against a base URL.
 * @param base The base URL.
 * @param relative The relative URL.
 * @returns The absolute URL, or the original relative URL if base is invalid or resolution fails.
 */
export function absolute(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative; // Fallback to relative if base is invalid or error occurs
  }
}
