import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MCPIntegration } from '../../index';
import * as fs from 'fs';
import { execSync } from 'child_process';
import axios from 'axios';

// Mock dependencies
vi.mock('fs');
vi.mock('child_process');
vi.mock('axios');
vi.mock('@modelcontextprotocol/sdk', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn()
  }))
}));
vi.mock('turndown', () => {
  return {
    default: class TurndownService {
      turndown(html: string): string {
        // Simple HTML to markdown conversion for tests
        return html
          .replace(/<h1>([^<]+)<\/h1>/g, '# $1')
          .replace(/<h2>([^<]+)<\/h2>/g, '## $1')
          .replace(/<[^>]+>/g, ''); // Remove other HTML tags
      }
    }
  };
});
vi.mock('../../context7', () => {
  return {
    Context7Client: class {
      async initialize() {
        return undefined;
      }
      
      async getDocumentation(libraryName: string) {
        if (libraryName === 'react') {
          return {
            content: '# React Documentation\n\nReact is a JavaScript library...',
            version: '18.2.0',
            libraryId: 'react'
          };
        }
        throw new Error(`Library ${libraryName} not found`);
      }
    }
  };
});

describe('MCPIntegration', () => {
  let integration: MCPIntegration;
  
  beforeEach(() => {
    vi.resetAllMocks();
    integration = new MCPIntegration();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Full Validation Flow', () => {
    it('should validate a complete Claude Code turn', async () => {
      const turnContent = `FETCH: Getting React documentation

<think>
I need to fetch the React documentation to understand the latest hooks API.
This will help me implement the requested feature properly.
Let me analyze what specific information I need to gather.
</think>

<act>
# step-plan: fetch React hooks documentation
Fetching https://react.dev/reference/react
</act>

<verify>
✓ Successfully retrieved React documentation
✓ Found hooks reference section
✓ Content cached for offline access
</verify>

<next>
State-Transition: FETCH→INV
Next: Investigate the current implementation
</next>`;

      vi.mocked(fs.readFileSync).mockReturnValue(turnContent);
      vi.mocked(execSync).mockReturnValue(''); // No git changes
      
      const result = await integration.validate('turn-001.md');
      
      expect(result.valid).toBe(true);
      expect(result.phase).toBe('FETCH');
      expect(result.errors).toHaveLength(0);
    });

    it('should detect multiple validation errors', async () => {
      const invalidContent = `BUILD: Implementation

<act>
Making changes without thinking
https://api.example.com/data
</act>`;

      vi.mocked(fs.readFileSync).mockReturnValue(invalidContent);
      
      const result = await integration.validate('invalid-turn.md', { checkAllGuards: true });
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some(e => e.includes('G-TOKEN'))).toBe(true); // Missing think
      expect(result.errors.some(e => e.includes('G-NET'))).toBe(true); // Network in BUILD
      expect(result.errors.some(e => e.includes('G-PHASE'))).toBe(true); // Wrong tag order
    });
  });

  describe('Document Fetching Integration', () => {
    it('should fetch and validate documentation sources', async () => {
      // Clear any previous mocks
      vi.clearAllMocks();
      
      // Mock axios.get for successful fetches
      const axiosGet = vi.mocked(axios.get);
      axiosGet.mockResolvedValue({
        status: 200,
        data: '<html><body><h1>Documentation</h1></body></html>',
        headers: { 'content-type': 'text/html' }
      });
      
      // Mock file system operations for caching
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        // Cache directory exists
        if (pathStr.endsWith('.cache/fetch')) {
          return true;
        }
        // Cache files don't exist
        if (pathStr.includes('.cache/fetch/')) {
          return false;
        }
        return false;
      });
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('.cache/fetch/')) {
          throw new Error('No cache file');
        }
        // Default behavior for other files
        throw new Error('File not found');
      });
      
      const results = await integration.fetch(['https://example.com/docs', 'react']);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].content).toContain('# Documentation');
      expect(results[1].success).toBe(true);
      expect(results[1].content).toContain('# React Documentation');
    });

    it('should handle mixed success and failure', async () => {
      vi.mocked(axios.get)
        .mockResolvedValueOnce({ 
          status: 200, 
          data: 'Success',
          headers: { 'content-type': 'text/plain' }
        })
        .mockRejectedValueOnce(new Error('Network error'));
      
      // Ensure cache directory exists
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (path.toString().includes('.cache/fetch')) {
          return path.toString().endsWith('.cache/fetch');
        }
        return false;
      });
      
      const results = await integration.fetch([
        'https://example.com/success',
        'https://example.com/fail'
      ]);
      
      expect(results[0].success).toBe(true);
      expect(results[0].content).toBe('Success');
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Network error');
    });
  });

  describe('Workflow Management Integration', () => {
    it('should validate phase transitions with file content', async () => {
      const fetchContent = `FETCH: Documentation retrieval
<think>
${Array(30).fill('word').join(' ')}
</think>`;

      const invContent = `INV: Investigation
<think>
${Array(30).fill('word').join(' ')}
Assumed Goals: Fix the identified issue based on investigation
</think>
<act>
# step-plan: investigate the issue
Investigating the current implementation
</act>
<next>
State-Transition: INV→ANA
</next>`;

      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(fetchContent)
        .mockReturnValueOnce(invContent);
      
      // Validate FETCH phase
      const fetchResult = await integration.validate('fetch-turn.md');
      expect(fetchResult.valid).toBe(true);
      expect(fetchResult.phase).toBe('FETCH');
      
      // Validate INV phase with transition
      const invResult = await integration.validate('inv-turn.md');
      expect(invResult.valid).toBe(true);
      expect(invResult.phase).toBe('INV');
    });

    it('should manage GitHub labels through workflow', async () => {
      vi.mocked(execSync).mockReturnValue('');
      
      const result = await integration.workflow('update-phase', {
        issueNumber: 123,
        fromPhase: 'BUILD',
        toPhase: 'VERIF'
      });
      
      expect(result.success).toBe(true);
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        expect.stringContaining('--remove-label "phase:BUILD"'),
        expect.any(Object)
      );
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        expect.stringContaining('--add-label "phase:VERIF"'),
        expect.any(Object)
      );
    });
  });

  describe('Shell Script Compatibility', () => {
    it('should maintain backward compatibility with turn_guard.sh', async () => {
      const turnPath = '/path/to/turn.md';
      const content = `FETCH: Test
<think>
${Array(30).fill('word').join(' ')}
</think>`;

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(execSync).mockReturnValue('');
      
      // Simulate shell script calling through bridge
      const result = await integration.validate(turnPath);
      
      expect(result.valid).toBe(true);
      
      // Verify exit code compatibility
      const exitCode = result.valid ? 0 : (result.guardFailures?.[0]?.exitCode || 1);
      expect(exitCode).toBe(0);
    });

    it('should return correct exit codes for specific guard failures', async () => {
      // Create fresh integration instance to avoid cache issues
      const freshIntegration = new MCPIntegration();
      
      const scenarios = [
        {
          content: 'FETCH: Test\n<act>No think section at all</act>',
          expectedGuard: 'G-TOKEN',
          expectedExitCode: 11
        },
        {
          content: `BUILD: Implementation\n<think>${Array(30).fill('word').join(' ')}</think>\n<act>https://example.com</act>`,
          expectedGuard: 'G-NET',
          expectedExitCode: 13
        }
      ];
      
      for (const scenario of scenarios) {
        vi.clearAllMocks(); // Clear all mocks between scenarios
        vi.mocked(fs.readFileSync).mockReturnValue(scenario.content);
        vi.mocked(execSync).mockImplementation(() => ''); // Reset exec mock
        
        const result = await freshIntegration.validate(`test-${scenario.expectedGuard}.md`, { checkAllGuards: true });
        
        expect(result.valid).toBe(false);
        expect(result.guardFailures).toBeDefined();
        expect(result.guardFailures!.length).toBeGreaterThan(0);
        
        const guardFailure = result.guardFailures?.find(g => g.guard === scenario.expectedGuard);
        expect(guardFailure).toBeDefined();
        expect(guardFailure?.exitCode).toBe(scenario.expectedExitCode);
      }
    });
  });

  describe('MCP Server Integration', () => {
    it('should initialize MCP clients when available', async () => {
      // Mock MCP server availability
      const mockClients = {
        filesystem: { callTool: vi.fn() },
        github: { callTool: vi.fn() },
        memory: { callTool: vi.fn() }
      };
      
      // Test with MCP clients
      new MCPIntegration(mockClients as any);
      
      // Should use MCP filesystem for file operations
      mockClients.filesystem.callTool.mockResolvedValue({
        content: 'File content from MCP'
      });
      
      // Mock filesystem methods for fetcher
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const mcpClientsWithMethods = {
        filesystem: {
          read_file: vi.fn().mockResolvedValue({
            content: 'File content from MCP'
          })
        }
      };
      
      const mcpIntegrationWithMcp = new MCPIntegration(mcpClientsWithMethods as any);
      const result = await mcpIntegrationWithMcp.fetch(['/path/to/file.txt']);
      
      expect(result[0].success).toBe(true);
      expect(result[0].content).toBe('File content from MCP');
      expect(mcpClientsWithMethods.filesystem.read_file).toHaveBeenCalledWith({
        path: '/path/to/file.txt'
      });
    });

    it('should fallback to direct methods when MCP unavailable', async () => {
      // No MCP clients provided
      const integration = new MCPIntegration();
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('Direct file content');
      
      const result = await integration.fetch(['/path/to/file.txt']);
      
      expect(result[0].success).toBe(true);
      expect(result[0].content).toBe('Direct file content');
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalled();
    });
  });

  describe('Performance and Caching', () => {
    it('should cache validation results for repeated calls', async () => {
      const content = `FETCH: Test
<think>
${Array(30).fill('word').join(' ')}
</think>`;

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(execSync).mockReturnValue('');
      
      // First call
      const result1 = await integration.validate('test.md');
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      const result2 = await integration.validate('test.md');
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledTimes(1); // Not called again
      
      expect(result1).toEqual(result2);
    });

    it('should handle concurrent validation requests', async () => {
      const files = ['turn1.md', 'turn2.md', 'turn3.md'];
      const content = `FETCH: Test
<think>
${Array(30).fill('word').join(' ')}
</think>`;

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(execSync).mockReturnValue('');
      
      const promises = files.map(file => integration.validate(file));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.valid).toBe(true);
        expect(result.phase).toBe('FETCH');
      });
    });
  });

  describe('Error Recovery', () => {
    it('should gracefully handle partial failures', async () => {
      const content = `PLAN: RFC Document

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
## Problem
Description here

## Solution
Approach here
<!-- Missing Risks and Timeline sections -->
</act>`;

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      
      const result = await integration.validate('rfc.md', { checkAllGuards: true });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('RFC missing required section'))).toBe(true);
      
      // Should still extract valid information
      expect(result.phase).toBe('PLAN');
    });

    it('should provide helpful error messages', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });
      
      const result = await integration.validate('/protected/file.md');
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('permission denied');
    });
  });

  describe('Advanced Validation Scenarios', () => {
    it('should validate complex RFC documents', async () => {
      const rfcContent = `PLAN: API Redesign RFC

<think>
${Array(50).fill('word').join(' ')}
Assumed Goals: Design a new API that addresses performance issues
</think>

<act>
# step-plan: create RFC for API redesign
## Problem
The current API has performance issues and lacks proper error handling.

## Solution
Implement a new REST API with:
- Proper error codes
- Rate limiting
- Caching headers

## Risks
- Breaking changes for existing clients
- Migration complexity

## Timeline
- Week 1: Design review
- Week 2-3: Implementation
- Week 4: Testing and rollout
</act>

<verify>
✓ RFC structure validated
✓ All required sections present
</verify>`;

      vi.mocked(fs.readFileSync).mockReturnValue(rfcContent);
      vi.mocked(execSync).mockImplementation(() => ''); // No git changes
      
      const result = await integration.validate('rfc-api.md');
      
      
      expect(result.valid).toBe(true);
      expect(result.phase).toBe('PLAN');
    });

    it('should enforce role-based restrictions', async () => {
      const content = `BUILD: Implementation
<think>
${Array(30).fill('word').join(' ')}
</think>`;

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd.includes('git rev-parse')) {
          return ''; // We are in a git repo
        }
        if (cmd.includes('git diff --name-only --cached')) {
          return 'src/main.ts\ndocs/README.md';
        }
        return '';
      });
      
      // Doc writer trying to edit source
      const result = await integration.validate('build.md', { role: 'doc', checkAllGuards: true });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('doc role not allowed to edit src/'))).toBe(true);
    });
  });
});