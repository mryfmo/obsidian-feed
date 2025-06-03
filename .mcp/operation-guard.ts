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
  cycleEnforcement?: any;
  cycleComplianceLog?: string;
  violationsLog?: string;
}

interface CycleStep {
  id: number;
  name: string;
  completed: boolean;
  timestamp?: string;
}

interface CycleState {
  operationId: string;
  level: number;
  requiredSteps: string[];
  completedSteps: CycleStep[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Operation Guard for MCP Integration
 * Intercepts and validates all file system operations
 */
export class OperationGuard {
  private config: OperationGuardConfig;
  private rules: any;
  private cycleStates: Map<string, CycleState> = new Map();

  constructor() {
    // Look for claude-rules.json in parent directory (project root)
    const projectRoot = join(__dirname, '..');
    
    // Check multiple locations for compatibility
    const possiblePaths = [
      join(projectRoot, '.claude', 'config', 'claude-rules.json'),
      join(projectRoot, 'claude-rules.json'),
      // For testing environments
      join(__dirname, 'tests', 'fixtures', 'claude-rules.json'),
      join(projectRoot, '.mcp', 'tests', 'fixtures', 'claude-rules.json')
    ];
    
    let rulesPath: string | undefined;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        rulesPath = path;
        break;
      }
    }
    
    if (!rulesPath) {
      // In test environment, create a minimal config
      if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
        this.rules = this.getDefaultTestRules();
      } else {
        throw new Error('claude-rules.json not found - Claude safety rules not configured');
      }
    } else {
      this.rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
    }
    
    this.config = {
      rules: this.rules,
      auditLog: join(projectRoot, '.claude', 'runtime', 'audit.log'),
      rollbackRegistry: join(projectRoot, '.claude', 'runtime', 'rollback-registry.json'),
      cycleComplianceLog: join(projectRoot, '.claude', 'runtime', 'cycle-compliance.log'),
      violationsLog: join(projectRoot, '.claude', 'runtime', 'violations.log')
    };
    
