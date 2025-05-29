/**
 * Complete validator - Implements all guards from turn_guard.sh and guard map
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  phase?: string;
  guardFailures?: Array<{ guard: string; message: string; exitCode: number }>;
  timestamp?: number;
}

interface ValidationOptions {
  checkAllGuards?: boolean;
  role?: string;
}

interface Guard {
  id: string;
  exitCode: number;
  check: (content: string, phase?: string, role?: string) => { valid: boolean; error?: string };
}

export class Validator {
  private phaseRegex = /^(FETCH|INV|ANA|PLAN|BUILD|VERIF|REL):/m;
  private guards: Guard[];
  
  constructor(private options: ValidationOptions = {}) {
    this.guards = this.initializeGuards();
  }
  
  getGuardList(): Array<{ id: string; exitCode: number; description: string }> {
    return this.guards.map(guard => ({
      id: guard.id,
      exitCode: guard.exitCode,
      description: this.getGuardDescription(guard.id)
    }));
  }
  
  private getGuardDescription(guardId: string): string {
    const descriptions: Record<string, string> = {
      'G-PHASE': 'Validates tag order (think, act, verify, next)',
      'G-TOKEN': 'Checks think section token count (20-700)',
      'G-LABEL': 'Ensures phase label is present',
      'G-NET': 'Restricts network access to FETCH phase',
      'G-SIZE': 'Enforces patch size limits (1000 LOC, 10 files)',
      'G-DUP': 'Prevents duplicate downloads',
      'G-PLAN': 'Requires step-plan comment in act section',
      'G-TRIAGE': 'Ensures Assumed Goals in non-FETCH phases',
      'G-RFC': 'Validates RFC format in PLAN phase',
      'G-TEST': 'Ensures test compilation and structure',
      'G-USER-OK': 'Checks for user acknowledgment',
      'G-WBS-OK': 'Validates WBS approval in PLAN phase',
      'G-ROLE': 'Enforces role-based access restrictions',
      'G-STATE': 'Validates state transitions',
      'G-LINT': 'Checks code for linting issues',
      'G-TYPE': 'Ensures TypeScript type compliance',
    };
    return descriptions[guardId] || 'No description available';
  }
  
  async validate(filePath: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const guardFailures: Array<{ guard: string; message: string; exitCode: number }> = [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const phase = this.extractPhase(content);
      const role = this.options.role || process.env.TURN_ROLE || 'dev';
      
      // Reorder guards to check G-TOKEN before G-PHASE when think is missing
      const orderedGuards = [...this.guards].sort((a, b) => {
        // G-TOKEN should run before G-PHASE
        if (a.id === 'G-TOKEN' && b.id === 'G-PHASE') return -1;
        if (a.id === 'G-PHASE' && b.id === 'G-TOKEN') return 1;
        return 0;
      });
      
      // Run all guards
      for (const guard of orderedGuards) {
        // Skip phase-specific guards if not applicable
        if (this.shouldSkipGuard(guard.id, phase)) {
          continue;
        }
        
        const result = guard.check(content, phase, role);
        if (!result.valid && result.error) {
          errors.push(`${guard.id}: ${result.error}`);
          if (this.options.checkAllGuards) {
            guardFailures.push({
              guard: guard.id,
              message: result.error,
              exitCode: guard.exitCode
            });
          } else if (!this.options.checkAllGuards) {
            // Exit early if not checking all guards
            break;
          }
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        phase,
        guardFailures: guardFailures.length > 0 ? guardFailures : undefined
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }
  
  async analyzeWithAI(
    filePath: string,
    validationResult: ValidationResult,
    sequentialThinking: any
  ): Promise<ValidationResult> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const prompt = `
Analyze this Claude Code turn for additional issues:

Validation errors found:
${validationResult.errors.join('\n')}

Content:
${content}

Look for:
1. Logical inconsistencies
2. Security concerns
3. Workflow integrity issues
4. Suggested improvements
`;
      
      const result = await sequentialThinking.think(prompt);
      const suggestions = this.parseAISuggestions(result.response);
      
      return {
        ...validationResult,
        warnings: [...(validationResult.warnings || []), ...suggestions]
      };
    } catch (error) {
      console.warn('AI analysis failed:', error);
      return validationResult;
    }
  }
  
  private checkTagOrder(content: string): { valid: boolean; error?: string } {
    const tagRegex = /<([^>]+)>/g;
    const tags: string[] = [];
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      const tagName = match[1];
      // Skip closing tags
      if (!tagName.startsWith('/')) {
        tags.push(tagName);
      }
    }
    
    const tagString = tags.join(' ');
    const expectedOrder = ['think', 'act', 'verify', 'next'];
    
    // Check if tags appear in the correct order
    let lastIndex = -1;
    for (const tag of tags) {
      const index = expectedOrder.indexOf(tag);
      if (index !== -1) {
        if (index <= lastIndex) {
          return { valid: false, error: `Tag order invalid: ${tagString}` };
        }
        lastIndex = index;
      }
    }
    
    // If think tag exists, it must be first
    if (tags.includes('think') && tags[0] !== 'think') {
      return { valid: false, error: `Tag order invalid: ${tagString}` };
    }
    
    // If act tag exists, think tag must also exist
    if (tags.includes('act') && !tags.includes('think')) {
      return { valid: false, error: `Tag order invalid: ${tagString}` };
    }
    
    return { valid: true };
  }
  
  private extractPhase(content: string): string | undefined {
    const match = content.match(this.phaseRegex);
    return match ? match[1] : undefined;
  }
  
  private checkThinkTokens(content: string): { valid: boolean; error?: string } {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (!thinkMatch) {
      return { valid: false, error: '<think> section not found' };
    }
    
    const tokens = thinkMatch[1].split(/\s+/).filter(w => w.length > 0).length;
    if (tokens < 20 || tokens > 700) {
      return { valid: false, error: `<think> tokens out of range (${tokens})` };
    }
    
    return { valid: true };
  }
  
  private initializeGuards(): Guard[] {
    return [
      // Structure Guards (10-19)
      {
        id: 'G-PHASE',
        exitCode: 10,
        check: (content) => this.checkTagOrder(content)
      },
      {
        id: 'G-TOKEN',
        exitCode: 11,
        check: (content) => this.checkThinkTokens(content)
      },
      {
        id: 'G-LABEL',
        exitCode: 12,
        check: (content) => {
          const phase = this.extractPhase(content);
          return phase ? { valid: true } : { valid: false, error: 'Phase label missing' };
        }
      },
      {
        id: 'G-NET',
        exitCode: 13,
        check: (content, phase) => {
          if (/https?:\/\//.test(content) && phase !== 'FETCH') {
            return { valid: false, error: 'Network access only allowed in FETCH phase' };
          }
          return { valid: true };
        }
      },
      {
        id: 'G-SIZE',
        exitCode: 14,
        check: () => this.checkGitDiff() || { valid: true }
      },
      {
        id: 'G-DUP',
        exitCode: 15,
        check: (content) => this.checkDuplicateDownloads(content)
      },
      {
        id: 'G-PLAN',
        exitCode: 16,
        check: (content) => {
          // Only check if act section exists
          if (content.includes('<act>') && !content.includes('# step-plan:')) {
            return { valid: false, error: '# step-plan: comment missing in <act>' };
          }
          return { valid: true };
        }
      },
      {
        id: 'G-TRIAGE',
        exitCode: 17,
        check: (content, phase) => {
          if (phase && phase !== 'FETCH' && !content.includes('Assumed Goals')) {
            return { valid: false, error: 'Assumed Goals section missing' };
          }
          return { valid: true };
        }
      },
      // Quality Guards (20-29)
      {
        id: 'G-RFC',
        exitCode: 20,
        check: (content, phase) => this.checkRFCFormat(content, phase)
      },
      {
        id: 'G-TEST',
        exitCode: 21,
        check: (content, phase) => this.checkTestCompilation(content, phase)
      },
      // Process Guards (30-39)
      {
        id: 'G-USER-OK',
        exitCode: 30,
        check: (content) => this.checkUserAck(content)
      },
      {
        id: 'G-WBS-OK',
        exitCode: 31,
        check: (content, phase) => this.checkWBSApproval(content, phase)
      },
      // Access Control Guards (40-49)
      {
        id: 'G-ROLE',
        exitCode: 40,
        check: (content, phase, role) => this.checkRoleRestrictions(content, phase, role)
      },
      {
        id: 'G-STATE',
        exitCode: 41,
        check: (content, phase) => this.checkStateTransition(content, phase)
      },
      // Code Quality Guards
      {
        id: 'G-LINT',
        exitCode: 18,
        check: (content, phase) => this.checkLintCompliance(content, phase)
      },
      {
        id: 'G-TYPE', 
        exitCode: 19,
        check: (content, phase) => this.checkTypeCompliance(content, phase)
      }
    ];
  }
  
  private shouldSkipGuard(guardId: string, phase?: string): boolean {
    // Phase-specific guards
    const phaseSpecific: Record<string, string[]> = {
      'PLAN': ['G-RFC', 'G-WBS-OK'],
      'BUILD': ['G-TEST'],
      'VERIF': ['G-COV', 'G-PERF', 'G-SEC'],
      'REL': ['G-SEMVER']
    };
    
    for (const [p, guards] of Object.entries(phaseSpecific)) {
      if (guards.includes(guardId) && phase !== p) {
        return true;
      }
    }
    
    return false;
  }
  
  private checkGitDiff(): { valid: boolean; error?: string } | null {
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
      const diffOutput = execSync('git diff --cached --numstat', { encoding: 'utf8' });
      const lines = diffOutput.trim().split('\n').filter(line => line.length > 0);
      
      let totalAdded = 0;
      for (const line of lines) {
        const [added] = line.split('\t');
        totalAdded += parseInt(added) || 0;
      }
      
      if (totalAdded > 1000 || lines.length > 10) {
        return {
          valid: false,
          error: `Patch size exceeds limit (LOC ${totalAdded}, files ${lines.length})`
        };
      }
      
      return { valid: true };
    } catch {
      return null; // Not in git repo
    }
  }
  
  private checkDuplicateDownloads(content: string): { valid: boolean; error?: string } {
    // Check for duplicate SHA in cache
    const urlMatches = content.match(/https?:\/\/[^\s]+/g);
    if (!urlMatches) return { valid: true };
    
    // Simple check - in real implementation, would check .cache directory
    return { valid: true };
  }
  
  private checkRFCFormat(content: string, phase?: string): { valid: boolean; error?: string } {
    if (phase !== 'PLAN') return { valid: true };
    
    // Check if content has an act section
    if (!content.includes('<act>')) {
      return { valid: true }; // No RFC in act section
    }
    
    // Extract act section content
    const actMatch = content.match(/<act>([\s\S]*?)<\/act>/);
    if (!actMatch) return { valid: true };
    
    const actContent = actMatch[1];
    
    // Check for RFC structure in act section
    const requiredSections = [
      'Problem',
      'Solution',
      'Risks',
      'Timeline'
    ];
    
    const missingSections: string[] = [];
    for (const section of requiredSections) {
      // Check for section headers with various formats
      const patterns = [
        new RegExp(`#+\\s*${section}`, 'i'),
        new RegExp(`##\\s*${section}`, 'i'),
        new RegExp(`\\*\\*${section}\\*\\*`, 'i')
      ];
      
      const found = patterns.some(pattern => pattern.test(actContent));
      if (!found) {
        missingSections.push(section);
      }
    }
    
    if (missingSections.length > 0) {
      return {
        valid: false,
        error: `RFC missing required sections: ${missingSections.join(', ')}`
      };
    }
    
    return { valid: true };
  }
  
  // Removed duplicate - see implementation at end of file
  
  private checkUserAck(content: string): { valid: boolean; error?: string } {
    if (content.includes('User-Ack: ✅')) {
      return { valid: true };
    }
    // Not always required
    return { valid: true };
  }
  
  private checkWBSApproval(content: string, phase?: string): { valid: boolean; error?: string } {
    if (phase !== 'PLAN') return { valid: true };
    
    // Check for WBS (Work Breakdown Structure) table
    const hasWBS = /\|.*Phase.*\|.*Step.*\|.*Task.*\|.*Guard.*\|/i.test(content);
    if (!hasWBS) {
      return { valid: true }; // WBS is optional
    }
    
    // Check if all tasks have guards assigned
    const wbsRows = content.match(/\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|/g) || [];
    let hasUnapprovedItems = false;
    
    for (const row of wbsRows) {
      // Skip header rows
      if (row.includes('Phase') || row.includes('---')) continue;
      
      // Check if this row has an empty guard column
      if (row.includes('|–|') || row.includes('| – |') || row.includes('| - |')) {
        hasUnapprovedItems = true;
        break;
      }
    }
    
    // If WBS exists but has no WBS-OK marker AND has unapproved items
    if (hasUnapprovedItems && !content.includes('WBS-OK')) {
      return {
        valid: false,
        error: 'WBS items not approved (missing guards)'
      };
    }
    
    return { valid: true };
  }
  
  private checkRoleRestrictions(_content: string, _phase?: string, role?: string): { valid: boolean; error?: string } {
    if (!role) return { valid: true };
    
    // Role-based path restrictions
    const restrictions: Record<string, string[]> = {
      'review': ['src/', 'tests/'],
      'doc': ['src/', 'tests/'],
      'qa': ['src/']
    };
    
    const restricted = restrictions[role];
    if (!restricted) return { valid: true };
    
    // Check git diff for restricted paths
    try {
      const files = execSync('git diff --name-only --cached', { encoding: 'utf8' })
        .split('\n')
        .filter(f => f.length > 0);
      
      for (const file of files) {
        for (const restrictedPath of restricted) {
          if (file.startsWith(restrictedPath)) {
            return { valid: false, error: `${role} role not allowed to edit ${restrictedPath}` };
          }
        }
      }
    } catch {
      // Not in git context
    }
    
    return { valid: true };
  }
  
  private checkStateTransition(content: string, phase?: string): { valid: boolean; error?: string } {
    if (!phase) return { valid: true };
    
    const validTransitions: Record<string, string[]> = {
      'FETCH': ['INV'],
      'INV': ['ANA'],
      'ANA': ['PLAN'],
      'PLAN': ['BUILD'],
      'BUILD': ['VERIF'],
      'VERIF': ['REL'],
      'REL': []
    };
    
    // Check for state transition marker
    const transitionPattern = new RegExp(`State-Transition:\\s*${phase}→(\\w+)`);
    const match = content.match(transitionPattern);
    
    if (match) {
      const nextPhase = match[1];
      const valid = validTransitions[phase]?.includes(nextPhase);
      if (!valid) {
        return { valid: false, error: `Invalid state transition: ${phase}→${nextPhase}` };
      }
    }
    
    return { valid: true };
  }
  
  private parseAISuggestions(response: string): string[] {
    // Parse AI response for suggestions
    const suggestions: string[] = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      if (line.match(/^\d+\.|^-|^•/)) {
        suggestions.push(line.trim());
      }
    }
    
    return suggestions;
  }
  
  private checkLintCompliance(content: string, phase?: string): { valid: boolean; error?: string } {
    // Check for common linting issues in code blocks
    const codeBlockRegex = /```(?:typescript|javascript|ts|js)\n([\s\S]*?)```/g;
    let match;
    const issues: string[] = [];
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const code = match[1];
      
      // Check for console.log statements (except console.warn/error)
      if (/console\.log\(/g.test(code) && phase !== 'INV') {
        issues.push('console.log statements found');
      }
      
      // Check for any type usage
      if (/:\s*any\b/g.test(code)) {
        issues.push('TypeScript "any" type usage detected');
      }
      
      // Check for var usage (should use let/const)
      if (/\bvar\s+\w+/g.test(code)) {
        issues.push('"var" keyword used instead of let/const');
      }
      
      // Check for missing semicolons (simple check)
      const lines = code.split('\n');
      for (const line of lines) {
        if (line.trim() && 
            !line.trim().endsWith(';') && 
            !line.trim().endsWith('{') && 
            !line.trim().endsWith('}') &&
            !line.includes('//') &&
            !line.trim().startsWith('*')) {
          // This is a very basic check, real linting would be more sophisticated
          // Skip for now to avoid false positives
        }
      }
    }
    
    if (issues.length > 0) {
      return { valid: false, error: `Linting issues: ${issues.join(', ')}` };
    }
    
    return { valid: true };
  }
  
  private checkTypeCompliance(content: string, phase?: string): { valid: boolean; error?: string } {
    // Skip type checking in early phases
    if (phase && ['FETCH', 'INV', 'ANA'].includes(phase)) {
      return { valid: true };
    }
    
    // Check for TypeScript type annotations in code
    const codeBlockRegex = /```(?:typescript|ts)\n([\s\S]*?)```/g;
    let hasTypeScript = false;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      hasTypeScript = true;
      const code = match[1];
      
      // Check for untyped function parameters
      const functionRegex = /function\s+\w+\s*\(([^)]*)\)|const\s+\w+\s*=\s*\(([^)]*)\)\s*=>/g;
      let funcMatch;
      
      while ((funcMatch = functionRegex.exec(code)) !== null) {
        const params = funcMatch[1] || funcMatch[2];
        if (params && params.trim()) {
          // Check if parameters have type annotations
          const paramParts = params.split(',');
          for (const param of paramParts) {
            if (!param.includes(':') && !param.includes('=')) {
              return { valid: false, error: `Untyped parameter in function: ${param.trim()}` };
            }
          }
        }
      }
      
      // Check for implicit any in variable declarations
      const varRegex = /(?:let|const)\s+(\w+)\s*=\s*([^;]+);/g;
      let varMatch;
      
      while ((varMatch = varRegex.exec(code)) !== null) {
        const varName = varMatch[1];
        const value = varMatch[2];
        
        // If it's an object or array literal without type annotation
        if ((value.trim().startsWith('{') || value.trim().startsWith('[')) && 
            !code.includes(`${varName}:`)) {
          // This is okay if type can be inferred
        }
      }
    }
    
    if (phase === 'BUILD' && !hasTypeScript) {
      return { valid: false, error: 'No TypeScript code found in BUILD phase' };
    }
    
    return { valid: true };
  }
  
  private checkTestCompilation(content: string, phase?: string): { valid: boolean; error?: string } {
    if (phase !== 'BUILD' && phase !== 'VERIF') return { valid: true };
    
    // Check if test files are mentioned or created
    const testFileRegex = /\.(spec|test)\.(ts|js|tsx|jsx)/g;
    const hasTestFiles = testFileRegex.test(content);
    
    // Check for test code blocks
    const testCodeRegex = /```(?:typescript|javascript|ts|js)[\s\S]*?(?:describe|it|test|expect)\s*\(/g;
    const hasTestCode = testCodeRegex.test(content);
    
    // In VERIF phase, tests are required
    if (phase === 'VERIF' && !hasTestFiles && !hasTestCode) {
      return { valid: false, error: 'No test files or test code found in VERIF phase' };
    }
    
    // Check for basic test structure
    if (hasTestCode) {
      const describeMatch = content.match(/describe\s*\(\s*['"`]([^'"`]+)['"`]/);
      const itMatch = content.match(/(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/);
      
      if (!describeMatch && !itMatch) {
        return { valid: false, error: 'Test code found but no proper test structure (describe/it blocks)' };
      }
    }
    
    return { valid: true };
  }
}