/**
 * MCP Integration for {{PROJECT_NAME}}
 * Type: {{PROJECT_TYPE}}
 * Version: 1.0.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { OperationGuard } from './operation-guard.js';
import { promises as fs } from 'fs';
import path from 'path';

// Project-specific imports
{{PROJECT_IMPORTS}}

interface IntegrationConfig {
  projectName: string;
  projectType: string;
  safetyLevel: 'strict' | 'normal' | 'relaxed';
  auditLog: string;
}

class {{PROJECT_NAME}}MCPServer {
  private server: Server;
  private operationGuard: OperationGuard;
  private config: IntegrationConfig;

  constructor() {
    this.config = {
      projectName: '{{PROJECT_NAME}}',
      projectType: '{{PROJECT_TYPE}}',
      safetyLevel: 'strict',
      auditLog: '.claude/runtime/audit.log'
    };

    this.server = new Server(
      {
        name: '{{PROJECT_NAME}}-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.operationGuard = new OperationGuard();
    this.setupHandlers();
    this.setupTools();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'read_file',
          description: 'Read a file with safety checks',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path to read' },
            },
            required: ['path'],
          },
        },
        {
          name: 'write_file',
          description: 'Write a file with safety checks',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path to write' },
              content: { type: 'string', description: 'Content to write' },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'delete_file',
          description: 'Delete a file with safety checks and confirmation',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path to delete' },
              reason: { type: 'string', description: 'Reason for deletion' },
            },
            required: ['path', 'reason'],
          },
        },
        // Project-specific tools
        {{PROJECT_TOOLS}}
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'read_file':
            return await this.readFile(args);
          case 'write_file':
            return await this.writeFile(args);
          case 'delete_file':
            return await this.deleteFile(args);
          {{PROJECT_TOOL_HANDLERS}}
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error}`
        );
      }
    });
  }

  private setupTools(): void {
    // Setup project-specific tool implementations
    {{PROJECT_TOOL_SETUP}}
  }

  private async readFile(args: any): Promise<any> {
    const { path: filePath } = args;
    
    // Check permissions
    const permission = await this.operationGuard.checkOperation('read', filePath);
    if (!permission.allowed) {
      throw new McpError(ErrorCode.InvalidRequest, permission.message);
    }

    // Read file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Log operation
    await this.operationGuard.logOperation('read', filePath, 'success', 'mcp-server');

    return {
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
    };
  }

  private async writeFile(args: any): Promise<any> {
    const { path: filePath, content } = args;
    
    // Check permissions
    const permission = await this.operationGuard.checkOperation('write', filePath);
    if (!permission.allowed) {
      throw new McpError(ErrorCode.InvalidRequest, permission.message);
    }

    // Create backup if file exists
    try {
      await fs.access(filePath);
      const backupPath = `${filePath}.backup-${Date.now()}`;
      await fs.copyFile(filePath, backupPath);
    } catch {
      // File doesn't exist, no backup needed
    }

    // Write file
    await fs.writeFile(filePath, content, 'utf-8');
    
    // Log operation
    await this.operationGuard.logOperation('write', filePath, 'success', 'mcp-server');

    return {
      content: [
        {
          type: 'text',
          text: `File written successfully: ${filePath}`,
        },
      ],
    };
  }

  private async deleteFile(args: any): Promise<any> {
    const { path: filePath, reason } = args;
    
    // Check permissions (Level 2 operation)
    const permission = await this.operationGuard.checkOperation('delete', filePath, { reason });
    if (!permission.allowed) {
      throw new McpError(ErrorCode.InvalidRequest, permission.message);
    }

    if (permission.requiresConfirmation) {
      // In MCP context, we can't get interactive confirmation
      // So we require the reason to contain a confirmation phrase
      if (!reason.includes('CONFIRMED')) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Deletion requires confirmation. Include "CONFIRMED" in the reason.'
        );
      }
    }

    // Create backup before deletion
    const backupDir = path.join('.claude', 'backups', new Date().toISOString().split('T')[0]);
    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, path.basename(filePath));
    await fs.copyFile(filePath, backupPath);

    // Delete file
    await fs.unlink(filePath);
    
    // Log operation with rollback info
    await this.operationGuard.logOperation(
      'delete',
      filePath,
      'success',
      'mcp-server',
      `Backup: ${backupPath}`
    );

    return {
      content: [
        {
          type: 'text',
          text: `File deleted: ${filePath}\nBackup saved to: ${backupPath}`,
        },
      ],
    };
  }

  // Project-specific methods
  {{PROJECT_METHODS}}

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`{{PROJECT_NAME}} MCP server running on stdio`);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new {{PROJECT_NAME}}MCPServer();
  server.run().catch(console.error);
}

export { {{PROJECT_NAME}}MCPServer };