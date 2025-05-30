/**
 * MCP Clients - Creates and manages connections to official MCP servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Context7Client } from './context7';

export interface MCPClients {
  filesystem?: any;
  github?: any;
  git?: any;
  memory?: any;
  sequentialThinking?: any;
  fetch?: any;
  context7?: Context7Client;
}

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

const MCP_SERVERS: Record<string, MCPServerConfig> = {
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
  },
  github: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || ''
    }
  },
  // git server removed - package doesn't exist in npm
  memory: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory']
  },
  'sequential-thinking': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
  },
  // fetch server removed - requires Python uvx command
};

export async function createMCPClients(): Promise<MCPClients> {
  const clients: MCPClients = {};
  
  // Try to connect to each server
  for (const [name, config] of Object.entries(MCP_SERVERS)) {
    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env ? { ...process.env, ...config.env } : process.env
      });
      
      const client = new Client(
        { 
          name: `${name}-client`,
          version: '1.0.0'
        },
        { capabilities: {} }
      );
      
      await client.connect(transport);
      
      // Map to appropriate property name
      const propertyName = name === 'sequential-thinking' ? 'sequentialThinking' : name;
      clients[propertyName as keyof MCPClients] = client;
      
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
  for (const [name, client] of Object.entries(clients)) {
    if (client) {
      try {
        if (name === 'context7') {
          await client.disconnect();
        } else {
          await client.close();
        }
      } catch (error) {
        console.warn(`Failed to close ${name}:`, error);
      }
    }
  }
}