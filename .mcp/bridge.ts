#!/usr/bin/env node

/**
 * Bridge script for shell integration
 * Maps shell commands to MCP integration
 */

import { MCPIntegration, Validator } from './index';
import { createMCPClients, closeMCPClients } from './mcp-clients';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: bridge.ts <command> [args...]');
    console.error('Commands:');
    console.error('  turn_guard <file>         - Validate Claude Code turn');
    console.error('  fetch_doc <source> [out]  - Fetch document');
    console.error('  workflow <cmd> [args...]  - Workflow management');
    console.error('  test_context7             - Test Context7 integration');
    process.exit(1);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Create MCP clients if not running in test mode
  let mcpClients;
  if (process.env.NODE_ENV !== 'test') {
    try {
      mcpClients = await createMCPClients();
    } catch (error) {
      console.warn('Failed to create MCP clients, falling back to direct mode:', error);
    }
  }

  // Create integration with MCP clients
  const integration = new MCPIntegration(mcpClients);
  
  try {
    // MCPIntegration constructor handles initialization
    let result: any;
    
    switch (command) {
      case 'turn_guard': {
        result = await integration.validate(commandArgs[0]);
        
        // Output validation results
        if (!result.valid) {
          console.error('\n❌ Validation failed:');
          if (result.errors && result.errors.length > 0) {
            result.errors.forEach((error: string) => {
              console.error(`  - ${error}`);
            });
          }
          if (result.guardFailures && result.guardFailures.length > 0) {
            console.error('\nFailed guards:');
            result.guardFailures.forEach((failure: any) => {
              console.error(`  - ${failure.guard}: ${failure.message}`);
            });
          }
        } else {
          console.log('\n✅ All validation checks passed');
        }
        
        // Exit with the specific guard exit code if validation fails
        if (!result.valid && result.failedGuard) {
          // Map guard names to exit codes as defined in validator.ts
          const guardExitCodes: Record<string, number> = {
            'G-SHA': 10,
            'G-TOKEN': 11,
            'G-LOC': 12,
            'G-PHASE': 13,
            'G-NET': 14,
            'G-THINK': 15,
            'G-DUP': 16,
            'G-STATE': 17,
            'G-LINT': 18,
            'G-TYPE': 19,
            'G-TEST': 20,
            'G-RFC': 21,
            'G-COV': 22,
            'G-PERF': 23,
            'G-SEC': 24,
            'G-SEMVER': 25,
            'G-COMMIT': 26,
            'G-CHANGELOG': 27,
            'G-README': 28,
            'G-ROLE': 29,
            'G-PATH': 30,
            'G-WBS': 31,
            'G-API': 32,
            'G-BREAKING': 33
          };
          const exitCode = guardExitCodes[result.failedGuard] || 1;
          process.exit(exitCode);
        }
        process.exit(result.valid ? 0 : 1);
      }
        
      case 'fetch_doc': {
        const fetchResults = await integration.fetch(commandArgs[0]);
        if (commandArgs[1] && fetchResults[0]?.success) {
          // Write to output file if specified
          const fs = require('fs');
          fs.writeFileSync(commandArgs[1], fetchResults[0].content || '');
        }
        console.log(fetchResults[0]?.success ? 'Success' : fetchResults[0]?.error);
        process.exit(fetchResults[0]?.success ? 0 : 1);
      }
        
      case 'workflow': {
        result = await integration.workflow(commandArgs[0], commandArgs.slice(1));
        console.log(result);
        process.exit(0);
      }
        
      case 'test_context7': {
        result = await integration.testContext7();
        console.log(result);
        process.exit(0);
      }
      
      case 'list_guards': {
        // List all implemented guards
        const validator = new Validator();
        const guards = validator.getGuardList();
        console.log('MCP-Enhanced Guard System Overview');
        console.log('==================================');
        console.log();
        console.log('Implemented Guards (17 total):');
        console.log('-----------------------------');
        guards.forEach(guard => {
          console.log(`${guard.id} (exit code ${guard.exitCode}): ${guard.description}`);
        });
        console.log();
        console.log('Guard Exit Code Ranges:');
        console.log('----------------------');
        console.log('10-19: Structure Guards');
        console.log('20-29: Quality Guards');
        console.log('30-39: Process Guards');
        console.log('40-49: Access Control Guards');
        console.log();
        console.log('Phase-Specific Guards:');
        console.log('---------------------');
        console.log('PLAN: G-RFC, G-WBS-OK');
        console.log('BUILD: G-TEST, G-LINT, G-TYPE');
        console.log('VERIF: G-COV, G-PERF, G-SEC (coming soon)');
        process.exit(0);
      }
      
      case 'fetch_doc_secure': {
        const url = args[0];
        if (!url) {
          console.error('Usage: fetch_doc_secure <url> [output_file]');
          process.exit(1);
        }
        
        // Enhanced fetch with security validation
        const result = await integration.fetchSingle(url, { 
          validateSecurity: true,
          maxSize: 10 * 1024 * 1024, // 10MB
          timeout: 30000,
          blocklist: ['malicious.com', 'phishing.site', 'spam.domain']
        });
        
        if (!result.success) {
          console.error(`fetch_doc: ERROR: ${result.error}`);
          process.exit(1);
        }
        
        // Output file handling
        const outputFile = args[1];
        if (outputFile) {
          const fs = await import('fs');
          fs.writeFileSync(outputFile, result.content || '');
          console.log(outputFile);
        } else {
          // Save to cache
          const cacheFile = `.cache/download_${Date.now()}`;
          const fs = await import('fs');
          const path = await import('path');
          fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
          fs.writeFileSync(cacheFile, result.content || '');
          console.log(cacheFile);
        }
        
        process.exit(0);
      }
      
      case 'generate_wbs': {
        const triageFile = args[0];
        if (!triageFile) {
          console.error('Usage: generate_wbs <triage.md>');
          process.exit(1);
        }
        
        // Import analyzer for WBS generation
        const { Analyzer } = await import('./analyzer');
        const analyzer = new Analyzer(integration.mcpClients);
        
        // Read triage file
        const fs = await import('fs');
        if (!fs.existsSync(triageFile)) {
          console.error(`Error: File '${triageFile}' not found`);
          process.exit(1);
        }
        
        const content = fs.readFileSync(triageFile, 'utf8');
        
        // Extract verbs/tasks from content
        const verbs = content.match(/\b([a-z]{3,})\b/gi) || [];
        const uniqueVerbs = [...new Set(verbs)].slice(0, 5);
        
        // Generate WBS using analyzer
        const result = await analyzer.generateWBS(
          'Task breakdown from triage',
          uniqueVerbs.map(v => `${v} analysis`),
          { source: 'triage.md' }
        );
        
        if (!result.success) {
          console.error(`WBS generation failed: ${result.error}`);
          process.exit(1);
        }
        
        // Output WBS in expected format
        console.log('| Phase | Step | Task | Guard |');
        console.log('|------|------|------|------|');
        uniqueVerbs.forEach((verb, i) => {
          console.log(`| ANA | A-${i + 1} | ${verb} analysis | – |`);
        });
        
        if (result.recommendations) {
          console.log('\n## MCP-Enhanced Recommendations:');
          result.recommendations.forEach(rec => console.log(`- ${rec}`));
        }
        
        process.exit(0);
      }
      
      case 'validate_stp':
      case 'validate_stp_markers': {
        // STP validation is handled by shell script only (no MCP enhancement needed)
        // This is because it needs to interact with git history
        console.log('Delegating to shell script...');
        const { execSync } = await import('child_process');
        try {
          execSync(`./tools/validate-stp-markers.sh ${args.join(' ')}`, { 
            stdio: 'inherit',
            encoding: 'utf8' 
          });
          process.exit(0);
        } catch (error: any) {
          process.exit(error.status || 1);
        }
      }
        
      default: {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    if (integration.mcpClients) {
      await closeMCPClients(integration.mcpClients);
    }
    process.exit(1);
  } finally {
    // Clean up MCP clients
    if (integration.mcpClients) {
      await closeMCPClients(integration.mcpClients);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main();
}