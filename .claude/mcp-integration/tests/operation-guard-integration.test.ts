import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPIntegration } from '../index';

describe('OperationGuard Integration', () => {
  let integration: MCPIntegration;
  let mockFilesystemClient: any;

  beforeEach(() => {
    mockFilesystemClient = {
      read_file: vi.fn().mockResolvedValue({ content: 'file content' })
    };

    integration = new MCPIntegration({
      filesystem: mockFilesystemClient
    });
  });

  describe('readFile', () => {
    it('should allow reading files', async () => {
      const result = await integration.readFile('/path/to/file.txt');
      expect(result.content).toBe('file content');
      expect(mockFilesystemClient.read_file).toHaveBeenCalledWith({ path: '/path/to/file.txt' });
    });
  });

  describe('deleteFile', () => {
    it('should reject deletion of forbidden files', async () => {
      await expect(integration.deleteFile('package.json', 'test deletion'))
        .rejects.toThrow('Operation forbidden');
    });

    it('should require confirmation for allowed deletions', async () => {
      await expect(integration.deleteFile('/path/to/file.txt', 'cleanup'))
        .rejects.toThrow('Operation requires confirmation');
    });
  });

  describe('modifyFile', () => {
    it('should require confirmation for config files', async () => {
      await expect(integration.modifyFile('config.json', '{}', 'update config'))
        .rejects.toThrow('Operation requires confirmation');
    });
  });

  describe('executeCommand', () => {
    it('should reject forbidden commands', async () => {
      await expect(integration.executeCommand('rm', ['-rf', '/'], 'cleanup'))
        .rejects.toThrow('Operation forbidden');
    });

    it('should require confirmation for dangerous commands', async () => {
      await expect(integration.executeCommand('git', ['reset', '--hard'], 'reset changes'))
        .rejects.toThrow('Operation requires confirmation');
    });
  });

  describe('checkOperationPermission', () => {
    it('should check permissions without executing', async () => {
      const check = await integration.checkOperationPermission('delete', 'package.json');
      expect(check.allowed).toBe(false);
      expect(check.message).toContain('forbidden');
    });

    it('should indicate confirmation requirements', async () => {
      const check = await integration.checkOperationPermission('delete', '/path/to/file.txt');
      expect(check.allowed).toBe(true);
      expect(check.requiresConfirmation).toBe(true);
      expect(check.level).toBe(2);
    });
  });
});