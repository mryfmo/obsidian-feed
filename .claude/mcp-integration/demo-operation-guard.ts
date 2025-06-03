#!/usr/bin/env node

/**
 * Demo script to demonstrate OperationGuard integration
 */

import { MCPIntegration } from './index';

async function demo() {
  console.log('🔒 OperationGuard Integration Demo\n');

  // Create integration instance without MCP clients
  const integration = new MCPIntegration();

  console.log('1️⃣ Testing permission checks without execution:\n');

  // Test various operations
  const operations = [
    { op: 'read', target: '/path/to/file.txt', context: {} },
    { op: 'create', target: '/path/to/new-file.txt', context: { reason: 'demo' } },
    { op: 'modify', target: 'package.json', context: { reason: 'update dependencies' } },
    { op: 'delete', target: 'README.md', context: { reason: 'cleanup' } },
    { op: 'delete', target: '/tmp/temp-file.txt', context: { reason: 'cleanup' } },
    { op: 'execute', target: 'git status', context: {} },
    { op: 'execute', target: 'rm -rf /', context: { reason: 'dangerous!' } },
    { op: 'execute', target: 'git reset --hard', context: { reason: 'reset changes' } }
  ];

  for (const { op, target, context } of operations) {
    try {
      const check = await integration.checkOperationPermission(op, target, context);
      const status = check.allowed ? '✅' : '❌';
      const confirm = check.requiresConfirmation ? ' ⚠️ (requires confirmation)' : '';
      console.log(`${status} ${op.padEnd(10)} ${target.padEnd(30)} Level: ${check.level}${confirm}`);
      if (check.message) {
        console.log(`   Message: ${check.message}`);
      }
    } catch (error) {
      console.log(`❌ ${op.padEnd(10)} ${target.padEnd(30)} Error: ${(error as Error).message}`);
    }
  }

  console.log('\n2️⃣ Testing file operations with guard:\n');

  // Test read operation (should work)
  try {
    console.log('Attempting to read a file...');
    const mockClient = {
      filesystem: {
        read_file: async () => ({ content: 'Mock file content' })
      }
    };
    const integrationWithMock = new MCPIntegration(mockClient);
    const result = await integrationWithMock.readFile('/path/to/allowed-file.txt');
    console.log('✅ Read succeeded:', result.content);
  } catch (error) {
    console.log('❌ Read failed:', (error as Error).message);
  }

  // Test delete operation (should require confirmation)
  try {
    console.log('\nAttempting to delete a file...');
    await integration.deleteFile('/path/to/file.txt', 'cleanup test');
  } catch (error) {
    console.log('⚠️  Delete blocked:', (error as Error).message);
  }

  // Test forbidden delete
  try {
    console.log('\nAttempting to delete a forbidden file (package.json)...');
    await integration.deleteFile('package.json', 'test');
  } catch (error) {
    console.log('❌ Delete blocked:', (error as Error).message);
  }

  console.log('\n3️⃣ Checking audit log:\n');
  
  try {
    const fs = await import('fs');
    const auditLogPath = '.claude/audit.log';
    if (fs.existsSync(auditLogPath)) {
      const logs = fs.readFileSync(auditLogPath, 'utf-8').trim().split('\n');
      console.log(`Found ${logs.length} audit log entries:`);
      logs.slice(-5).forEach(log => {
        const entry = JSON.parse(log);
        console.log(`  ${entry.timestamp} - ${entry.operation} ${entry.target} (${entry.status})`);
      });
    } else {
      console.log('No audit log found yet.');
    }
  } catch (error) {
    console.log('Could not read audit log:', (error as Error).message);
  }

  console.log('\n✅ Demo completed!\n');
}

// Run the demo
demo().catch(console.error);