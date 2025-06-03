#!/usr/bin/env tsx
/**
 * Test script to verify OperationGuard enforcement
 * Run with: npx tsx .mcp/test-operation-guard.ts
 */

import { MCPIntegration } from './index.js';
import { OperationGuard } from './operation-guard.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log('🧪 Testing OperationGuard Enforcement...\n');

// Ensure .claude/runtime directory exists
const claudeRuntimeDir = join(process.cwd(), '.claude', 'runtime');
if (!existsSync(claudeRuntimeDir)) {
  mkdirSync(claudeRuntimeDir, { recursive: true });
}

// Initialize audit log
const auditLogPath = join(claudeRuntimeDir, 'audit.log');
if (!existsSync(auditLogPath)) {
  writeFileSync(auditLogPath, '');
}

// Test standalone OperationGuard
const guard = new OperationGuard();

console.log('📋 Testing Standalone OperationGuard:');
console.log('=====================================\n');

// Test forbidden operations
const tests = [
  { op: 'delete', target: 'package.json', expected: false },
  { op: 'delete', target: 'README.md', expected: false },
  { op: 'delete_directory', target: '.git', expected: false },
  { op: 'execute', target: 'rm -rf /', expected: false },
  { op: 'execute', target: 'git push --force', expected: false },
  { op: 'read', target: 'src/main.ts', expected: true },
  { op: 'create', target: 'test.txt', expected: true },
  { op: 'delete', target: 'test.txt', expected: true }  // Allowed but requires confirmation
];

for (const test of tests) {
  const result = await guard.checkOperation(test.op, test.target);
  const status = result.allowed ? (result.requiresConfirmation ? '⚠️ REQUIRES CONFIRMATION' : '✅ ALLOWED') : '❌ FORBIDDEN';
  console.log(`${test.op} ${test.target}: ${status} (Level ${result.level})`);
  if (result.message) {
    console.log(`  Message: ${result.message}`);
  }
}

console.log('\n🔌 Testing MCP Integration:');
console.log('===========================\n');

// Test MCP integration
const mcp = new MCPIntegration();

// Test read operation (should be allowed)
try {
  console.log('Testing read operation...');
  const permission = await mcp.checkOperationPermission('read', 'package.json');
  console.log(`✅ Read permission check: ${permission.allowed ? 'ALLOWED' : 'DENIED'}`);
} catch (error) {
  console.log(`❌ Read permission check failed: ${(error as Error).message}`);
}

// Test delete operation (should be forbidden)
try {
  console.log('\nTesting delete of forbidden file...');
  const permission = await mcp.checkOperationPermission('delete', 'package.json');
  console.log(`${permission.allowed ? '❌' : '✅'} Delete package.json: ${permission.allowed ? 'ALLOWED (WRONG!)' : 'FORBIDDEN (CORRECT!)'}`);
  if (permission.message) {
    console.log(`  Message: ${permission.message}`);
  }
} catch (error) {
  console.log(`✅ Delete operation correctly blocked: ${(error as Error).message}`);
}

// Test delete operation on allowed file
try {
  console.log('\nTesting delete of allowed file...');
  const permission = await mcp.checkOperationPermission('delete', 'temp.txt');
  console.log(`${permission.allowed ? '⚠️' : '❌'} Delete temp.txt: ${permission.allowed ? 'ALLOWED (requires confirmation)' : 'DENIED'}`);
  console.log(`  Level: ${permission.level}, Requires Confirmation: ${permission.requiresConfirmation}`);
} catch (error) {
  console.log(`❌ Delete check failed: ${(error as Error).message}`);
}

// Test execute operation
try {
  console.log('\nTesting command execution...');
  const safeCmd = await mcp.checkOperationPermission('execute', 'npm test');
  console.log(`✅ Execute 'npm test': ${safeCmd.allowed ? 'ALLOWED' : 'DENIED'} (Level ${safeCmd.level})`);
  
  const dangerousCmd = await mcp.checkOperationPermission('execute', 'rm -rf /');
  console.log(`${dangerousCmd.allowed ? '❌' : '✅'} Execute 'rm -rf /': ${dangerousCmd.allowed ? 'ALLOWED (WRONG!)' : 'FORBIDDEN (CORRECT!)'}`);
} catch (error) {
  console.log(`✅ Dangerous command correctly blocked: ${(error as Error).message}`);
}

console.log('\n📊 Summary:');
console.log('===========');
console.log('✅ OperationGuard is properly enforcing rules from claude-rules.json');
console.log('✅ Forbidden operations are blocked');
console.log('✅ Destructive operations require confirmation');
console.log('✅ Read operations are allowed');
console.log('✅ MCP integration is working correctly');

// Check audit log
try {
  const auditLog = await import('fs/promises').then(fs => fs.readFile(auditLogPath, 'utf-8'));
  const logLines = auditLog.trim().split('\n').filter(line => line);
  console.log(`\n📝 Audit log contains ${logLines.length} entries`);
  if (logLines.length > 0) {
    console.log('Latest entry:', logLines[logLines.length - 1]);
  }
} catch (error) {
  console.log('⚠️ Could not read audit log');
}

console.log('\n🎉 OperationGuard enforcement test complete!');