    // Load cycle enforcement config if available
    const cycleConfigPath = join(projectRoot, '.claude', 'config', 'cycle-enforcement.json');
    if (existsSync(cycleConfigPath)) {
      this.config.cycleEnforcement = JSON.parse(readFileSync(cycleConfigPath, 'utf-8'));
    }
  }

  private getDefaultTestRules() {
    return {
      rules: {
        operations: {
          delete: {
            files: {
              level: 2,
              require_confirmation: true,
              forbidden_patterns: ["*.env", "*.md", "package.json"]
            }
          },
          create: {
            files: {
              level: 1,
              auto_approve: true
            }
          }
        },
        behaviors: {
          audit_trail: {
            enabled: true,
            log_file: ".claude/runtime/audit.log"
          }
        }
      }
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
    cycleRequired?: boolean;
    operationId?: string;
  }> {
    // Generate operation ID for cycle tracking
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Check forbidden patterns
    const forbidden = this.checkForbiddenPatterns(operation, target);
    if (forbidden) {
      await this.reportViolation(operationId, `Forbidden pattern: ${forbidden}`, { operation, target });
      return {
        allowed: false,
        level: 99,
        requiresConfirmation: false,
        message: `Operation forbidden: ${forbidden}`,
        operationId
      };
    }

    // Get operation level
    const level = this.getOperationLevel(operation, target);
    
    // Check if confirmation required
    const requiresConfirmation = level >= 2;

    // Check if cycle is required
    const cycleRequired = this.config.cycleEnforcement?.enforcement_rules.strict_mode && level >= 0;

    if (cycleRequired) {
      // Initialize cycle for this operation
      await this.initializeCycle(operationId, operation, target);
    }

    return {
      allowed: true,
      level,
      requiresConfirmation,
      message: requiresConfirmation ? this.getConfirmationMessage(operation, target, context) : undefined,
      cycleRequired,
      operationId
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

  /**
   * Validate 7-step cycle compliance
   */
  async validateCycleCompliance(operationId: string, operation: string, target: string): Promise<{
    compliant: boolean;
    message?: string;
    requiredSteps?: string[];
    missingSteps?: string[];
  }> {
    if (!this.config.cycleEnforcement || !this.config.cycleEnforcement.enforcement_rules.strict_mode) {
      return { compliant: true };
    }

    const level = this.getOperationLevel(operation, target);
    const requiredSteps = this.getRequiredCycleSteps(level);
    
    const cycleState = this.cycleStates.get(operationId);
    if (!cycleState) {
      return {
        compliant: false,
        message: `No cycle state found for operation ${operationId}. Must initialize cycle first.`,
        requiredSteps
      };
    }

    const completedStepNames = cycleState.completedSteps.map(s => s.name);
    const missingSteps = requiredSteps.filter(step => !completedStepNames.includes(step));

    if (missingSteps.length > 0) {
      return {
        compliant: false,
        message: `Operation requires completion of all cycle steps. Missing: ${missingSteps.join(', ')}`,
        requiredSteps,
        missingSteps
      };
    }

    return { compliant: true, requiredSteps };
  }

  /**
   * Initialize cycle for operation
   */
  async initializeCycle(operationId: string, operation: string, target: string): Promise<void> {
    const level = this.getOperationLevel(operation, target);
    const requiredSteps = this.getRequiredCycleSteps(level);

    const cycleState: CycleState = {
      operationId,
      level,
      requiredSteps,
      completedSteps: [],
      status: 'pending'
    };

    this.cycleStates.set(operationId, cycleState);
    await this.logCycleEvent(operationId, 'INITIALIZED', { level, requiredSteps });
  }

  /**
   * Record cycle step completion
   */
  async recordCycleStep(operationId: string, stepName: string): Promise<void> {
    const cycleState = this.cycleStates.get(operationId);
    if (!cycleState) {
      throw new Error(`No cycle state found for operation ${operationId}`);
    }

    // Check if step is required for this operation
    if (!cycleState.requiredSteps.includes(stepName)) {
      return; // Skip non-required steps
    }

    // Check if step already completed
    if (cycleState.completedSteps.some(s => s.name === stepName)) {
      return; // Already completed
    }

    const stepId = this.getStepId(stepName);
    cycleState.completedSteps.push({
      id: stepId,
      name: stepName,
      completed: true,
      timestamp: new Date().toISOString()
    });

    cycleState.status = 'in_progress';
    await this.logCycleEvent(operationId, 'STEP_COMPLETED', { step: stepName });
  }

  /**
   * Complete cycle for operation
   */
  async completeCycle(operationId: string): Promise<void> {
    const cycleState = this.cycleStates.get(operationId);
    if (!cycleState) {
      throw new Error(`No cycle state found for operation ${operationId}`);
    }

    cycleState.status = 'completed';
    await this.logCycleEvent(operationId, 'COMPLETED', { 
      completedSteps: cycleState.completedSteps.map(s => s.name) 
    });
    
    // Clean up after a delay
    setTimeout(() => this.cycleStates.delete(operationId), 300000); // 5 minutes
  }

  /**
   * Report cycle violation
   */
  async reportViolation(operationId: string, violation: string, context?: any): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      operationId,
      violation,
      context,
      consequence: 'OPERATION_BLOCKED'
    };

    const fs = await import('fs/promises');
    await fs.mkdir(dirname(this.config.violationsLog!), { recursive: true });
    await fs.appendFile(
      this.config.violationsLog!,
      `${JSON.stringify(entry)}\\n`
    );
  }

  /**
   * Get required cycle steps for operation level
   */
  private getRequiredCycleSteps(level: number): string[] {
    if (!this.config.cycleEnforcement) {
      return [];
    }

    const levelKey = `level_${level}`;
    return this.config.cycleEnforcement.enforcement_rules.operation_levels[levelKey]?.required_steps
      .map((stepNum: number) => this.getStepName(stepNum)) || [];
  }

  /**
   * Get step name from ID
   */
  private getStepName(stepId: number): string {
    const stepMap: { [key: number]: string } = {
      1: 'BACKUP',
      2: 'CONFIRM',
      3: 'EXECUTE',
      4: 'VERIFY',
      5: 'EVALUATE',
      6: 'UPDATE',
      7: 'CLEANUP'
    };
    return stepMap[stepId] || `STEP_${stepId}`;
  }

  /**
   * Get step ID from name
   */
  private getStepId(stepName: string): number {
    const stepMap: { [key: string]: number } = {
      'BACKUP': 1,
      'CONFIRM': 2,
      'EXECUTE': 3,
      'VERIFY': 4,
      'EVALUATE': 5,
      'UPDATE': 6,
      'CLEANUP': 7
    };
    return stepMap[stepName] || 0;
  }

  /**
   * Log cycle event
   */
  private async logCycleEvent(operationId: string, event: string, details?: any): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      operationId,
      event,
      details
    };

    const fs = await import('fs/promises');
    await fs.mkdir(dirname(this.config.cycleComplianceLog!), { recursive: true });
    await fs.appendFile(
      this.config.cycleComplianceLog!,
      `${JSON.stringify(entry)}\\n`
    );
  }
}

// Export for MCP server integration
export default OperationGuard;