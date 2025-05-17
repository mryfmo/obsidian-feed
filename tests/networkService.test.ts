import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkService } from '../src/networkService';
import { HTML_CACHE_DIR } from '../src/constants';

// Mock the HTTP client used internally by NetworkService
const mockGet = vi.fn();
vi.mock('../src/network/httpClient', () => ({
  createHttpClient: () => ({ get: mockGet })
}));

// Minimal settings object
const settings = { enableHtmlCache: true, htmlCacheDurationMinutes: 60 } as any;

const createAdapter = () => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  stat: vi.fn(),
  getBasePath: vi.fn().mockReturnValue('/vault'),
});

const url = 'http://example.com/page';

// Utility to compute cache path using private method
function getCachePath(service: NetworkService, url: string): string {
  return (service as any).getCacheFilePath(url);
}

describe('NetworkService.fetchHtml', () => {
  let adapter: ReturnType<typeof createAdapter>;
  let service: NetworkService;
  let cacheBase: string;
  let cachePath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createAdapter();
    service = new NetworkService(adapter as any, settings, 'test-plugin');
    cacheBase = '/vault/.obsidian/plugins/test-plugin/' + HTML_CACHE_DIR;
    cachePath = getCachePath(service, url);
  });

  it('reads from fresh cache without network call', async () => {
    adapter.exists.mockImplementation(async (p: string) => p === cacheBase || p === cachePath);
    adapter.stat.mockResolvedValue({ mtime: Date.now() });
    adapter.read.mockResolvedValue('cached');

    const html = await service.fetchHtml(url);

    expect(html).toBe('cached');
    expect(adapter.read).toHaveBeenCalledWith(cachePath);
    expect(mockGet).not.toHaveBeenCalled();
    expect(adapter.write).not.toHaveBeenCalled();
  });

  it('fetches and caches when stale', async () => {
    adapter.exists.mockImplementation(async (p: string) => p === cacheBase || p === cachePath);
    adapter.stat.mockResolvedValue({ mtime: Date.now() - 61 * 60 * 1000 });
    mockGet.mockResolvedValue({ data: 'fresh' });

    const html = await service.fetchHtml(url);

    expect(mockGet).toHaveBeenCalled();
    expect(adapter.write).toHaveBeenCalledWith(cachePath, 'fresh');
    expect(html).toBe('fresh');
  });

  it('fetches and caches when file missing', async () => {
    adapter.exists.mockImplementation(async (p: string) => p === cacheBase ? true : false);
    mockGet.mockResolvedValue({ data: 'fresh' });

    const html = await service.fetchHtml(url);

    expect(adapter.mkdir).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalled();
    expect(adapter.write).toHaveBeenCalledWith(cachePath, 'fresh');
    expect(html).toBe('fresh');
  });
});
