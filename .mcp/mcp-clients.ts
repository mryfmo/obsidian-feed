/**
 * MCP Clients - Creates and manages connections to official MCP servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Context7Client } from './context7';
import type { MCPClients } from './index';

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

const MCP_SERVERS: Record<string, MCPServerConfig> = {
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
  },
  github: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '',
    },
  },
  // git server removed - package doesn't exist in npm
  memory: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  'sequential-thinking': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
  },
  // fetch server removed - requires Python uvx command
};

// Store raw clients for cleanup
const rawClients = new Map<string, Client>();

export async function createMCPClients(): Promise<MCPClients> {
  const clients: MCPClients = {};

  // Try to connect to each server
  for (const [name, config] of Object.entries(MCP_SERVERS)) {
    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env
          ? ({ ...process.env, ...config.env } as Record<string, string>)
          : (process.env as Record<string, string>),
      });

      const client = new Client(
        {
          name: `${name}-client`,
          version: '1.0.0',
        },
        { capabilities: {} }
      );

      await client.connect(transport);

      // Store raw client for cleanup
      rawClients.set(name, client);

      // Create wrapped clients with the expected interface
      switch (name) {
        case 'filesystem':
          clients.filesystem = {
            read_file: async (params: { path: string }) => {
              return (await client.callTool({ name: 'read_file', arguments: params })) as {
                content: string;
              };
            },
          };
          break;

        case 'github':
          clients.github = {
            add_labels: async params => {
              await client.callTool({ name: 'add_labels', arguments: params });
            },
            remove_labels: async params => {
              await client.callTool({ name: 'remove_labels', arguments: params });
            },
            get_issue: async params => {
              return (await client.callTool({ name: 'get_issue', arguments: params })) as {
                labels?: Array<string | { name: string }>;
              };
            },
          };
          break;

        case 'memory':
          clients.memory = {
            store: async params => {
              await client.callTool({ name: 'store', arguments: params });
            },
            retrieve: async params => {
              return client.callTool({ name: 'retrieve', arguments: params });
            },
          };
          break;

        case 'sequential-thinking':
          clients.sequentialThinking = {
            analyze: async params => {
              return (await client.callTool({ name: 'analyze', arguments: params })) as {
                success: boolean;
                insights: string[];
                recommendations: string[];
                warnings?: string[];
              };
            },
          };
          break;

        default:
          // Skip unknown server types
          break;
      }

      console.log(`✅ Connected to ${name} MCP server`);
    } catch (error) {
      console.warn(`⚠️  Failed to connect to ${name} MCP server:`, error);
    }
  }

  // Try to connect Context7
  try {
    const context7 = new Context7Client();
    // Context7Client doesn't have a connect method - it's initialized on construction
    clients.context7 = context7;
    console.log('✅ Context7 client initialized');
  } catch (error) {
    console.warn('⚠️  Failed to initialize Context7:', error);
  }

  return clients;
}

export async function closeMCPClients(clients: MCPClients): Promise<void> {
  // Close raw MCP clients
  for (const [name, client] of rawClients.entries()) {
    try {
      await client.close();
    } catch (error) {
      console.warn(`Failed to close ${name}:`, error);
    }
  }
  rawClients.clear();

  // Close context7 if present
  if (
    clients.context7 &&
    typeof clients.context7 === 'object' &&
    'disconnect' in clients.context7
  ) {
    try {
      await (clients.context7 as Context7Client).disconnect();
    } catch (error) {
      console.warn('Failed to close context7:', error);
    }
  }
}
