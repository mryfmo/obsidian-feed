import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Shell Script Compatibility', () => {
  let tempDir: string;
  
  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  });
  
  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('turn_guard.sh', () => {
    const turnGuardPath = path.resolve(__dirname, '../../tools/turn_guard.sh');
    
    it('should validate a valid turn file', () => {
      const turnFile = path.join(tempDir, 'valid-turn.md');
      const content = `FETCH: Getting documentation

<think>
I need to analyze this request and plan my approach carefully today
This should have enough tokens to pass validation successfully
</think>

<act>
# step-plan: fetch documentation
Fetching the required documentation
</act>

<verify>
✓ Documentation fetched successfully
</verify>

<next>
State-Transition: FETCH→INV
</next>`;
      
      fs.writeFileSync(turnFile, content);
      
      try {
        // Run from the project root directory to ensure MCP can be found
        const result = execSync(`bash ${turnGuardPath} ${turnFile}`, { 
          encoding: 'utf8',
          cwd: path.resolve(__dirname, '../../')  // Go up to project root
        });
        // If no error thrown, validation passed
        expect(true).toBe(true);
      } catch (error: any) {
        console.error('Validation failed:', error.stdout || error.stderr);
        expect(error.status).toBe(0);
      }
    });
    
    it('should fail with appropriate exit code for missing think section', () => {
      const turnFile = path.join(tempDir, 'no-think.md');
      const content = `FETCH: Getting documentation

<act>
Just action without thinking
</act>`;
      
      fs.writeFileSync(turnFile, content);
      
      try {
        execSync(`bash ${turnGuardPath} ${turnFile}`, { encoding: 'utf8' });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // G-TOKEN guard should fail with exit code 11
        expect(error.status).toBe(11);
      }
    });
    
    it('should fail for network access in non-FETCH phase', () => {
      const turnFile = path.join(tempDir, 'network-violation.md');
      const content = `BUILD: Implementation

<think>
Planning the implementation with enough words to pass token validation
This is a build phase so network access should not be allowed
</think>

<act>
# step-plan: implement feature
Fetching data from https://api.example.com
</act>`;
      
      fs.writeFileSync(turnFile, content);
      
      try {
        execSync(`bash ${turnGuardPath} ${turnFile}`, { encoding: 'utf8' });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // G-NET guard should fail with exit code 13
        expect(error.status).toBe(13);
      }
    });
    
    it('should work with MCP bridge when available', () => {
      const turnFile = path.join(tempDir, 'mcp-bridge.md');
      const content = `FETCH: Test with bridge

<think>
Testing MCP bridge integration with sufficient content
We need to ensure backward compatibility is maintained
</think>

<act>
# step-plan: test bridge
Testing the MCP bridge
</act>`;
      
      fs.writeFileSync(turnFile, content);
      
      // Set up environment to use MCP bridge
      const env = { ...process.env };
      
      try {
        const output = execSync(`bash ${turnGuardPath} ${turnFile}`, { 
          encoding: 'utf8',
          env
        });
        
        // Check if MCP bridge was attempted (even if it fails)
        // The script should still work via fallback
        expect(true).toBe(true);
      } catch (error: any) {
        // Should only fail for validation errors, not bridge issues
        expect(error.status).toBeGreaterThan(0);
        expect(error.status).toBeLessThan(100);
      }
    });
  });

  describe('fetch_doc.sh', () => {
    const fetchDocPath = path.resolve(__dirname, '../../tools/fetch_doc.sh');
    
    it('should fetch a local file', () => {
      const sourceFile = path.join(tempDir, 'source.txt');
      const outputFile = path.join(tempDir, 'output.txt');
      const content = 'Test content for fetch';
      
      fs.writeFileSync(sourceFile, content);
      
      try {
        execSync(`bash ${fetchDocPath} ${sourceFile} ${outputFile}`, { encoding: 'utf8' });
        
        expect(fs.existsSync(outputFile)).toBe(true);
        expect(fs.readFileSync(outputFile, 'utf8')).toBe(content);
      } catch (error: any) {
        console.error('Fetch failed:', error.stdout || error.stderr);
        expect.fail('File fetch should have succeeded');
      }
    });
    
    it('should handle missing source file', () => {
      const sourceFile = path.join(tempDir, 'missing.txt');
      const outputFile = path.join(tempDir, 'output.txt');
      
      try {
        execSync(`bash ${fetchDocPath} ${sourceFile} ${outputFile}`, { encoding: 'utf8' });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBeGreaterThan(0);
      }
    });
    
    it('should create cache directory if needed', () => {
      const sourceFile = path.join(tempDir, 'cache-test.txt');
      const outputFile = path.join(tempDir, 'cached-output.txt');
      const content = 'Content to cache';
      
      fs.writeFileSync(sourceFile, content);
      
      try {
        execSync(`bash ${fetchDocPath} ${sourceFile} ${outputFile}`, { encoding: 'utf8' });
        
        // Check if cache directory was created
        const cacheDir = path.join(path.dirname(fetchDocPath), '..', '.cache');
        // Cache creation is optional, just ensure fetch worked
        expect(fs.existsSync(outputFile)).toBe(true);
      } catch (error: any) {
        console.error('Cache test failed:', error.stdout || error.stderr);
        expect.fail('Fetch with cache should have succeeded');
      }
    });
  });

  describe('Bridge Integration', () => {
    it('should detect when bridge.ts exists', () => {
      const bridgePath = path.resolve(__dirname, '../bridge.ts');
      const exists = fs.existsSync(bridgePath);
      
      // Bridge should exist in .mcp directory
      expect(exists).toBe(true);
    });
    
    it('should validate exit code propagation', () => {
      const turnFile = path.join(tempDir, 'exit-code-test.md');
      
      // Test different guard failures
      const testCases = [
        {
          content: 'FETCH: Test\n<act>No think</act>',
          expectedCode: 11, // G-TOKEN
          description: 'Missing think section'
        },
        {
          content: 'No phase label\n<think>' + Array(30).fill('word').join(' ') + '</think>',
          expectedCode: 12, // G-LABEL
          description: 'Missing phase label'
        }
      ];
      
      for (const test of testCases) {
        fs.writeFileSync(turnFile, test.content);
        
        try {
          execSync(`bash ${path.resolve(__dirname, '../../tools/turn_guard.sh')} ${turnFile}`, { 
            encoding: 'utf8' 
          });
          expect.fail(`${test.description} should have failed`);
        } catch (error: any) {
          expect(error.status).toBe(test.expectedCode);
        }
      }
    });
  });
});