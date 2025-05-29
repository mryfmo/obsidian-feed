import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Validator, ValidationResult } from '../validator';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Mock fs and child_process
vi.mock('fs');
vi.mock('child_process');

describe('Validator', () => {
  let validator: Validator;
  
  beforeEach(() => {
    validator = new Validator();
    vi.clearAllMocks();
  });

  describe('Tag Order Validation (G-PHASE)', () => {
    it('should validate correct tag order', async () => {
      const content = `FETCH: Example task

<think>
Analysis here with enough words to pass the token check
We need at least twenty tokens for this to be valid
</think>

<act>
# step-plan: do something
Actions here
</act>

<verify>
Verification
</verify>

<next>
Next steps
</next>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      // Log errors for debugging
      if (!result.valid) {
        console.log('Validation errors:', result.errors);
      }
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail on incorrect tag order', async () => {
      const content = `FETCH: Test task

<act>
Actions first
</act>

<think>
${Array(30).fill('word').join(' ')}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('G-PHASE: Tag order invalid: act think');
    });
  });

  describe('Think Token Validation (G-TOKEN)', () => {
    it('should pass with valid token count', async () => {
      const words = Array(50).fill('word').join(' ');
      const content = `<think>
${words}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      const tokenError = result.errors.find(e => e.includes('G-TOKEN'));
      expect(tokenError).toBeUndefined();
    });

    it('should fail with too few tokens', async () => {
      const content = `<think>
Too short
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.errors).toContain('G-TOKEN: <think> tokens out of range (2)');
    });

    it('should fail with too many tokens', async () => {
      const words = Array(800).fill('word').join(' ');
      const content = `<think>
${words}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.errors.some(e => e.includes('G-TOKEN') && e.includes('out of range (800)'))).toBe(true);
    });

    it('should fail when think section is missing', async () => {
      const content = `<act>
No think section
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.errors).toContain('G-TOKEN: <think> section not found');
    });
  });

  describe('Phase Label Validation (G-LABEL)', () => {
    it('should extract valid phase label', async () => {
      const content = `FETCH: Getting documentation

<think>
${Array(30).fill('word').join(' ')}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.phase).toBe('FETCH');
      const labelError = result.errors.find(e => e.includes('G-LABEL'));
      expect(labelError).toBeUndefined();
    });

    it('should fail when phase label is missing', async () => {
      const content = `<think>
${Array(30).fill('word').join(' ')}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.errors).toContain('G-LABEL: Phase label missing');
    });
  });

  describe('Network Access Validation (G-NET)', () => {
    it('should allow network access in FETCH phase', async () => {
      const content = `FETCH: Getting docs

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
Downloading from https://example.com
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      const netError = result.errors.find(e => e.includes('G-NET'));
      expect(netError).toBeUndefined();
    });

    it('should block network access in non-FETCH phases', async () => {
      const content = `BUILD: Implementation

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
Getting https://example.com/api
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.errors).toContain('G-NET: Network access only allowed in FETCH phase');
    });
  });

  describe('Git Diff Size Validation (G-SIZE)', () => {
    it('should pass with small diff', async () => {
      const content = `BUILD: Small change

<think>
${Array(30).fill('word').join(' ')}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(execSync)
        .mockReturnValueOnce('') // git rev-parse
        .mockReturnValueOnce('10\t5\tfile1.ts\n20\t10\tfile2.ts'); // git diff
      
      const result = await validator.validate('test.md');
      
      const sizeError = result.errors.find(e => e.includes('G-SIZE'));
      expect(sizeError).toBeUndefined();
    });

    it('should fail with large diff', async () => {
      const content = `BUILD: Large change

<think>
${Array(30).fill('word').join(' ')}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(execSync)
        .mockReturnValueOnce('') // git rev-parse
        .mockReturnValueOnce('1500\t100\tfile1.ts'); // git diff
      
      const result = await validator.validate('test.md');
      
      expect(result.errors.some(e => e.includes('G-SIZE') && e.includes('Patch size exceeds limit'))).toBe(true);
    });

    it('should handle non-git environments gracefully', async () => {
      const content = `BUILD: Change

<think>
${Array(30).fill('word').join(' ')}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not a git repository');
      });
      
      const result = await validator.validate('test.md');
      
      const sizeError = result.errors.find(e => e.includes('G-SIZE'));
      expect(sizeError).toBeUndefined();
    });
  });

  describe('Plan Comment Validation (G-PLAN)', () => {
    it('should pass with step-plan comment', async () => {
      const content = `BUILD: Implementation

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
# step-plan: implement feature X
code here
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      const planError = result.errors.find(e => e.includes('G-PLAN'));
      expect(planError).toBeUndefined();
    });

    it('should fail without step-plan comment', async () => {
      const content = `BUILD: Implementation

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
Just code without plan
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.errors).toContain('G-PLAN: # step-plan: comment missing in <act>');
    });
  });

  describe('Triage Section Validation (G-TRIAGE)', () => {
    it('should require Assumed Goals in non-FETCH phases', async () => {
      const content = `ANA: Analysis

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
# step-plan: analyze the issue
Missing assumed goals
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.errors).toContain('G-TRIAGE: Assumed Goals section missing');
    });

    it('should not require Assumed Goals in FETCH phase', async () => {
      const content = `FETCH: Getting docs

<think>
${Array(30).fill('word').join(' ')}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      const triageError = result.errors.find(e => e.includes('G-TRIAGE'));
      expect(triageError).toBeUndefined();
    });
  });

  describe('RFC Format Validation (G-RFC)', () => {
    it('should validate RFC format in PLAN phase', async () => {
      const content = `PLAN: RFC

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
# step-plan: create RFC
## Objective
Create new feature

## Problem
Description

## Solution
Approach

## Alternative Solutions
Other options considered

## Risks
Considerations

## Timeline
Schedule

RFC-OK: Approved by team
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      const rfcError = result.errors.find(e => e.includes('G-RFC'));
      expect(rfcError).toBeUndefined();
    });

    it('should fail with incomplete RFC', async () => {
      const content = `PLAN: RFC

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
# step-plan: create RFC

Assumed Goals:
- Create RFC for new feature

## Problem
Description

## Solution
Approach
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.errors.some(e => e.includes('G-RFC') && e.includes('missing required sections'))).toBe(true);
    });

    it('should skip RFC check in non-PLAN phases', async () => {
      const content = `BUILD: Implementation

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
No RFC needed here
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      const rfcError = result.errors.find(e => e.includes('G-RFC'));
      expect(rfcError).toBeUndefined();
    });
  });

  describe('Role-based Access Control (G-ROLE)', () => {
    it('should enforce role restrictions', async () => {
      const content = `BUILD: Change

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
# step-plan: implement changes

Assumed Goals:
- Implement the feature

Changes to implement
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(execSync).mockReturnValue('src/main.ts\ntests/test.spec.ts');
      
      const restrictedValidator = new Validator({ role: 'doc' });
      const result = await restrictedValidator.validate('test.md');
      
      expect(result.errors.some(e => e.includes('G-ROLE') && e.includes('doc role not allowed'))).toBe(true);
    });

    it('should allow unrestricted roles', async () => {
      const content = `BUILD: Change

<think>
${Array(30).fill('word').join(' ')}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(execSync).mockReturnValue('docs/README.md');
      
      const devValidator = new Validator({ role: 'dev' });
      const result = await devValidator.validate('test.md');
      
      const roleError = result.errors.find(e => e.includes('G-ROLE'));
      expect(roleError).toBeUndefined();
    });
  });

  describe('State Transition Validation (G-STATE)', () => {
    it('should validate correct state transitions', async () => {
      const content = `FETCH: Getting docs

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
Work done
</act>

<next>
State-Transition: FETCH→INV
</next>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      const stateError = result.errors.find(e => e.includes('G-STATE'));
      expect(stateError).toBeUndefined();
    });

    it('should reject invalid state transitions', async () => {
      const content = `FETCH: Getting docs

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
# step-plan: fetch documentation
Work done
</act>

<next>
State-Transition: FETCH→BUILD
</next>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.errors).toContain('G-STATE: Invalid state transition: FETCH→BUILD');
    });
  });

  describe('WBS Approval Validation (G-WBS-OK)', () => {
    it('should detect unapproved WBS items in PLAN phase', async () => {
      const content = `PLAN: Planning

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
# step-plan: create WBS

Assumed Goals:
- Create work breakdown structure

## Problem
Need to organize work

## Solution
Create detailed work breakdown

## Risks
May miss some tasks

## Timeline
1 week

## Work Breakdown Structure

| Phase | Step | Task | Guard |
|-------|------|------|-------|
| PLAN | P-1 | Task 1 | G-RFC |
| PLAN | P-2 | Task 2 | – |
| PLAN | P-3 | Task 3 | – |
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      expect(result.errors.some(e => e.includes('G-WBS-OK') && e.includes('not approved'))).toBe(true);
    });

    it('should pass with all WBS items approved', async () => {
      const content = `PLAN: Planning

<think>
${Array(30).fill('word').join(' ')}
</think>

<act>
# step-plan: create WBS
## Work Breakdown Structure

| Phase | Step | Task | Guard |
|-------|------|------|-------|
| PLAN | P-1 | Task 1 | G-RFC |
| PLAN | P-2 | Task 2 | G-WBS |
| PLAN | P-3 | Task 3 | G-TEST |

WBS-OK: Approved by PM
</act>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      const wbsError = result.errors.find(e => e.includes('G-WBS-OK'));
      expect(wbsError).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const result = await validator.validate('nonexistent.md');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Validation error: File not found');
    });
  });

  describe('Guard Skipping Logic', () => {
    it('should skip phase-specific guards when not applicable', async () => {
      const content = `FETCH: Getting docs

<think>
${Array(30).fill('word').join(' ')}
</think>`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const result = await validator.validate('test.md');
      
      // Should not have RFC or TEST errors in FETCH phase
      const rfcError = result.errors.find(e => e.includes('G-RFC'));
      const testError = result.errors.find(e => e.includes('G-TEST'));
      
      expect(rfcError).toBeUndefined();
      expect(testError).toBeUndefined();
    });
  });

  describe('Multiple Guard Failures', () => {
    it('should report all guard failures when checkAllGuards is true', async () => {
      const content = `Invalid content with no structure`;
      
      vi.mocked(fs.readFileSync).mockReturnValue(content);
      const validator = new Validator({ checkAllGuards: true });
      const result = await validator.validate('test.md');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.guardFailures).toBeDefined();
      expect(result.guardFailures!.length).toBeGreaterThan(0);
    });
  });
});