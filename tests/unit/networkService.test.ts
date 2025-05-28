import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { FileSystemAdapter, Stat } from 'obsidian';
import { NetworkService } from '../../src/networkService';
import { HTML_CACHE_DIR } from '../../src/constants';
import { FeedsReaderSettings } from '../../src/types';

// Mock the HTTP client's `get` method used by NetworkService.
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

// Mock the createHttpClient function from the correct path
vi.mock('../../src/network/httpClient', () => ({
  createHttpClient: vi.fn(() => ({ get: mockGet })), // Ensure createHttpClient itself is a mock function returning the mock Axios object
}));

// Minimal settings object
const settings: FeedsReaderSettings = {
  mixedFeedView: false,
  nItemPerPage: 10,
  saveContent: false,
  saveSnippetNewToOld: false,
  showJot: false,
  showSnippet: false,
  showRead: false,
  showSave: false,
  showMath: false,
  showGPT: false,
  showEmbed: false,
  showFetch: false,
  showLink: false,
  showDelete: false,
  showThumbnails: false,
  chatGPTApiKey: '',
  chatGPTPrompt: '',
  chatGPTModel: 'gpt-3.5-turbo',
  enableHtmlCache: true,
  htmlCacheDurationMinutes: 60,
  enableAssetDownload: false,
  assetDownloadPath: '',
  latestNOnly: false,
  latestNCount: 0,
  viewStyle: 'card',
};

const createAdapter = (): Mocked<FileSystemAdapter> =>
  ({
    exists: vi.fn(),
    mkdir: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
    stat: vi.fn(),
    remove: vi.fn(),
    rename: vi.fn(),
    copy: vi.fn(),
    getBasePath: vi.fn().mockReturnValue('/vault'),
  }) as unknown as Mocked<FileSystemAdapter>;

const url = 'http://example.com/page';

// Utility to compute cache path using private method
function getCachePath(service: NetworkService, url: string): string {
  return service.getCacheFilePath(url);
}

describe('NetworkService.fetchHtml', () => {
  let adapter: Mocked<FileSystemAdapter>;
  let service: NetworkService;
  let cacheBase: string;
  let cachePath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createAdapter();
    // NetworkService now creates its own httpClient using the mocked createHttpClient
    service = new NetworkService(adapter, settings, 'test-plugin');
    cacheBase = `/vault/.obsidian/plugins/test-plugin/${HTML_CACHE_DIR}`;
    cachePath = getCachePath(service, url);
  });

  it('reads from fresh cache without network call', async () => {
    adapter.exists.mockImplementation(async (p: string) => p === cacheBase || p === cachePath);
    adapter.stat.mockResolvedValue({
      mtime: Date.now(),
      ctime: Date.now(),
      size: 100,
      type: 'file',
    } as Stat);
    adapter.read.mockResolvedValue('cached');

    const html = await service.fetchHtml(url);

    expect(html).toBe('cached');
    expect(adapter.read).toHaveBeenCalledWith(cachePath);
    expect(mockGet).not.toHaveBeenCalled();
    expect(adapter.write).not.toHaveBeenCalled();
  });

  it('fetches and caches when stale', async () => {
    adapter.exists.mockImplementation(async (p: string) => p === cacheBase || p === cachePath);
    adapter.stat.mockResolvedValue({
      mtime: Date.now() - 61 * 60 * 1000,
      ctime: Date.now(),
      size: 100,
      type: 'file',
    } as Stat);
    mockGet.mockResolvedValue({ data: 'fresh' });

    const html = await service.fetchHtml(url);

    expect(mockGet).toHaveBeenCalled();
    expect(adapter.write).toHaveBeenCalledWith(cachePath, 'fresh');
    expect(html).toBe('fresh');
  });

  it('fetches and caches when file missing', async () => {
    adapter.exists.mockImplementation(async (p: string) => p === cacheBase);
    mockGet.mockResolvedValue({ data: 'fresh' });

    const html = await service.fetchHtml(url);

    expect(adapter.mkdir).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalled();
    expect(adapter.write).toHaveBeenCalledWith(cachePath, 'fresh');
    expect(html).toBe('fresh');
  });
});
