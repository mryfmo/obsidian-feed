/**
 * Advanced Workflow Automation for obsidian-feed
 *
 * Features:
 * - Automatic phase transitions based on completion criteria
 * - GitHub Issue/PR synchronization
 * - Automated artifact generation
 * - Workflow visualization and reporting
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { WorkflowManager, Phase, WorkflowState, WorkflowResult } from './workflow';
import { Validator } from './validator';
import { MCPIntegration } from './index';

export interface AutomationConfig {
  autoTransition: boolean;
  githubIntegration: boolean;
  artifactGeneration: boolean;
  notificationEnabled: boolean;
}

export interface PhaseCompletionCriteria {
  phase: Phase;
  criteria: {
    requiredArtifacts: string[];
    requiredGuards: string[];
    requiredApprovals?: string[];
    customChecks?: (() => Promise<boolean>)[];
  };
}

export class WorkflowAutomation {
  private workflowManager: WorkflowManager;

  private validator: Validator;

  private mcp!: MCPIntegration;

  private config: AutomationConfig;

  constructor(
    config: AutomationConfig = {
      autoTransition: true,
      githubIntegration: true,
      artifactGeneration: true,
      notificationEnabled: true,
    }
  ) {
    this.workflowManager = new WorkflowManager();
    this.validator = new Validator();
    this.config = config;
  }

  /**
   * Initialize MCP integration
   */
  async initialize(): Promise<void> {
    this.mcp = new MCPIntegration();
    // MCPIntegration constructor handles initialization
  }

  /**
   * Define completion criteria for each phase
   */
  private getCompletionCriteria(): Record<Phase, PhaseCompletionCriteria['criteria']> {
    return {
      FETCH: {
        requiredArtifacts: ['doc-list.md', '.cache/'],
        requiredGuards: ['G-DUP', 'G-NET'],
        customChecks: [async () => this.checkCachePopulated()],
      },
      INV: {
        requiredArtifacts: ['fail-log.md', 'qa-sheet.md'],
        requiredGuards: ['G-PHASE', 'G-TRIAGE'],
        customChecks: [async () => this.checkReproductionSuccessful()],
      },
      ANA: {
        requiredArtifacts: ['cause-tree.md', 'impact.md', 'risks.md'],
        requiredGuards: ['G-PHASE'],
        requiredApprovals: ['reviewer'],
        customChecks: [async () => this.checkRootCauseIdentified()],
      },
      PLAN: {
        requiredArtifacts: ['rfc-draft.md', 'test-plan.md', 'patch-plan.md'],
        requiredGuards: ['G-RFC', 'G-WBS-OK'],
        requiredApprovals: ['reviewer', 'architect'],
        customChecks: [async () => this.checkDesignApproved()],
      },
      BUILD: {
        requiredArtifacts: ['src/', 'test/', 'docs/'],
        requiredGuards: ['G-SIZE', 'G-TEST', 'G-LINT', 'G-TYPE'],
        customChecks: [
          async () => this.checkTestsPassing(),
          async () => this.checkCoverageThreshold(),
        ],
      },
      VERIF: {
        requiredArtifacts: ['coverage.html', 'qa-results.md', 'perf-report.md'],
        requiredGuards: ['G-COV', 'G-PERF', 'G-SEC'],
        requiredApprovals: ['qa-lead'],
        customChecks: [async () => this.checkNoRegressions()],
      },
      REL: {
        requiredArtifacts: ['CHANGELOG.md', 'RELEASE.md', 'package.json'],
        requiredGuards: ['G-SEMVER', 'G-CHANGELOG', 'G-README'],
        requiredApprovals: ['release-manager'],
        customChecks: [async () => this.checkReleaseReady()],
      },
    };
  }

  /**
   * Automatically check if current phase is complete and transition if ready
   */
  async checkAndTransition(taskId: string): Promise<WorkflowResult> {
    if (!this.config.autoTransition) {
      return { success: true, data: { message: 'Auto-transition disabled' } };
    }

    const state = await this.workflowManager.getState(taskId);
    if (!state) {
      return { success: false, error: 'Task not found' };
    }

    const criteria = this.getCompletionCriteria()[state.currentPhase];
    const isComplete = await this.checkPhaseCompletion(taskId, state.currentPhase, criteria);

    if (isComplete) {
      const nextPhase = this.getNextPhase(state.currentPhase);
      if (nextPhase) {
        await this.workflowManager.transitionPhase(taskId, nextPhase);

        if (this.config.notificationEnabled) {
          await this.notifyTransition(taskId, state.currentPhase, nextPhase);
        }

        if (this.config.artifactGeneration) {
          await this.generatePhaseArtifacts(taskId, nextPhase);
        }

        return {
          success: true,
          data: {
            transitioned: true,
            from: state.currentPhase,
            to: nextPhase,
          },
        };
      }
    }

    return {
      success: true,
      data: {
        transitioned: false,
        currentPhase: state.currentPhase,
        completionStatus: isComplete,
      },
    };
  }

  /**
   * Check if phase completion criteria are met
   */
  private async checkPhaseCompletion(
    taskId: string,
    phase: Phase,
    criteria: PhaseCompletionCriteria['criteria']
  ): Promise<boolean> {
    // Check required artifacts
    for (const artifact of criteria.requiredArtifacts) {
      if (!(await this.artifactExists(taskId, artifact))) {
        return false;
      }
    }

    // Check required guards
    for (const guard of criteria.requiredGuards) {
      if (!(await this.guardPassed(taskId, guard))) {
        return false;
      }
    }

    // Check required approvals
    if (criteria.requiredApprovals) {
      for (const approver of criteria.requiredApprovals) {
        if (!(await this.hasApproval(taskId, approver))) {
          return false;
        }
      }
    }

    // Run custom checks
    if (criteria.customChecks) {
      for (const check of criteria.customChecks) {
        if (!(await check())) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Generate artifacts for the next phase
   */
  private async generatePhaseArtifacts(taskId: string, phase: Phase): Promise<void> {
    const artifactGenerators: Record<Phase, () => Promise<void>> = {
      FETCH: async () => {
        // Generate doc-list.md
        await this.generateDocList(taskId);
      },
      INV: async () => {
        // Generate test template
        await this.generateTestTemplate(taskId);
      },
      ANA: async () => {
        // Generate cause tree template
        await this.generateCauseTreeTemplate(taskId);
      },
      PLAN: async () => {
        // Generate RFC template
        await this.generateRFCTemplate(taskId);
      },
      BUILD: async () => {
        // Generate code structure
        await this.generateCodeStructure(taskId);
      },
      VERIF: async () => {
        // Generate test report template
        await this.generateTestReportTemplate(taskId);
      },
      REL: async () => {
        // Generate release checklist
        await this.generateReleaseChecklist(taskId);
      },
    };

    const generator = artifactGenerators[phase];
    if (generator) {
      await generator();
    }
  }

  /**
   * Sync workflow state with GitHub
   */
  async syncWithGitHub(taskId: string): Promise<WorkflowResult> {
    if (!this.config.githubIntegration) {
      return { success: true, data: { message: 'GitHub integration disabled' } };
    }

    const state = await this.workflowManager.getState(taskId);
    if (!state || !state.issueNumber) {
      return { success: false, error: 'No GitHub issue associated' };
    }

    try {
      // Update issue labels
      await this.updateGitHubLabels(state.issueNumber, state.currentPhase);

      // Add progress comment
      await this.addProgressComment(state.issueNumber, state);

      // Update milestone if needed
      await this.updateMilestone(state.issueNumber, state.currentPhase);

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Generate workflow visualization
   */
  async generateVisualization(taskId: string): Promise<string> {
    const state = await this.workflowManager.getState(taskId);
    if (!state) {
      throw new Error('Task not found');
    }

    const phases: Phase[] = ['FETCH', 'INV', 'ANA', 'PLAN', 'BUILD', 'VERIF', 'REL'];
    const mermaid = ['graph LR'];

    phases.forEach((phase, index) => {
      const isCompleted = state.completedPhases.includes(phase);
      const isCurrent = state.currentPhase === phase;

      let style = '';
      if (isCompleted) {
        style = ':::completed';
      } else if (isCurrent) {
        style = ':::current';
      }

      mermaid.push(`  ${phase}[${phase}]${style}`);

      if (index < phases.length - 1) {
        mermaid.push(`  ${phase} --> ${phases[index + 1]}`);
      }
    });

    // Add styles
    mermaid.push('');
    mermaid.push('classDef completed fill:#90EE90,stroke:#333,stroke-width:2px;');
    mermaid.push('classDef current fill:#87CEEB,stroke:#333,stroke-width:4px;');

    return mermaid.join('\n');
  }

  /**
   * Monitor workflow progress and generate reports
   */
  async generateProgressReport(taskId: string): Promise<string> {
    const state = await this.workflowManager.getState(taskId);
    if (!state) {
      throw new Error('Task not found');
    }

    const report = [
      `# Workflow Progress Report`,
      `## Task: ${taskId}`,
      ``,
      `### Current Status`,
      `- **Phase**: ${state.currentPhase}`,
      `- **Started**: ${state.startTime}`,
      `- **Last Updated**: ${state.lastUpdate}`,
      ``,
      `### Completed Phases`,
      ...state.completedPhases.map(phase => `- ✅ ${phase}`),
      ``,
      `### Phase Transitions`,
      ...state.transitions.map(
        t => `- ${t.from} → ${t.to} (${t.timestamp})${t.validatedBy ? ` by ${t.validatedBy}` : ''}`
      ),
      ``,
      `### Artifacts`,
      ...Object.entries(state.artifacts).map(
        ([key, value]) =>
          `- **${key}**: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`
      ),
      ``,
      `### Next Steps`,
      `- Complete ${state.currentPhase} phase requirements`,
      `- Obtain necessary approvals`,
      `- Run validation checks`,
    ];

    return report.join('\n');
  }

  // Helper methods
  private getNextPhase(currentPhase: Phase): Phase | null {
    const phaseOrder: Phase[] = ['FETCH', 'INV', 'ANA', 'PLAN', 'BUILD', 'VERIF', 'REL'];
    const currentIndex = phaseOrder.indexOf(currentPhase);

    if (currentIndex === -1 || currentIndex === phaseOrder.length - 1) {
      return null;
    }

    return phaseOrder[currentIndex + 1];
  }

  private async artifactExists(taskId: string, artifact: string): Promise<boolean> {
    const workflowDir = path.join('.workflow', taskId);
    const artifactPath = path.join(workflowDir, artifact);
    return fs.existsSync(artifactPath);
  }

  private async guardPassed(taskId: string, guard: string): Promise<boolean> {
    // Check guard validation results
    const validationLog = path.join('.workflow', taskId, 'validation.log');
    if (fs.existsSync(validationLog)) {
      const log = fs.readFileSync(validationLog, 'utf8');
      return log.includes(`${guard}: PASS`);
    }
    return false;
  }

  private async hasApproval(taskId: string, approver: string): Promise<boolean> {
    const approvalFile = path.join('.workflow', taskId, 'approvals.json');
    if (fs.existsSync(approvalFile)) {
      const approvals = JSON.parse(fs.readFileSync(approvalFile, 'utf8'));
      return approvals[approver] === true;
    }
    return false;
  }

  // Placeholder methods for custom checks
  private async checkCachePopulated(): Promise<boolean> {
    return fs.existsSync('.cache') && fs.readdirSync('.cache').length > 0;
  }

  private async checkReproductionSuccessful(): Promise<boolean> {
    // Check if reproduction steps executed successfully
    return true;
  }

  private async checkRootCauseIdentified(): Promise<boolean> {
    // Check if root cause analysis is complete
    return true;
  }

  private async checkDesignApproved(): Promise<boolean> {
    // Check if design documents are approved
    return true;
  }

  private async checkTestsPassing(): Promise<boolean> {
    try {
      execSync('pnpm test', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async checkCoverageThreshold(): Promise<boolean> {
    // Check if coverage meets threshold
    return true;
  }

  private async checkNoRegressions(): Promise<boolean> {
    // Check for performance regressions
    return true;
  }

  private async checkReleaseReady(): Promise<boolean> {
    // Check if release criteria are met
    return true;
  }

  // Notification methods
  private async notifyTransition(taskId: string, from: Phase, to: Phase): Promise<void> {
    console.log(`[Workflow] Task ${taskId} transitioned from ${from} to ${to}`);
    // Additional notification logic (email, Slack, etc.)
  }

  // GitHub integration methods
  private async updateGitHubLabels(issueNumber: number, phase: Phase): Promise<void> {
    // Update GitHub issue labels
    console.log(`[GitHub] Updating labels for issue #${issueNumber} to phase: ${phase}`);
  }

  private async addProgressComment(issueNumber: number, state: WorkflowState): Promise<void> {
    // Add progress comment to GitHub issue
    const comment = await this.generateProgressReport(state.taskId);
    console.log(`[GitHub] Adding progress comment to issue #${issueNumber}`);
    // TODO: Actually post the comment to GitHub using MCP GitHub server or gh CLI
    console.log(`Comment preview:\n${comment.substring(0, 200)}...`);
  }

  private async updateMilestone(issueNumber: number, _phase: Phase): Promise<void> {
    // Update GitHub milestone based on phase
    console.log(`[GitHub] Updating milestone for issue #${issueNumber}`);
    // TODO: Map phase to milestone and update via GitHub API
  }

  // Artifact generation methods
  private async generateDocList(taskId: string): Promise<void> {
    const content = `# Documentation List\n\n- [ ] API Documentation\n- [ ] User Guide\n- [ ] Architecture Docs\n`;
    await this.saveArtifact(taskId, 'doc-list.md', content);
  }

  private async generateTestTemplate(taskId: string): Promise<void> {
    const content = `describe('Feature', () => {\n  it('should work', () => {\n    expect(true).toBe(true);\n  });\n});\n`;
    await this.saveArtifact(taskId, 'test-template.spec.ts', content);
  }

  private async generateCauseTreeTemplate(taskId: string): Promise<void> {
    const content = `# Root Cause Analysis\n\n## Problem\n\n## Causes\n\n## Impact\n\n## Solution\n`;
    await this.saveArtifact(taskId, 'cause-tree.md', content);
  }

  private async generateRFCTemplate(taskId: string): Promise<void> {
    const content = `# RFC: [Title]\n\n## Problem\n\n## Solution\n\n## Risks\n\n## Timeline\n\n## Alternatives\n`;
    await this.saveArtifact(taskId, 'rfc-template.md', content);
  }

  private async generateCodeStructure(taskId: string): Promise<void> {
    const content = `// Implementation structure\nexport class Feature {\n  // TODO: Implement\n}\n`;
    await this.saveArtifact(taskId, 'structure.ts', content);
  }

  private async generateTestReportTemplate(taskId: string): Promise<void> {
    const content = `# Test Report\n\n## Unit Tests\n- Passed: 0\n- Failed: 0\n\n## Integration Tests\n- Passed: 0\n- Failed: 0\n\n## Coverage\n- Statements: 0%\n- Branches: 0%\n- Functions: 0%\n- Lines: 0%\n`;
    await this.saveArtifact(taskId, 'test-report.md', content);
  }

  private async generateReleaseChecklist(taskId: string): Promise<void> {
    const content = `# Release Checklist\n\n- [ ] All tests passing\n- [ ] Documentation updated\n- [ ] CHANGELOG updated\n- [ ] Version bumped\n- [ ] Release notes written\n- [ ] Security scan completed\n- [ ] Performance benchmarks run\n`;
    await this.saveArtifact(taskId, 'release-checklist.md', content);
  }

  private async saveArtifact(taskId: string, filename: string, content: string): Promise<void> {
    const workflowDir = path.join('.workflow', taskId);
    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
    }
    fs.writeFileSync(path.join(workflowDir, filename), content);
  }
}

// Export for use in bridge.ts and other integrations
export default WorkflowAutomation;
