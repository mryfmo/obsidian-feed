import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Context7Client } from '../context7';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    callTool: vi.fn()
  }))
}));

describe('Context7Client', () => {
  let context7: Context7Client;
  let mockClient: any;
  
  beforeEach(() => {
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      callTool: vi.fn()
    };
    
    vi.mocked(Client).mockImplementation(() => mockClient);
    context7 = new Context7Client();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await context7.initialize();
      
      expect(Client).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'context7-client',
          version: '1.0.0'
        }),
        expect.objectContaining({
          capabilities: {}
        })
      );
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(context7.initialize()).rejects.toThrow('Connection failed');
    });

    it('should only initialize once', async () => {
      await context7.initialize();
      await context7.initialize(); // Second call
      
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Library Resolution', () => {
    it('should resolve library names to IDs', async () => {
      mockClient.callTool.mockResolvedValue({
        library_id: 'react-18',
        resolved_name: 'react'
      });
      
      await context7.initialize();
      const result = await context7.getDocumentation('react');
      
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'resolve-library-id',
        arguments: { libraryName: 'react' }
      });
    });

    it('should handle scoped packages', async () => {
      mockClient.callTool
        .mockResolvedValueOnce({
          library_id: 'angular-core-15',
          resolved_name: '@angular/core'
        })
        .mockResolvedValueOnce({
          content: 'Angular documentation'
        });
      
      await context7.initialize();
      const result = await context7.getDocumentation('@angular/core');
      
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'resolve-library-id',
        arguments: { libraryName: '@angular/core' }
      });
    });

    it('should handle library resolution errors', async () => {
      mockClient.callTool.mockRejectedValue(new Error('Library not found'));
      
      await context7.initialize();
      await expect(context7.getDocumentation('unknown-lib')).rejects.toThrow('Library not found');
    });
  });

  describe('Documentation Fetching', () => {
    it('should fetch documentation for resolved libraries', async () => {
      mockClient.callTool
        .mockResolvedValueOnce({
          library_id: 'react-18',
          resolved_name: 'react'
        })
        .mockResolvedValueOnce({
          content: '# React Documentation\n\nReact is a JavaScript library...',
          metadata: {
            version: '18.2.0',
            lastUpdated: '2024-01-01'
          }
        });
      
      await context7.initialize();
      const result = await context7.getDocumentation('react');
      
      expect(result.content).toContain('# React Documentation');
      expect(result.version).toBe('18.2.0');
      expect(result.libraryId).toBe('react-18');
      
      // Check second call was for get-docs
      expect(mockClient.callTool).toHaveBeenNthCalledWith(2, {
        name: 'get-docs',
        arguments: {
          library_id: 'react-18',
          minimum_tokens: 10000
        }
      });
    });

    it('should use custom token limits', async () => {
      mockClient.callTool
        .mockResolvedValueOnce({
          library_id: 'vue-3',
          resolved_name: 'vue'
        })
        .mockResolvedValueOnce({
          content: 'Vue documentation'
        });
      
      await context7.initialize();
      const result = await context7.getDocumentation('vue', { minimumTokens: 5000 });
      
      expect(mockClient.callTool).toHaveBeenNthCalledWith(2, {
        name: 'get-docs',
        arguments: {
          library_id: 'vue-3',
          minimum_tokens: 5000
        }
      });
    });

    it('should handle empty documentation gracefully', async () => {
      mockClient.callTool
        .mockResolvedValueOnce({
          library_id: 'lib-1',
          resolved_name: 'lib'
        })
        .mockResolvedValueOnce({
          content: '',
          metadata: {}
        });
      
      await context7.initialize();
      const result = await context7.getDocumentation('lib');
      
      expect(result.content).toBe('');
      expect(result.version).toBeUndefined();
    });
  });

  describe('Caching', () => {
    it('should cache library ID resolutions', async () => {
      mockClient.callTool
        .mockResolvedValueOnce({
          library_id: 'lodash-4',
          resolved_name: 'lodash'
        })
        .mockResolvedValueOnce({
          content: 'Lodash docs 1'
        })
        .mockResolvedValueOnce({
          content: 'Lodash docs 2'
        });
      
      await context7.initialize();
      
      // First call
      await context7.getDocumentation('lodash');
      
      // Second call - should use cached library ID
      await context7.getDocumentation('lodash');
      
      // resolve-library-id should only be called once
      const resolveLibraryCalls = mockClient.callTool.mock.calls.filter(
        call => call[0].name === 'resolve-library-id'
      );
      expect(resolveLibraryCalls).toHaveLength(1);
      
      // get-docs should be called twice
      const getDocsCalls = mockClient.callTool.mock.calls.filter(
        call => call[0].name === 'get-docs'
      );
      expect(getDocsCalls).toHaveLength(2);
    });

    it('should not cache failed resolutions', async () => {
      mockClient.callTool
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          library_id: 'express-4',
          resolved_name: 'express'
        })
        .mockResolvedValueOnce({
          content: 'Express docs'
        });
      
      await context7.initialize();
      
      // First call fails
      await expect(context7.getDocumentation('express')).rejects.toThrow('Temporary error');
      
      // Second call succeeds
      const result = await context7.getDocumentation('express');
      expect(result.content).toBe('Express docs');
      
      // Should have tried to resolve twice
      const resolveLibraryCalls = mockClient.callTool.mock.calls.filter(
        call => call[0].name === 'resolve-library-id'
      );
      expect(resolveLibraryCalls).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      await expect(context7.getDocumentation('react')).rejects.toThrow('Context7 client not initialized');
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      (networkError as any).code = 'ETIMEDOUT';
      
      mockClient.callTool.mockRejectedValue(networkError);
      
      await context7.initialize();
      await expect(context7.getDocumentation('react')).rejects.toThrow('Network timeout');
    });

    it('should handle malformed responses', async () => {
      mockClient.callTool
        .mockResolvedValueOnce({
          // Missing library_id
          resolved_name: 'react'
        })
        .mockResolvedValueOnce({
          content: 'React docs'
        });
      
      await context7.initialize();
      await expect(context7.getDocumentation('react')).rejects.toThrow();
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent documentation requests', async () => {
      const libraries = ['react', 'vue', 'angular'];
      
      mockClient.callTool.mockImplementation(({ name, arguments: args }) => {
        if (name === 'resolve-library-id') {
          const lib = args.libraryName;
          return Promise.resolve({
            library_id: `${lib}-latest`,
            resolved_name: lib
          });
        } else {
          return Promise.resolve({
            content: `Documentation for ${args.library_id}`
          });
        }
      });
      
      await context7.initialize();
      
      const promises = libraries.map(lib => context7.getDocumentation(lib));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      expect(results[0].content).toContain('react-latest');
      expect(results[1].content).toContain('vue-latest');
      expect(results[2].content).toContain('angular-latest');
    });

    it('should handle mixed success/failure in concurrent requests', async () => {
      mockClient.callTool.mockImplementation(({ name, arguments: args }) => {
        if (name === 'resolve-library-id') {
          if (args.libraryName === 'fail-lib') {
            return Promise.reject(new Error('Library not found'));
          }
          return Promise.resolve({
            library_id: `${args.libraryName}-latest`,
            resolved_name: args.libraryName
          });
        } else {
          return Promise.resolve({
            content: `Documentation for ${args.library_id}`
          });
        }
      });
      
      await context7.initialize();
      
      const libraries = ['react', 'fail-lib', 'vue'];
      const promises = libraries.map(lib => 
        context7.getDocumentation(lib).catch(err => ({ error: err.message }))
      );
      
      const results = await Promise.all(promises);
      
      expect(results[0]).toHaveProperty('content');
      expect(results[1]).toHaveProperty('error', 'Library not found');
      expect(results[2]).toHaveProperty('content');
    });
  });

  describe('Options and Configuration', () => {
    it('should respect default minimum tokens', async () => {
      mockClient.callTool
        .mockResolvedValueOnce({
          library_id: 'test-lib',
          resolved_name: 'test'
        })
        .mockResolvedValueOnce({
          content: 'Test documentation'
        });
      
      await context7.initialize();
      await context7.getDocumentation('test');
      
      expect(mockClient.callTool).toHaveBeenNthCalledWith(2, {
        name: 'get-docs',
        arguments: {
          library_id: 'test-lib',
          minimum_tokens: 10000 // Default value
        }
      });
    });

    it('should allow overriding minimum tokens per request', async () => {
      mockClient.callTool
        .mockResolvedValueOnce({
          library_id: 'test-lib',
          resolved_name: 'test'
        })
        .mockResolvedValueOnce({
          content: 'Test documentation'
        });
      
      await context7.initialize();
      await context7.getDocumentation('test', { minimumTokens: 20000 });
      
      expect(mockClient.callTool).toHaveBeenNthCalledWith(2, {
        name: 'get-docs',
        arguments: {
          library_id: 'test-lib',
          minimum_tokens: 20000
        }
      });
    });
  });

  describe('Library Name Variations', () => {
    it('should handle different library name formats', async () => {
      const nameVariations = [
        'react',
        'React',
        'REACT',
        'react.js',
        'reactjs'
      ];
      
      mockClient.callTool.mockImplementation(({ name, arguments: args }) => {
        if (name === 'resolve-library-id') {
          return Promise.resolve({
            library_id: 'react-18',
            resolved_name: 'react'
          });
        }
        return Promise.resolve({ content: 'React docs' });
      });
      
      await context7.initialize();
      
      for (const variation of nameVariations) {
        const result = await context7.getDocumentation(variation);
        expect(result.libraryId).toBe('react-18');
      }
    });
  });
});