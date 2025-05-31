import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface OperationGuardConfig {
  rules: any;
  auditLog: string;
  rollbackRegistry: string;
}

/**
 * Operation Guard for MCP Integration
 * Intercepts and validates all file system operations
 */
export class OperationGuard {
  private config: OperationGuardConfig;
  private rules: any;

  constructor() {
    // Look for claude-rules.json in parent directory (project root)
    const projectRoot = join(__dirname, '..');
    const rulesPath = join(projectRoot, 'claude-rules.json');
    if (!existsSync(rulesPath)) {
      throw new Error('claude-rules.json not found - Claude safety rules not configured');
    }
    
    this.rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
    this.config = {
      rules: this.rules,
      auditLog: join(projectRoot, '.claude', 'audit.log'),
      rollbackRegistry: join(projectRoot, '.claude', 'rollback-registry.json')
    };
  }

  /**
   * Check if operation is allowed
   */
  async checkOperation(operation: string, target: string, context?: any): Promise<{
    allowed: boolean;
    level: number;
    requiresConfirmation: boolean;
    message?: string;
  }> {
    // Check forbidden patterns
    const forbidden = this.checkForbiddenPatterns(operation, target);
    if (forbidden) {
      return {
        allowed: false,
        level: 99,
        requiresConfirmation: false,
        message: `Operation forbidden: ${forbidden}`
      };
    }

    // Get operation level
    const level = this.getOperationLevel(operation, target);
    
    // Check if confirmation required
    const requiresConfirmation = level >= 2;

    return {
      allowed: true,
      level,
      requiresConfirmation,
      message: requiresConfirmation ? this.getConfirmationMessage(operation, target, context) : undefined
    };
  }

  /**
   * Check forbidden patterns
   */
  private checkForbiddenPatterns(operation: string, target: string): string | null {
    const rules = this.rules.rules.operations;
    
    if (operation === 'delete' && rules.delete.files.forbidden_patterns) {
      for (const pattern of rules.delete.files.forbidden_patterns) {
        if (this.matchPattern(target, pattern)) {
          return `File matches forbidden pattern: ${pattern}`;
        }
      }
    }

    if (operation === 'delete_directory' && rules.delete.directories.forbidden) {
      const dirName = target.split('/').pop();
      if (rules.delete.directories.forbidden.includes(dirName)) {
        return `Directory is forbidden: ${dirName}`;
      }
    }

    if (operation === 'execute') {
      for (const forbidden of rules.execute.commands.forbidden) {
        if (target.includes(forbidden)) {
          return `Command is forbidden: ${forbidden}`;
        }
      }
    }

    return null;
  }

  /**
   * Get operation security level
   */
  private getOperationLevel(operation: string, target: string): number {
    
    switch (operation) {
      case 'read':
        return 0;
      case 'create':
        return 1;
      case 'modify':
        return this.isConfigFile(target) ? 3 : 1;
      case 'delete':
        return 2;
      case 'delete_directory':
        return 2;
      case 'execute':
        return this.isDangerousCommand(target) ? 2 : 1;
      default:
        return 1;
    }
  }

  /**
   * Check if file is a config file
   */
  private isConfigFile(path: string): boolean {
    const patterns = this.rules.rules.operations.modify.config_files.patterns;
    return patterns.some((pattern: string) => this.matchPattern(path, pattern));
  }

  /**
   * Check if command is dangerous
   */
  private isDangerousCommand(command: string): boolean {
    const dangerous = this.rules.rules.operations.execute.commands.require_confirmation;
    return dangerous.some((cmd: string) => command.includes(cmd));
  }

  /**
   * Simple pattern matching
   */
  private matchPattern(path: string, pattern: string): boolean {
    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(path);
  }

  /**
   * Get confirmation message
   */
  private getConfirmationMessage(operation: string, target: string, context?: any): string {
    const template = this.rules.rules.operations[operation]?.files?.confirmation_template || 
                    this.rules.rules.operations[operation]?.directories?.confirmation_template ||
                    `⚠️ Operation: ${operation}\\nTarget: ${target}\\nApprove? (yes/no)`;
    
    return template
      .replace('{path}', target)
      .replace('{reason}', context?.reason || 'No reason provided')
      .replace('{operation}', operation);
  }

  /**
   * Log operation
   */
  async logOperation(operation: string, target: string, status: string, user: string): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      target,
      status,
      user,
      level: this.getOperationLevel(operation, target)
    };

    // Ensure directory exists and append to audit log
    const fs = await import('fs/promises');
    const logDir = dirname(this.config.auditLog);
    await fs.mkdir(logDir, { recursive: true });
    
    await fs.appendFile(
      this.config.auditLog,
      `${JSON.stringify(entry)}\\n`
    );
  }
}

// Export for MCP server integration
export default OperationGuard;