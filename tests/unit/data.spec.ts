import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { App, Vault, FileStats } from 'obsidian';
import { loadSubscriptions, compress, decompress } from '../../src/data';
import { SUBSCRIPTIONS_FNAME } from '../../src/constants';

import type { FeedInfo } from '../../src/types';

/* ========================================================================== */
/*                                   Mocks                                    */
/* ========================================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockAdapter = (): any => ({
  exists: vi.fn(),
  read: vi.fn(),
  write: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readBinary: vi.fn(),
  writeBinary: vi.fn(),
  remove: vi.fn(),
  rmdir: vi.fn(),
  list: vi.fn(),
  getName: vi.fn().mockReturnValue('MockAdapter'),
  stat: vi.fn().mockResolvedValue({} as FileStats),
  append: vi.fn().mockResolvedValue(undefined),
  process: vi.fn().mockImplementation(async (_path, fn) => fn('')),
  getResourcePath: vi.fn().mockReturnValue(''),
  trashSystem: vi.fn().mockResolvedValue(true),
  trashLocal: vi.fn().mockResolvedValue(undefined),
  copy: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
});

const mockVault = { adapter: createMockAdapter() } as unknown as Vault;
const mockApp = { vault: mockVault } as unknown as App;

const SUBS_PATH = `plugins/obsidian-feed/${SUBSCRIPTIONS_FNAME}`;

/* ========================================================================== */
/*                                    Tests                                   */
/* ========================================================================== */

describe('Data Management', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Re-assign adapter in mockVault to get fresh mocks for each test, if methods are called on mockVault.adapter directly
    mockVault.adapter = createMockAdapter();
  });

  it('round-trips a string through gzip compression', async () => {
    const original = 'こんにちは、世界! Hello World!';
    const zipped = compress(original);
    const plain = decompress(zipped);
    expect(plain).toBe(original);
  });

  describe('loadSubscriptions()', () => {
    it('returns an empty list when the file is missing', async () => {
      (mockVault.adapter.exists as Mock).mockResolvedValue(false);
      const list = await loadSubscriptions(mockApp, SUBS_PATH, 'feeds-store');
      expect(list).toEqual([]);
      expect(mockVault.adapter.read).not.toHaveBeenCalled();
    });

    it('loads and parses subscriptions from a valid JSON file', async () => {
      const example: FeedInfo[] = [
        {
          name: 'feed1',
          feedUrl: 'http://example.com/feed1.rss',
          folder: 'feeds-store/feed1',
          unread: 0,
          updated: Date.now(),
        },
        {
          name: 'feed2',
          feedUrl: 'https://example.org/feed2.xml',
          folder: 'feeds-store/feed2',
          unread: 0,
          updated: Date.now(),
        },
      ];

      (mockVault.adapter.exists as Mock).mockResolvedValue(true);
      (mockVault.adapter.read as Mock).mockResolvedValue(JSON.stringify(example));

      const list = await loadSubscriptions(mockApp, SUBS_PATH, 'feeds-store');
      expect(list).toEqual(example);
      expect(mockVault.adapter.exists).toHaveBeenCalledWith(SUBS_PATH);
      expect(mockVault.adapter.read).toHaveBeenCalledWith(SUBS_PATH);
    });

    it('returns an empty list and shows a notice on malformed JSON', async () => {
      (mockVault.adapter.exists as Mock).mockResolvedValue(true);
      (mockVault.adapter.read as Mock).mockResolvedValue('{ this is not valid json }');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const list = await loadSubscriptions(mockApp, SUBS_PATH, 'feeds-store');

      expect(list).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
