import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  absolute,
  generateDeterministicItemId,
  generateRandomUUID,
  isSafeImageUrl,
  pickImageUrl,
  shuffleArray,
} from '../../src/utils';

describe('utils.ts', () => {
  describe('absolute()', () => {
    it('resolves a relative path against a base', () => {
      const base = 'https://example.com/post/';
      const rel  = '../img/pic.png';
      expect(absolute(base, rel)).toBe('https://example.com/img/pic.png');
    });

    it('returns the original string when URL is invalid', () => {
      expect(absolute('not a url', '???')).toBe('???');
    });
  });

  describe('generateDeterministicItemId()', () => {
    it('returns same output for same input', () => {
      const a = generateDeterministicItemId('hello world');
      const b = generateDeterministicItemId('hello world');
      expect(a).toBe(b);
    });

    it('returns different output for different input', () => {
      const a = generateDeterministicItemId('hello');
      const b = generateDeterministicItemId('world');
      expect(a).not.toBe(b);
    });
  });

  describe('generateRandomUUID()', () => {
    it('generates RFC-4122 v4 like UUID', () => {
      const uuid = generateRandomUUID();
      // Basic pattern check: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (y = 8..b)
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('isSafeImageUrl()', () => {
    it('accepts http/https URLs', () => {
      expect(isSafeImageUrl('http://site.com/x.png')).toBe(true);
      expect(isSafeImageUrl('https://site.com/x.png')).toBe(true);
    });

    it('rejects data: and javascript: schemes', () => {
      expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeImageUrl('data:image/png;base64,AAA')).toBe(false);
    });
  });

  describe('pickImageUrl()', () => {
    it('returns first safe string in array', () => {
      const arr = ['javascript:alert(1)', 'https://good.com/a.jpg'];
      expect(pickImageUrl(arr)).toBe('https://good.com/a.jpg');
    });

    it('extracts url property from object', () => {
      const obj = { url: 'https://good.com/b.jpg' };
      expect(pickImageUrl(obj)).toBe(obj.url);
    });

    it('returns undefined when nothing matches', () => {
      expect(pickImageUrl(['relative/path.jpg'])).toBeUndefined();
    });
  });

  describe('shuffleArray()', () => {
    // Shuffle uses Math.random, so stub it for determinism.
    const numbers = [1, 2, 3, 4, 5];

    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // fixed value
    });

    it('shuffles in-place and keeps all elements', () => {
      const result = shuffleArray([...numbers]);
      expect(result.sort()).toEqual(numbers);
    });
  });
});
