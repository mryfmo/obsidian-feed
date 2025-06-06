import { FileSystemAdapter } from 'obsidian';
import axios from 'axios';
import { FeedsReaderSettings } from './types';
import { safeGetPluginFeedsReaderDir, safePathJoin } from './pathUtils';
import { HTML_CACHE_DIR } from './constants';
import { createHttpClient } from './network/httpClient';
import { NetworkError } from './network/NetworkError';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const ACCEPT =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
const AXIOS_TIMEOUT = 15000; // 15 seconds timeout
const http = createHttpClient();

/**
 * This service will be responsible for fetching HTML content from URLs
 * and managing a local cache for these HTML responses.
 */
export class NetworkService {
  private cacheBasePath: string;

  constructor(
    private adapter: FileSystemAdapter,
    private settings: FeedsReaderSettings,
    private pluginId: string
  ) {
    const pluginDataDir = safeGetPluginFeedsReaderDir(this.pluginId, this.adapter.getBasePath());
    this.cacheBasePath = safePathJoin(pluginDataDir, HTML_CACHE_DIR);
  }

  public getCacheFilePath(url: string): string {
    // Simple hash for filename. Consider more robust hashing if needed.
    const hashedUrl = this.simpleHash(url);
    return safePathJoin(this.cacheBasePath, `${hashedUrl}.html`);
  }

  async fetchHtml(url: string, forceNoCache: boolean = false): Promise<string | null> {
    if (!this.settings.enableHtmlCache || forceNoCache) {
      return this.fetchWithHttp(url);
    }

    if (!(await this.adapter.exists(this.cacheBasePath))) {
      await this.adapter.mkdir(this.cacheBasePath);
    }

    const cachePath = this.getCacheFilePath(url);
    try {
      if (await this.adapter.exists(cachePath)) {
        const stats = await this.adapter.stat(cachePath);
        const cacheAgeMinutes = (Date.now() - (stats?.mtime || 0)) / (1000 * 60);
        if (cacheAgeMinutes < (this.settings.htmlCacheDurationMinutes ?? 1440)) {
          // Debug: Serving HTML from cache
          return await this.adapter.read(cachePath);
        }
        // Debug: Cache expired, fetching fresh content
      }
    } catch (e) {
      console.warn(
        `NetworkService: Error accessing cache for ${url}. Fetching directly. Error:`,
        e
      );
    }

    const html = await this.fetchWithHttp(url);
    if (html) {
      try {
        await this.adapter.write(cachePath, html);
        // Debug: Cached HTML
      } catch (e) {
        console.error(`NetworkService: Failed to write HTML to cache for ${url}. Error:`, e);
      }
    }
    return html;
  }

  async fetchText(url: string): Promise<string> {
    // Public method for fetching text
    return (await this.fetchWithHttp(url)) ?? ''; // Return empty string if null
  }

  async fetchBinary(url: string): Promise<ArrayBuffer | null> {
    try {
      // Debug: Fetching binary with axios
      const response = await http.get<ArrayBuffer>(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: ACCEPT }, // Keep it simple for binary files
        timeout: AXIOS_TIMEOUT * 2, // Allow longer timeout for potentially large assets
        responseType: 'arraybuffer',
      });
      return response.data;
    } catch (error: unknown) {
      console.error(`NetworkService: Error fetching binary URL ${url}:`, error);
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      // Cast to Error to access message property safely
      const message = error instanceof Error ? error.message : String(error);
      throw new NetworkError(`Failed to fetch binary ${url}. ${message}`, status);
    }
  }

  // Internal method using http client
  private async fetchWithHttp(url: string): Promise<string | null> {
    try {
      // Debug: Fetching with http
      const response = await http.get<string>(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: ACCEPT },
        timeout: AXIOS_TIMEOUT,
        responseType: 'text', // Ensure response is treated as text
      });
      return response.data;
    } catch (error: unknown) {
      console.error(`NetworkService: Error fetching URL ${url}:`, error);
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      // Cast to Error to access message property safely
      const message = error instanceof Error ? error.message : String(error);
      throw new NetworkError(`Failed to fetch ${url}. ${message}`, status); // Throw custom network error
    }
  }

  // Simple hash function (non-cryptographic)

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      const char = str.charCodeAt(i);
      // eslint-disable-next-line no-bitwise
      hash = (hash << 5) - hash + char;
      // eslint-disable-next-line no-bitwise
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

// Interface for external use if needed, defining the public contract
export interface INetworkService {
  fetchHtml(url: string, forceNoCache?: boolean): Promise<string | null>;
  fetchText(url: string): Promise<string>;
}
