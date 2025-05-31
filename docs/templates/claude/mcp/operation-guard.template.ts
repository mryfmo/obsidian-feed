import { readFileSync, existsSync, promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface OperationGuardConfig {
  rules: any;
  auditLog: string;
  rollbackRegistry: string;
}

interface OperationResult {
  allowed: boolean;
  level: number;
  requiresConfirmation: boolean;
  message?: string;
}

/**
 * Operation Guard for {{PROJECT_NAME}}
 * Enforces safety rules for all file system operations
 */
export class OperationGuard {
  private config: OperationGuardConfig;
  private rules: any;

  constructor() {
    // Look for rules in multiple locations for compatibility
    const projectRoot = join(__dirname, '..', '..');
    const possiblePaths = [
      join(projectRoot, '.claude', 'config', 'claude-rules.json'),
      join(projectRoot, 'claude-rules.json'),
      join(__dirname, '..', 'config', 'claude-rules.json'),
    ];

    let rulesPath: string | undefined;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        rulesPath = path;
        break;
      }
    }

    if (!rulesPath) {
      throw new Error('claude-rules.json not found - safety rules not configured');
    }
    
    this.rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
    this.config = {
      rules: this.rules,
      auditLog: join(projectRoot, '.claude', 'runtime', 'audit.log'),
      rollbackRegistry: join(projectRoot, '.claude', 'runtime', 'rollback-registry.json')
    };

    // Ensure runtime directory exists
    this.ensureRuntimeDir();
  }

  private async ensureRuntimeDir(): Promise<void> {
    const runtimeDir = dirname(this.config.auditLog);
    try {
      await fs.mkdir(runtimeDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Check if operation is allowed
   */
  async checkOperation(
    operation: string,
    target: string,
    context?: any
  ): Promise<OperationResult> {
    // Check forbidden patterns first
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
      message: requiresConfirmation 
        ? this.getConfirmationMessage(operation, target, context)
        : undefined
    };
  }

  /**
   * Check forbidden patterns based on project type
   */
  private checkForbiddenPatterns(operation: string, target: string): string | null {
    const rules = this.rules.rules.operations;
    
    if (operation === 'delete' && rules.delete?.files?.forbidden_patterns) {
      for (const pattern of rules.delete.files.forbidden_patterns) {
        // Skip comments
        if (pattern.startsWith('#')) continue;
        
        if (this.matchPattern(target, pattern)) {
          return `File matches forbidden pattern: ${pattern}`;
        }
      }
    }

    if (operation === 'delete_directory' && rules.delete?.directories?.forbidden) {
      const dirName = target.split('/').pop();
      if (rules.delete.directories.forbidden.includes(dirName)) {
        return `Directory is forbidden: ${dirName}`;
      }
    }

    if (operation === 'execute' && rules.execute?.commands?.forbidden) {
      for (const forbidden of rules.execute.commands.forbidden) {
        if (forbidden.startsWith('#')) continue;
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
    const rules = this.rules.rules.operations;
    
    // Map operations to configured levels
    const operationLevels = {
      'read': rules.read?.level || 0,
      'create': rules.create?.files?.level || 1,
      'modify': this.isConfigFile(target) ? 3 : (rules.modify?.level || 1),
      'delete': rules.delete?.files?.level || 2,
      'delete_directory': rules.delete?.directories?.level || 2,
      'execute': this.isDangerousCommand(target) ? 2 : 1,
      'publish': rules.publish?.level || 3,
      'deploy': 3
    };

    return operationLevels[operation] || 1;
  }

  /**
   * Check if file is a config file
   */
  private isConfigFile(path: string): boolean {
    const patterns = this.rules.rules.operations.modify?.config_files?.patterns || [];
    return patterns.some((pattern: string) => {
      if (pattern.startsWith('#')) return false;
      return this.matchPattern(path, pattern);
    });
  }

  /**
   * Check if command is dangerous
   */
  private isDangerousCommand(command: string): boolean {
    const dangerous = this.rules.rules.operations.execute?.commands?.require_confirmation || [];
    return dangerous.some((cmd: string) => {
      if (cmd.startsWith('#')) return false;
      return command.includes(cmd);
    });
  }

  /**
   * Simple glob pattern matching
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Convert glob to regex
    const regex = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '{{STAR}}')
      .replace(/\?/g, '{{QUESTION}}')
      .replace(/\./g, '\\.')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/{{STAR}}/g, '[^/]*')
      .replace(/{{QUESTION}}/g, '.');
    
    return new RegExp(`${regex}$`).test(path);
  }

  /**
   * Get confirmation message for operation
   */
  private getConfirmationMessage(operation: string, target: string, context?: any): string {
    const template = this.rules.rules.operations[operation]?.files?.confirmation_template || 
                    this.rules.rules.operations[operation]?.directories?.confirmation_template ||
                    `⚠️ Operation: ${operation}\nTarget: ${target}\nApprove? (yes/no)`;
    
    return template
      .replace('{path}', target)
      .replace('{reason}', context?.reason || 'No reason provided')
      .replace('{operation}', operation)
      .replace('\\n', '\n');
  }

  /**
   * Log operation to audit trail
   */
  async logOperation(
    operation: string,
    target: string,
    status: string,
    user: string,
    rollback?: string
  ): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      target,
      status,
      user,
      level: this.getOperationLevel(operation, target),
      rollback
    };

    try {
      // Ensure directory exists
      await this.ensureRuntimeDir();
      
      // Append to audit log
      await fs.appendFile(
        this.config.auditLog,
        `${JSON.stringify(entry)}\n`
      );

      // Update rollback registry for level 2+ operations
      if (entry.level >= 2 && rollback && status === 'success') {
        await this.updateRollbackRegistry(target, rollback);
      }
    } catch (error) {
      console.error('Failed to log operation:', error);
    }
  }

  /**
   * Update rollback registry
   */
  private async updateRollbackRegistry(target: string, rollback: string): Promise<void> {
    let registry: any = {};
    
    try {
      const data = await fs.readFile(this.config.rollbackRegistry, 'utf-8');
      registry = JSON.parse(data);
    } catch {
      // File doesn't exist or is invalid
    }

    registry[target] = {
      rollback,
      timestamp: new Date().toISOString()
    };

    // Keep only last 100 entries
    const entries = Object.entries(registry);
    if (entries.length > 100) {
      registry = Object.fromEntries(
        entries.sort((a: any, b: any) => b[1].timestamp.localeCompare(a[1].timestamp)).slice(0, 100)
      );
    }

    await fs.writeFile(
      this.config.rollbackRegistry,
      JSON.stringify(registry, null, 2)
    );
  }
}

// Export for use in MCP server
export default OperationGuard;