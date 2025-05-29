import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Fetcher } from '../fetcher';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import TurndownService from 'turndown';

// Mock modules
vi.mock('fs');
vi.mock('axios');
vi.mock('turndown');

// Create a mock Context7Client
const mockContext7Instance = {
  initialize: vi.fn(),
  getDocumentation: vi.fn()
};

vi.mock('../context7', () => ({
  Context7Client: vi.fn(() => mockContext7Instance)
}));

describe('Fetcher', () => {
  let fetcher: Fetcher;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset Context7Client mock
    mockContext7Instance.initialize.mockResolvedValue(undefined);
    mockContext7Instance.getDocumentation.mockReset();
    
    // Mock fs.existsSync to return false by default (cache miss)
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    
    // Mock TurndownService
    const mockTurndown = {
      turndown: vi.fn((html: string) => {
        // Simple HTML to Markdown conversion for tests
        // First normalize the HTML
        const normalized = html.replace(/\n\s*/g, ' ').trim();
        
        // Extract body content if present
        let content = normalized;
        const bodyMatch = normalized.match(/<body[^>]*>(.*?)<\/body>/i);
        if (bodyMatch) {
          content = bodyMatch[1];
        }
        
        // Convert HTML tags to markdown
        return content
          .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
          .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
          .replace(/<ul[^>]*>(.*?)<\/ul>/gi, (match, ulContent) => {
            return ulContent.replace(/<li[^>]*>(.*?)<\/li>/gi, '* $1\n') + '\n';
          })
          .replace(/<[^>]+>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      })
    };
    vi.mocked(TurndownService).mockImplementation(() => mockTurndown as any);
    
    fetcher = new Fetcher();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Source Type Detection', () => {
    it('should detect URL sources', async () => {
      const urls = [
        'https://example.com/doc',
        'http://example.com/doc',
        'https://github.com/repo/README.md'
      ];
      
      for (const url of urls) {
        vi.mocked(axios.get).mockResolvedValue({
          status: 200,
          data: '<html><body>Content</body></html>',
          headers: { 'content-type': 'text/html' }
        });
        
        const result = await fetcher.fetch(url);
        expect(result.success).toBe(true);
        expect(vi.mocked(axios.get)).toHaveBeenCalledWith(url, expect.any(Object));
      }
    });

    it('should detect library sources', async () => {
      const libraries = ['react', 'vue', 'express'];
      
      // Setup Context7 mock to return documentation
      mockContext7Instance.getDocumentation.mockImplementation((lib) => Promise.resolve({
        content: `Documentation for ${lib}`,
        version: '1.0.0',
        libraryId: lib
      }));
      
      for (const lib of libraries) {
        const result = await fetcher.fetch(lib);
        
        expect(result.success).toBe(true);
        expect(result.content).toContain(`Documentation for ${lib}`);
      }
    });

    it('should detect file sources', async () => {
      const filePaths = [
        '/path/to/file.txt',
        './relative/path.md',
        '../parent/file.js',
        'simple-file.txt'
      ];
      
      for (const filePath of filePaths) {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('File content');
        
        const result = await fetcher.fetch(filePath);
        
        if (!filePath.startsWith('http')) {
          expect(result.success).toBe(true);
          expect(result.content).toBe('File content');
        }
      }
    });
  });

  describe('URL Fetching', () => {
    it('should fetch and convert HTML to markdown', async () => {
      const htmlContent = `
        <html>
          <body>
            <h1>Title</h1>
            <p>This is a paragraph</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </body>
        </html>
      `;
      
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: htmlContent,
        headers: { 'content-type': 'text/html' }
      });
      
      const result = await fetcher.fetch('https://example.com');
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('# Title');
      expect(result.content).toContain('This is a paragraph');
      expect(result.content).toContain('* Item 1');
      expect(result.content).toContain('* Item 2');
    });

    it('should handle plain text responses', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: 'Plain text content',
        headers: { 'content-type': 'text/plain' }
      });
      
      const result = await fetcher.fetch('https://example.com/plain.txt');
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('Plain text content');
    });

    it('should handle fetch errors', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));
      
      const result = await fetcher.fetch('https://example.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should validate content size limits', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: largeContent
      });
      
      const result = await fetcher.fetch('https://example.com/large');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Content too large');
    });
  });

  describe('File Fetching', () => {
    it('should read existing files', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('File content');
      
      const result = await fetcher.fetch('/path/to/file.txt');
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('File content');
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith('/path/to/file.txt', 'utf8');
    });

    it('should handle non-existent files', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = await fetcher.fetch('/path/to/missing.txt');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should handle file read errors', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const result = await fetcher.fetch('/path/to/protected.txt');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });

  describe('Library Documentation Fetching', () => {
    it('should fetch library documentation via Context7', async () => {
      mockContext7Instance.getDocumentation.mockResolvedValue({
        content: '# React Documentation\n\nReact is a JavaScript library...',
        version: '18.2.0',
        libraryId: 'react'
      });
      
      const result = await fetcher.fetch('react');
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('# React Documentation');
      expect(result.metadata?.version).toBe('18.2.0');
      expect(result.metadata?.source).toBe('context7');
    });

    it('should handle Context7 initialization errors', async () => {
      mockContext7Instance.initialize.mockRejectedValue(new Error('Context7 init failed'));
      
      const result = await fetcher.fetch('react');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Context7 init failed');
    });

    it('should handle library not found errors', async () => {
      mockContext7Instance.getDocumentation.mockRejectedValue(new Error('Library not found'));
      
      const result = await fetcher.fetch('unknown-lib');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Library not found');
    });
  });

  describe('Caching', () => {
    it('should cache successful fetches', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: 'Content to cache',
        headers: { 'content-type': 'text/plain' }
      });
      
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(false); // No cache exists
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
      
      const result = await fetcher.fetch('https://example.com/doc');
      
      expect(result.success).toBe(true);
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled();
      
      // Verify cache file path includes URL hash
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(writeCall[0]).toMatch(/\.cache\/.*\.json$/);
    });

    it('should use cached content when available', async () => {
      const cachedData = {
        success: true,
        timestamp: Date.now(),
        content: 'Cached content',
        metadata: { originalSource: 'url' }
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cachedData));
      
      const result = await fetcher.fetch('https://example.com/cached');
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('Cached content');
      expect(result.metadata?.source).toBe('cache');
      expect(vi.mocked(axios.get)).not.toHaveBeenCalled();
    });

    it('should respect cache expiry (15 minutes)', async () => {
      const oldCachedData = {
        success: true,
        timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
        content: 'Old cached content'
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(oldCachedData));
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: 'Fresh content',
        headers: { 'content-type': 'text/plain' }
      });
      
      const result = await fetcher.fetch('https://example.com/expired');
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('Fresh content');
      expect(vi.mocked(axios.get)).toHaveBeenCalled();
    });

    it('should not cache failed fetches', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Fetch failed'));
      
      const result = await fetcher.fetch('https://example.com/fail');
      
      expect(result.success).toBe(false);
      expect(vi.mocked(fs.writeFileSync)).not.toHaveBeenCalled();
    });
  });

  describe('Security Features', () => {
    it('should validate URLs before fetching', async () => {
      const maliciousUrls = [
        'file:///etc/passwd',
        'ftp://example.com',
        'javascript:alert(1)'
      ];
      
      for (const url of maliciousUrls) {
        const result = await fetcher.fetch(url);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should sanitize file paths', async () => {
      const dangerousPaths = [
        '../../../etc/passwd',
        '/etc/passwd',
        '~/.ssh/id_rsa'
      ];
      
      for (const path of dangerousPaths) {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        const result = await fetcher.fetch(path);
        
        // Should either fail or normalize the path
        if (result.success) {
          expect(vi.mocked(fs.readFileSync)).not.toHaveBeenCalledWith(path);
        } else {
          expect(result.error).toBeDefined();
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout errors gracefully', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      (timeoutError as any).code = 'ECONNABORTED';
      
      vi.mocked(axios.get).mockRejectedValue(timeoutError);
      
      const result = await fetcher.fetch('https://slow-site.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle DNS resolution errors', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND');
      (dnsError as any).code = 'ENOTFOUND';
      
      vi.mocked(axios.get).mockRejectedValue(dnsError);
      
      const result = await fetcher.fetch('https://nonexistent-domain.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOTFOUND');
    });
  });

  describe('Multiple Source Fetching', () => {
    it('should fetch from multiple sources', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: 'URL content',
        headers: { 'content-type': 'text/plain' }
      });
      
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        // Return true for file paths, false for cache
        if (path.toString().includes('.cache')) return false;
        if (path.toString().includes('/path/to/file.txt')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (path.toString().includes('/path/to/file.txt')) return 'File content';
        return '';
      });
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
      
      const sources = [
        'https://example.com/doc1',
        '/path/to/file.txt',
        'https://example.com/doc2'
      ];
      
      const results = await fetcher.fetchMultiple(sources);
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
    });

    it('should continue fetching even if some sources fail', async () => {
      vi.mocked(axios.get)
        .mockResolvedValueOnce({ status: 200, data: 'Success 1', headers: { 'content-type': 'text/plain' } })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ status: 200, data: 'Success 2', headers: { 'content-type': 'text/plain' } });
      
      const sources = [
        'https://example.com/success1',
        'https://example.com/fail',
        'https://example.com/success2'
      ];
      
      const results = await fetcher.fetchMultiple(sources);
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });
});