import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { WorkflowManager, Phase } from '../workflow';

// Mock child_process
vi.mock('child_process');

describe('WorkflowManager', () => {
  let workflow: WorkflowManager;

  beforeEach(() => {
    workflow = new WorkflowManager();
    vi.clearAllMocks();
  });

  describe('Phase Validation', () => {
    it('should validate all valid phases', () => {
      const validPhases: Phase[] = ['FETCH', 'INV', 'ANA', 'PLAN', 'BUILD', 'VERIF', 'REL'];

      for (const phase of validPhases) {
        expect(workflow.isValidPhase(phase)).toBe(true);
      }
    });

    it('should reject invalid phases', () => {
      const invalidPhases = ['INVALID', 'TEST', 'DEPLOY', 'fetch', 'build'];

      for (const phase of invalidPhases) {
        expect(workflow.isValidPhase(phase as Phase)).toBe(false);
      }
    });
  });

  describe('State Transitions', () => {
    it('should validate correct transitions', () => {
      const validTransitions: Array<[Phase, Phase]> = [
        ['FETCH', 'INV'],
        ['INV', 'ANA'],
        ['ANA', 'PLAN'],
        ['PLAN', 'BUILD'],
        ['BUILD', 'VERIF'],
        ['VERIF', 'REL'],
      ];

      for (const [from, to] of validTransitions) {
        const result = workflow.validateTransition(from, to);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it('should reject invalid transitions', () => {
      const invalidTransitions: Array<[Phase, Phase]> = [
        ['FETCH', 'BUILD'], // Skip phases
        ['BUILD', 'INV'], // Backward
        ['REL', 'FETCH'], // REL is terminal
        ['PLAN', 'REL'], // Skip phases
        ['ANA', 'FETCH'], // Backward
      ];

      for (const [from, to] of invalidTransitions) {
        const result = workflow.validateTransition(from, to);
        expect(result.valid).toBe(false);
        // Special case for REL which is terminal
        if (from === 'REL') {
          expect(result.error).toContain('REL is a terminal phase');
        } else {
          expect(result.error).toContain(`Invalid transition: ${from} → ${to}`);
        }
      }
    });

    it('should handle terminal phase (REL)', () => {
      const phases: Phase[] = ['FETCH', 'INV', 'ANA', 'PLAN', 'BUILD', 'VERIF'];

      for (const phase of phases) {
        const result = workflow.validateTransition('REL', phase);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('REL is a terminal phase');
      }
    });
  });

  describe('GitHub Label Management', () => {
    it('should add phase labels to issues', async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      const result = await workflow.addPhaseLabel(123, 'BUILD');

      expect(result.success).toBe(true);
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        expect.stringContaining('gh issue edit 123 --add-label "phase:BUILD"'),
        expect.any(Object)
      );
    });

    it('should add phase labels to pull requests', async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      const result = await workflow.addPhaseLabel(456, 'VERIF', 'pr');

      expect(result.success).toBe(true);
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        expect.stringContaining('gh pr edit 456 --add-label "phase:VERIF"'),
        expect.any(Object)
      );
    });

    it('should handle label addition errors', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('gh: command not found');
      });

      const result = await workflow.addPhaseLabel(123, 'BUILD');

      expect(result.success).toBe(false);
      expect(result.error).toContain('gh: command not found');
    });

    it('should remove old phase labels when adding new ones', async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      const result = await workflow.updatePhaseLabel(123, 'FETCH', 'INV');

      expect(result.success).toBe(true);

      // Should remove old label
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        expect.stringContaining('--remove-label "phase:FETCH"'),
        expect.any(Object)
      );

      // Should add new label
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        expect.stringContaining('--add-label "phase:INV"'),
        expect.any(Object)
      );
    });
  });

  describe('Phase Requirements', () => {
    it('should return correct requirements for each phase', () => {
      const requirements = {
        FETCH: ['Document retrieval', 'URL validation', 'Cache management'],
        INV: ['Reproduce issue', 'Environment setup', 'Initial analysis'],
        ANA: ['Root cause analysis', 'Impact assessment', 'Dependencies check'],
        PLAN: ['RFC document', 'WBS creation', 'Risk assessment'],
        BUILD: ['Implementation', 'Unit tests', 'Documentation'],
        VERIF: ['Integration tests', 'Performance tests', 'Security review'],
        REL: ['Release notes', 'Version bump', 'Deployment checklist'],
      };

      for (const [phase, expected] of Object.entries(requirements)) {
        const actual = workflow.getPhaseRequirements(phase as Phase);
        expect(actual).toEqual(expected);
      }
    });
  });

  describe('Workflow Status', () => {
    it('should track current phase', () => {
      expect(workflow.getCurrentPhase()).toBeUndefined();

      workflow.setCurrentPhase('FETCH');
      expect(workflow.getCurrentPhase()).toBe('FETCH');

      workflow.setCurrentPhase('INV');
      expect(workflow.getCurrentPhase()).toBe('INV');
    });

    it('should validate phase before setting', () => {
      expect(() => workflow.setCurrentPhase('INVALID' as Phase)).toThrow('Invalid phase: INVALID');
      expect(workflow.getCurrentPhase()).toBeUndefined();
    });

    it('should get next valid phases', () => {
      workflow.setCurrentPhase('FETCH');
      expect(workflow.getNextPhases()).toEqual(['INV']);

      workflow.setCurrentPhase('ANA');
      expect(workflow.getNextPhases()).toEqual(['PLAN']);

      workflow.setCurrentPhase('REL');
      expect(workflow.getNextPhases()).toEqual([]);
    });
  });

  describe('Workflow Artifacts', () => {
    it('should validate RFC artifacts for PLAN phase', () => {
      const validRFC = {
        problem: 'Description of the problem',
        solution: 'Proposed solution',
        risks: 'Potential risks',
        timeline: 'Implementation timeline',
      };

      const result = workflow.validatePhaseArtifacts('PLAN', { rfc: validRFC });
      expect(result.valid).toBe(true);
    });

    it('should reject incomplete RFC artifacts', () => {
      const incompleteRFC = {
        problem: 'Description of the problem',
        solution: 'Proposed solution',
        // Missing risks and timeline
      };

      const result = workflow.validatePhaseArtifacts('PLAN', { rfc: incompleteRFC });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('RFC missing required fields: risks, timeline');
    });

    it('should validate test results for VERIF phase', () => {
      const testResults = {
        unit: { passed: 50, failed: 0 },
        integration: { passed: 20, failed: 0 },
        coverage: 85,
      };

      const result = workflow.validatePhaseArtifacts('VERIF', { testResults });
      expect(result.valid).toBe(true);
    });

    it('should reject low test coverage', () => {
      const testResults = {
        unit: { passed: 50, failed: 5 },
        integration: { passed: 20, failed: 0 },
        coverage: 60, // Below 80% threshold
      };

      const result = workflow.validatePhaseArtifacts('VERIF', { testResults });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Test coverage (60%) below threshold (80%)');
    });
  });

  describe('Workflow History', () => {
    it('should track phase history', () => {
      workflow.setCurrentPhase('FETCH');
      workflow.setCurrentPhase('INV');
      workflow.setCurrentPhase('ANA');

      const history = workflow.getPhaseHistory();
      expect(history).toEqual([
        { phase: 'FETCH', timestamp: expect.any(Number) },
        { phase: 'INV', timestamp: expect.any(Number) },
        { phase: 'ANA', timestamp: expect.any(Number) },
      ]);
    });

    it('should calculate phase duration', () => {
      workflow.setCurrentPhase('FETCH');

      // Simulate time passing
      const startTime = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(startTime + 3600000); // 1 hour later

      workflow.setCurrentPhase('INV');

      const duration = workflow.getPhaseDuration('FETCH');
      expect(duration).toBe(3600000);

      vi.restoreAllMocks();
    });
  });

  describe('Workflow Completion', () => {
    it('should check if workflow is complete', () => {
      expect(workflow.isComplete()).toBe(false);

      // Progress through all phases
      const phases: Phase[] = ['FETCH', 'INV', 'ANA', 'PLAN', 'BUILD', 'VERIF', 'REL'];
      for (const phase of phases) {
        workflow.setCurrentPhase(phase);
      }

      expect(workflow.isComplete()).toBe(true);
    });

    it('should generate workflow summary', () => {
      const phases: Phase[] = ['FETCH', 'INV', 'ANA'];
      for (const phase of phases) {
        workflow.setCurrentPhase(phase);
      }

      const summary = workflow.getSummary();

      expect(summary.currentPhase).toBe('ANA');
      expect(summary.completedPhases).toEqual(['FETCH', 'INV', 'ANA']);
      expect(summary.remainingPhases).toEqual(['PLAN', 'BUILD', 'VERIF', 'REL']);
      expect(summary.progress).toBe(3 / 7);
    });
  });

  describe('Phase-specific Validations', () => {
    it('should enforce network access only in FETCH phase', () => {
      const content = 'Downloading from https://example.com';

      expect(workflow.validatePhaseContent('FETCH', content).valid).toBe(true);
      expect(workflow.validatePhaseContent('BUILD', content).valid).toBe(false);
    });

    it('should enforce size limits in BUILD phase', () => {
      const smallChange = { linesAdded: 500, filesChanged: 5 };
      const largeChange = { linesAdded: 1500, filesChanged: 15 };

      expect(workflow.validatePhaseContent('BUILD', '', smallChange).valid).toBe(true);
      expect(workflow.validatePhaseContent('BUILD', '', largeChange).valid).toBe(false);
    });
  });

  describe('Integration with GitHub API', () => {
    it('should fetch current phase from GitHub labels', async () => {
      vi.mocked(execSync).mockReturnValue(
        Buffer.from(
          JSON.stringify({
            labels: [{ name: 'bug' }, { name: 'phase:BUILD' }, { name: 'priority:high' }],
          })
        )
      );

      const phase = await workflow.getCurrentPhaseFromGitHub(123);
      expect(phase).toBe('BUILD');
    });

    it('should handle missing phase labels', async () => {
      vi.mocked(execSync).mockReturnValue(
        Buffer.from(
          JSON.stringify({
            labels: [{ name: 'bug' }, { name: 'enhancement' }],
          })
        )
      );

      const phase = await workflow.getCurrentPhaseFromGitHub(123);
      expect(phase).toBeUndefined();
    });

    it('should handle GitHub API errors gracefully', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('API rate limit exceeded');
      });

      const phase = await workflow.getCurrentPhaseFromGitHub(123);
      expect(phase).toBeUndefined();
    });
  });
});
