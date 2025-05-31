/**
 * Enhanced workflow manager - Complete 7-phase lifecycle management
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export type Phase = 'FETCH' | 'INV' | 'ANA' | 'PLAN' | 'BUILD' | 'VERIF' | 'REL';

export interface WorkflowState {
  taskId: string;
  currentPhase: Phase;
  completedPhases: Phase[];
  artifacts: Record<string, unknown>;
  transitions: Array<{
    from: Phase;
    to: Phase;
    timestamp: string;
    validatedBy?: string;
  }>;
  repository?: string;
  issueNumber?: number;
  startTime: string;
  lastUpdate: string;
}

export interface WorkflowResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

interface PhaseTransition {
  phase: Phase;
  timestamp: number;
}

interface PhaseArtifacts {
  rfc?: {
    problem?: string;
    solution?: string;
    risks?: string;
    timeline?: string;
  };
  testResults?: {
    unit?: { passed: number; failed: number };
    integration?: { passed: number; failed: number };
    coverage?: number;
  };
}

export class WorkflowManager {
  private stateDir = '.workflow';

  private validPhases: Phase[] = ['FETCH', 'INV', 'ANA', 'PLAN', 'BUILD', 'VERIF', 'REL'];

  private validTransitions: Record<Phase, Phase[]> = {
    FETCH: ['INV'],
    INV: ['ANA'],
    ANA: ['PLAN'],
    PLAN: ['BUILD'],
    BUILD: ['VERIF'],
    VERIF: ['REL'],
    REL: [],
  };

  private mcpClients?: {
    github?: {
      add_labels: (params: {
        issue_number: number;
        labels: string[];
        owner?: string;
        repo?: string;
      }) => Promise<void>;
      remove_labels: (params: {
        issue_number: number;
        labels: string[];
        owner?: string;
        repo?: string;
      }) => Promise<void>;
      get_issue: (params: {
        issue_number: number;
      }) => Promise<{ labels?: Array<string | { name: string }> }>;
    };
    memory?: {
      store: (params: { key: string; value: unknown }) => Promise<void>;
      retrieve: (params: { key: string }) => Promise<unknown>;
    };
    filesystem?: unknown;
    fetch?: unknown;
  };

  private currentPhase?: Phase;

  private phaseHistory: PhaseTransition[] = [];

  setMCPClients(clients: {
    github?: {
      add_labels: (params: {
        issue_number: number;
        labels: string[];
        owner?: string;
        repo?: string;
      }) => Promise<void>;
      remove_labels: (params: {
        issue_number: number;
        labels: string[];
        owner?: string;
        repo?: string;
      }) => Promise<void>;
      get_issue: (params: {
        issue_number: number;
      }) => Promise<{ labels?: Array<string | { name: string }> }>;
    };
    memory?: {
      store: (params: { key: string; value: unknown }) => Promise<void>;
      retrieve: (params: { key: string }) => Promise<unknown>;
    };
    filesystem?: unknown;
    fetch?: unknown;
  }): void {
    this.mcpClients = clients;
  }

  isValidPhase(phase: string): phase is Phase {
    return this.validPhases.includes(phase as Phase);
  }

  validateTransition(from: Phase, to: Phase): { valid: boolean; error?: string } {
    if (!this.isValidPhase(from) || !this.isValidPhase(to)) {
      return { valid: false, error: 'Invalid phase' };
    }

    const allowedTransitions = this.validTransitions[from];

    if (from === 'REL') {
      return { valid: false, error: 'REL is a terminal phase' };
    }

    if (!allowedTransitions.includes(to)) {
      return { valid: false, error: `Invalid transition: ${from} → ${to}` };
    }

    return { valid: true };
  }

  async addPhaseLabel(
    issueNumber: number,
    phase: Phase,
    type: 'issue' | 'pr' = 'issue'
  ): Promise<WorkflowResult> {
    try {
      // Try MCP GitHub server first if available
      if (this.mcpClients?.github) {
        try {
          await this.mcpClients.github.add_labels({
            issue_number: issueNumber,
            labels: [`phase:${phase}`],
          });
          return { success: true };
        } catch (mcpError) {
          console.warn('MCP GitHub add label failed, falling back to gh CLI:', mcpError);
        }
      }

      // Fallback to gh CLI
      const command = `gh ${type} edit ${issueNumber} --add-label "phase:${phase}"`;
      execSync(command, { encoding: 'utf8' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async updatePhaseLabel(
    issueNumber: number,
    oldPhase: Phase,
    newPhase: Phase,
    type: 'issue' | 'pr' = 'issue'
  ): Promise<WorkflowResult> {
    try {
      // Try MCP GitHub server first if available
      if (this.mcpClients?.github) {
        try {
          // Remove old label
          await this.mcpClients.github.remove_labels({
            issue_number: issueNumber,
            labels: [`phase:${oldPhase}`],
          });

          // Add new label
          await this.mcpClients.github.add_labels({
            issue_number: issueNumber,
            labels: [`phase:${newPhase}`],
          });

          return { success: true };
        } catch (mcpError) {
          console.warn('MCP GitHub update label failed, falling back to gh CLI:', mcpError);
        }
      }

      // Fallback to gh CLI
      // Remove old label
      const removeCommand = `gh ${type} edit ${issueNumber} --remove-label "phase:${oldPhase}"`;
      execSync(removeCommand, { encoding: 'utf8' });

      // Add new label
      const addCommand = `gh ${type} edit ${issueNumber} --add-label "phase:${newPhase}"`;
      execSync(addCommand, { encoding: 'utf8' });

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  getPhaseRequirements(phase: Phase): string[] {
    const requirements: Record<Phase, string[]> = {
      FETCH: ['Document retrieval', 'URL validation', 'Cache management'],
      INV: ['Reproduce issue', 'Environment setup', 'Initial analysis'],
      ANA: ['Root cause analysis', 'Impact assessment', 'Dependencies check'],
      PLAN: ['RFC document', 'WBS creation', 'Risk assessment'],
      BUILD: ['Implementation', 'Unit tests', 'Documentation'],
      VERIF: ['Integration tests', 'Performance tests', 'Security review'],
      REL: ['Release notes', 'Version bump', 'Deployment checklist'],
    };

    return requirements[phase] || [];
  }

  getCurrentPhase(): Phase | undefined {
    return this.currentPhase;
  }

  setCurrentPhase(phase: Phase): void {
    if (!this.isValidPhase(phase)) {
      throw new Error(`Invalid phase: ${phase}`);
    }

    this.currentPhase = phase;
    this.phaseHistory.push({ phase, timestamp: Date.now() });
  }

  getNextPhases(): Phase[] {
    if (!this.currentPhase) {
      return ['FETCH'];
    }
    return this.validTransitions[this.currentPhase] || [];
  }

  validatePhaseArtifacts(
    phase: Phase,
    artifacts: PhaseArtifacts
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (phase === 'PLAN' && artifacts.rfc) {
      const requiredFields = ['problem', 'solution', 'risks', 'timeline'];
      const missingFields = requiredFields.filter(field => {
        const rfc = artifacts.rfc;
        return rfc && !rfc[field as keyof typeof rfc];
      });

      if (missingFields.length > 0) {
        errors.push(`RFC missing required fields: ${missingFields.join(', ')}`);
      }
    }

    if (phase === 'VERIF' && artifacts.testResults) {
      const { testResults } = artifacts;

      if (testResults.unit && testResults.unit.failed > 0) {
        errors.push(`Unit tests have ${testResults.unit.failed} failures`);
      }

      if (testResults.coverage !== undefined && testResults.coverage < 80) {
        errors.push(`Test coverage (${testResults.coverage}%) below threshold (80%)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getPhaseHistory(): PhaseTransition[] {
    return [...this.phaseHistory];
  }

  getPhaseDuration(phase: Phase): number | undefined {
    const transitions = this.phaseHistory;
    const phaseIndex = transitions.findIndex(t => t.phase === phase);

    if (phaseIndex === -1 || phaseIndex === transitions.length - 1) {
      return undefined;
    }

    const startTime = transitions[phaseIndex].timestamp;
    const endTime = transitions[phaseIndex + 1].timestamp;

    return endTime - startTime;
  }

  isComplete(): boolean {
    return this.currentPhase === 'REL';
  }

  getSummary(): {
    currentPhase?: Phase;
    completedPhases: Phase[];
    remainingPhases: Phase[];
    progress: number;
  } {
    const completedPhases = this.phaseHistory.map(h => h.phase);
    const uniqueCompleted = [...new Set(completedPhases)];

    const currentIndex = this.currentPhase ? this.validPhases.indexOf(this.currentPhase) : -1;
    const remainingPhases =
      currentIndex >= 0 ? this.validPhases.slice(currentIndex + 1) : this.validPhases;

    return {
      currentPhase: this.currentPhase,
      completedPhases: uniqueCompleted,
      remainingPhases,
      progress: uniqueCompleted.length / this.validPhases.length,
    };
  }

  validatePhaseContent(
    phase: Phase,
    content: string,
    changeMetrics?: { linesAdded: number; filesChanged: number }
  ): { valid: boolean; error?: string } {
    // Network access validation
    if (phase !== 'FETCH' && /https?:\/\//.test(content)) {
      return { valid: false, error: 'Network access only allowed in FETCH phase' };
    }

    // Size limits in BUILD phase
    if (phase === 'BUILD' && changeMetrics) {
      if (changeMetrics.linesAdded > 1000 || changeMetrics.filesChanged > 10) {
        return { valid: false, error: 'Change size exceeds limits for BUILD phase' };
      }
    }

    return { valid: true };
  }

  async getCurrentPhaseFromGitHub(issueNumber: number): Promise<Phase | undefined> {
    try {
      let labels: Array<string | { name: string }> = [];

      // Try MCP GitHub server first if available
      if (this.mcpClients?.github) {
        try {
          const issue = await this.mcpClients.github.get_issue({
            issue_number: issueNumber,
          });
          labels = issue.labels || [];
        } catch (mcpError) {
          console.warn('MCP GitHub get issue failed, falling back to gh CLI:', mcpError);
          // Fallback to gh CLI
          const output = execSync(`gh issue view ${issueNumber} --json labels`, {
            encoding: 'utf8',
          });
          const data = JSON.parse(output);
          labels = data.labels || [];
        }
      } else {
        // Use gh CLI if MCP not available
        const output = execSync(`gh issue view ${issueNumber} --json labels`, { encoding: 'utf8' });
        const data = JSON.parse(output);
        labels = data.labels || [];
      }

      const phaseLabel = labels.find(label =>
        (typeof label === 'string' ? label : label.name).startsWith('phase:')
      );

      if (phaseLabel) {
        const labelName = typeof phaseLabel === 'string' ? phaseLabel : phaseLabel.name;
        const phase = labelName.replace('phase:', '');
        return this.isValidPhase(phase) ? (phase as Phase) : undefined;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  async initTask(taskId: string, repository?: string): Promise<string> {
    const state: WorkflowState = {
      taskId,
      currentPhase: 'FETCH',
      completedPhases: [],
      artifacts: {},
      transitions: [],
      repository,
      issueNumber: repository ? this.extractIssueNumber(repository) : undefined,
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    };

    await this.saveState(taskId, state);

    // Update GitHub labels if available
    if (this.mcpClients?.github && state.repository && state.issueNumber) {
      await this.updateGitHubLabels(state.repository, state.issueNumber, 'FETCH');
    }

    return JSON.stringify(state, null, 2);
  }

  async transition(taskId: string, toPhase: string): Promise<string> {
    const state = await this.loadState(taskId);

    if (!state) {
      throw new Error(`Task ${taskId} not found`);
    }

    const targetPhase = toPhase as Phase;
    const validNext = this.validTransitions[state.currentPhase];

    if (!validNext.includes(targetPhase)) {
      throw new Error(
        `Invalid transition: ${state.currentPhase} → ${targetPhase}. ` +
          `Valid transitions: ${validNext.join(', ')}`
      );
    }

    // Record transition
    state.transitions.push({
      from: state.currentPhase,
      to: targetPhase,
      timestamp: new Date().toISOString(),
      validatedBy: 'WorkflowManager',
    });

    // Update state
    state.completedPhases.push(state.currentPhase);
    state.currentPhase = targetPhase;
    state.lastUpdate = new Date().toISOString();

    await this.saveState(taskId, state);

    // Update GitHub labels
    if (this.mcpClients?.github && state.repository && state.issueNumber) {
      const oldPhase = state.completedPhases[state.completedPhases.length - 1];
      await this.updateGitHubLabels(state.repository, state.issueNumber, targetPhase, oldPhase);
    }

    return `Transitioned to ${targetPhase}`;
  }

  async getStatus(taskId: string): Promise<string> {
    const state = await this.loadState(taskId);
    if (!state) {
      return `Task ${taskId} not found`;
    }

    const status = [
      `Task: ${state.taskId}`,
      `Current Phase: ${state.currentPhase}`,
      `Completed Phases: ${state.completedPhases.join(' → ')}`,
      `Artifacts: ${Object.keys(state.artifacts).length}`,
      `Transitions: ${state.transitions.length}`,
    ];

    if (state.repository) {
      status.push(`Repository: ${state.repository}`);
    }
    if (state.issueNumber) {
      status.push(`Issue: #${state.issueNumber}`);
    }

    return status.join('\n');
  }

  async addArtifact(taskId: string, name: string, content: unknown): Promise<void> {
    const state = await this.loadState(taskId);
    if (!state) {
      throw new Error(`Task ${taskId} not found`);
    }

    state.artifacts[name] = content;
    await this.saveState(taskId, state);
  }

  async getState(taskId: string): Promise<WorkflowState | null> {
    return this.loadState(taskId);
  }

  async transitionPhase(taskId: string, toPhase: Phase): Promise<void> {
    await this.transition(taskId, toPhase);
  }

  private async saveState(taskId: string, state: WorkflowState): Promise<void> {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }

    const statePath = path.join(this.stateDir, `${taskId}.json`);
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    // Also save to memory if available
    if (this.mcpClients?.memory) {
      try {
        await this.mcpClients.memory.store({
          key: `workflow:${taskId}`,
          value: state,
        });
      } catch (error) {
        console.warn('Failed to save to memory:', error);
      }
    }
  }

  private async loadState(taskId: string): Promise<WorkflowState | null> {
    // Try memory first
    if (this.mcpClients?.memory) {
      try {
        const state = await this.mcpClients.memory.retrieve({
          key: `workflow:${taskId}`,
        });
        if (state) return state as WorkflowState;
      } catch {
        // Fall back to file
      }
    }

    const statePath = path.join(this.stateDir, `${taskId}.json`);
    if (!fs.existsSync(statePath)) {
      return null;
    }

    const content = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(content);
  }

  private extractIssueNumber(repository: string): number | undefined {
    // Extract from format like "owner/repo#123"
    const match = repository.match(/#(\d+)$/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  private async updateGitHubLabels(
    repository: string,
    issueNumber: number,
    newPhase: Phase,
    oldPhase?: Phase
  ): Promise<void> {
    try {
      const [owner, repo] = repository.replace(/#\d+$/, '').split('/');

      // Try MCP GitHub server first if available
      if (this.mcpClients?.github) {
        try {
          // Remove old phase label
          if (oldPhase) {
            await this.mcpClients.github.remove_labels({
              owner,
              repo,
              issue_number: issueNumber,
              labels: [`phase:${oldPhase}`],
            });
          }

          // Add new phase label
          await this.mcpClients.github.add_labels({
            owner,
            repo,
            issue_number: issueNumber,
            labels: [`phase:${newPhase}`],
          });

          return; // Success with MCP
        } catch (mcpError) {
          console.warn('MCP GitHub labels update failed, falling back to gh CLI:', mcpError);
        }
      }

      // Fallback to gh CLI
      if (oldPhase) {
        execSync(
          `gh issue edit ${issueNumber} --repo ${repository} --remove-label "phase:${oldPhase}"`,
          { encoding: 'utf8' }
        );
      }
      execSync(
        `gh issue edit ${issueNumber} --repo ${repository} --add-label "phase:${newPhase}"`,
        { encoding: 'utf8' }
      );
    } catch (error) {
      console.warn('Failed to update GitHub labels:', error);
    }
  }
}
