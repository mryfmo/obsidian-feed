/**
 * Enhanced fetcher - Complete implementation with MCP integration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import TurndownService from 'turndown';
import { Context7Client } from './context7';

export interface FetchResult {
  success: boolean;
  content?: string;
  error?: string;
  timestamp?: number;
  metadata?: {
    source?: string;
    version?: string;
    timestamp?: number;
    url?: string;
    path?: string;
    libraryId?: string;
    [key: string]: string | number | boolean | undefined;
  };
}

export class Fetcher {
  private cacheDir = '.cache/fetch';

  private context7?: Context7Client;

  private mcpClients?: {
    filesystem?: {
      read_file: (params: { path: string }) => Promise<{ content: string }>;
    };
    github?: unknown;
    memory?: unknown;
    fetch?: unknown;
  };

  private turndown: TurndownService;

  private cacheExpiry = 15 * 60 * 1000; // 15 minutes

  constructor(mcpClients?: {
    filesystem?: {
      read_file: (params: { path: string }) => Promise<{ content: string }>;
    };
    github?: unknown;
    memory?: unknown;
    fetch?: unknown;
  }) {
    this.mcpClients = mcpClients;
    this.turndown = new TurndownService();
    this.ensureCacheDir();
  }

  async fetch(source: string): Promise<FetchResult> {
    try {
      // Determine source type
      const sourceType = this.detectSourceType(source);

      switch (sourceType) {
        case 'library':
          return await this.fetchLibrary(source);
        case 'url':
          return await this.fetchUrl(source);
        case 'file':
          return await this.fetchFile(source);
        default:
          return { success: false, error: `Unknown source type: ${source}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async fetchMultiple(sources: string[]): Promise<FetchResult[]> {
    // Process sources in batches while preserving order
    const concurrencyLimit = 5;
    const results: FetchResult[] = [];

    for (let i = 0; i < sources.length; i += concurrencyLimit) {
      const batch = sources.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(batch.map(source => this.fetch(source)));
      results.push(...batchResults);
    }

    return results;
  }

  private detectSourceType(source: string): 'library' | 'url' | 'file' {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return 'url';
    }
    if (this.isLibrary(source)) {
      return 'library';
    }
    return 'file';
  }

  private isLibrary(source: string): boolean {
    // Common JS/TS libraries
    const knownLibraries = ['react', 'vue', 'express', 'axios', 'lodash', 'typescript'];
    const isKnown =
      knownLibraries.includes(source) ||
      knownLibraries.some(lib => source.startsWith(`${lib}/`) || source.startsWith(`@${lib}/`));

    // Package name pattern
    const isPackagePattern =
      /^(@?[a-z0-9-]+\/)?[a-z0-9-]+$/i.test(source) &&
      !source.includes('.') &&
      !source.includes('/') &&
      !source.includes('\\');

    return isKnown || isPackagePattern;
  }

  private async fetchLibrary(libraryName: string): Promise<FetchResult> {
    try {
      // Initialize Context7 if not already done
      if (!this.context7) {
        this.context7 = new Context7Client();
        await this.context7.initialize();
      }

      const doc = await this.context7.getDocumentation(libraryName);
      return {
        success: true,
        content: doc.content,
        metadata: {
          source: 'context7',
          version: doc.version,
          libraryId: doc.libraryId,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async fetchUrl(url: string): Promise<FetchResult> {
    // Validate URL protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { success: false, error: 'Invalid URL protocol' };
    }

    // Check cache first
    const cached = await this.checkCache(url);
    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get(url, {
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024, // 10MB
        responseType: 'text',
        validateStatus: status => status === 200,
      });

      // Check content size
      const contentSize = response.data.length;
      if (contentSize > 10 * 1024 * 1024) {
        return { success: false, error: 'Content too large (> 10MB)' };
      }

      // Convert HTML to markdown if needed
      let content = response.data;
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        content = this.turndown.turndown(content);
      }

      const result: FetchResult = {
        success: true,
        content,
        metadata: {
          source: 'url',
          url,
          timestamp: Date.now(),
        },
      };

      // Cache the result
      await this.saveCache(url, result);

      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async fetchFile(filePath: string): Promise<FetchResult> {
    try {
      // Try MCP filesystem server first if available
      if (this.mcpClients?.filesystem) {
        try {
          const result = await this.mcpClients.filesystem.read_file({
            path: filePath,
          });
          return {
            success: true,
            content: result.content,
            metadata: {
              source: 'mcp-filesystem',
              path: filePath,
            },
          };
        } catch (mcpError) {
          console.warn('MCP filesystem read failed, falling back to fs:', mcpError);
        }
      }

      // Fallback to direct fs access
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }

      const content = fs.readFileSync(filePath, 'utf8');
      return {
        success: true,
        content,
        metadata: {
          source: 'file',
          path: filePath,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private getCacheKey(identifier: string): string {
    const hash = crypto.createHash('sha256').update(identifier).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  private async checkCache(identifier: string): Promise<FetchResult | null> {
    const cacheKey = this.getCacheKey(identifier);

    if (!fs.existsSync(cacheKey)) {
      return null;
    }

    try {
      const cached = JSON.parse(fs.readFileSync(cacheKey, 'utf8'));

      // Check if cache is expired
      if (cached.timestamp && Date.now() - cached.timestamp > this.cacheExpiry) {
        return null;
      }

      // Return cached result with cache flag
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          source: 'cache',
        },
      };
    } catch {
      return null;
    }
  }

  private async saveCache(identifier: string, result: FetchResult): Promise<void> {
    if (!result.success) {
      return; // Don't cache failures
    }

    const cacheKey = this.getCacheKey(identifier);
    const cacheData = {
      ...result,
      timestamp: Date.now(),
    };

    try {
      fs.writeFileSync(cacheKey, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn('Failed to save cache:', error);
    }
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
}
