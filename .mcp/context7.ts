/**
 * Context7 Client - Simplified version for library documentation
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export interface LibraryDoc {
  content: string;
  version?: string;
  libraryId?: string;
}

export interface GetDocumentationOptions {
  minimumTokens?: number;
}

export class Context7Client {
  private client: Client | null = null;
  private libraryCache: Map<string, string> = new Map();

  async initialize(): Promise<void> {
    if (this.client) return;

    this.client = new Client(
      { 
        name: 'context7-client',
        version: '1.0.0'
      },
      { capabilities: {} }
    );

    await this.client.connect({
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
      env: {
        ...process.env,
        DEFAULT_MINIMUM_TOKENS: '10000'
      }
    } as any);
  }

  async getDocumentation(libraryName: string, options?: GetDocumentationOptions): Promise<LibraryDoc> {
    if (!this.client) {
      throw new Error('Context7 client not initialized');
    }

    try {
      // Check cache for library ID
      let libraryId = this.libraryCache.get(libraryName);
      
      if (!libraryId) {
        // Resolve library ID
        const resolveResult = await this.client.callTool({
          name: 'resolve-library-id',
          arguments: { libraryName: libraryName }
        }) as any;

        if (!resolveResult.library_id) {
          throw new Error('Failed to resolve library ID');
        }
        
        libraryId = resolveResult.library_id;
        this.libraryCache.set(libraryName, libraryId);
      }

      // Fetch documentation
      const docsResult = await this.client.callTool({
        name: 'get-docs',
        arguments: {
          library_id: libraryId,
          minimum_tokens: options?.minimumTokens || 10000
        }
      }) as any;

      return {
        content: docsResult.content || '',
        version: docsResult.metadata?.version,
        libraryId: libraryId
      };
    } catch (error: any) {
      throw error;
    }
  }

  async fetchLibraryDoc(
    libraryName: string,
    options?: { topic?: string; tokens?: number }
  ): Promise<LibraryDoc | null> {
    try {
      const result = await this.getDocumentation(libraryName, {
        minimumTokens: options?.tokens
      });
      return {
        content: result.content,
        version: result.version || 'unknown',
        libraryId: result.libraryId
      };
    } catch (error) {
      console.error(`Context7 error: ${error}`);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close?.();
      this.client = null;
    }
  }

  static isLibrarySource(source: string): boolean {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return false;
    }
    
    return /^(@[a-z0-9-]+\/)?[a-z0-9-]+$/.test(source);
  }
}