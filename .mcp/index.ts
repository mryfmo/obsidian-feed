/**
 * MCP Integration - Main entry point
 * Simplified but complete implementation that satisfies all project requirements
 */

import { Validator, ValidationResult } from './validator';
import { Fetcher, FetchResult } from './fetcher';
import { WorkflowManager, WorkflowResult, Phase } from './workflow';
import { Analyzer, AnalysisResult } from './analyzer';

export interface IntegrationConfig {
  validation?: {
    useAI?: boolean;
    checkAllGuards?: boolean;
  };
  context7?: {
    enabled?: boolean;
    defaultTokens?: number;
  };
  github?: {
    updateLabels?: boolean;
  };
}

export interface MCPClients {
  filesystem?: {
    read_file: (params: { path: string }) => Promise<{ content: string }>;
  };
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
  fetch?: unknown;
  sequentialThinking?: {
    analyze: (params: { problem: string; context: unknown; steps: string[] }) => Promise<{
      success: boolean;
      insights: string[];
      recommendations: string[];
      warnings?: string[];
    }>;
  };
  context7?: unknown;
}

export class MCPIntegration {
  private validator: Validator;

  private fetcher: Fetcher;

  private workflowManager: WorkflowManager;

  private analyzer: Analyzer;

  public mcpClients?: MCPClients; // Made public for bridge.ts access

  private validationCache: Map<string, ValidationResult> = new Map();

  private fetchCache: Map<string, FetchResult> = new Map();

  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private maxCacheSize = 100; // Maximum cache entries

  constructor(mcpClients?: MCPClients) {
    this.mcpClients = mcpClients;
    this.validator = new Validator();
    this.fetcher = new Fetcher(mcpClients);
    this.workflowManager = new WorkflowManager();
    this.analyzer = new Analyzer(mcpClients);

    if (mcpClients) {
      this.workflowManager.setMCPClients(mcpClients);
    }

    // Set up cache cleanup
    this.startCacheCleanup();
  }

  private startCacheCleanup(): void {
    const interval = setInterval(() => {
      const now = Date.now();

      // Clean expired entries from validation cache
      for (const [key, value] of this.validationCache.entries()) {
        if (value.timestamp && now - value.timestamp > this.cacheTimeout) {
          this.validationCache.delete(key);
        }
      }

      // Clean expired entries from fetch cache
      for (const [key, value] of this.fetchCache.entries()) {
        if (value.timestamp && now - value.timestamp > this.cacheTimeout) {
          this.fetchCache.delete(key);
        }
      }

      // Enforce size limits (LRU eviction)
      this.enforceCacheSizeLimit(this.validationCache);
      this.enforceCacheSizeLimit(this.fetchCache);
    }, this.cacheTimeout / 2); // Check more frequently than timeout

    // Prevent memory leak in tests
    if (typeof interval.unref === 'function') {
      interval.unref();
    }
  }

  private enforceCacheSizeLimit<T extends { timestamp?: number }>(cache: Map<string, T>): void {
    if (cache.size <= this.maxCacheSize) return;

    // Sort by timestamp (oldest first)
    const entries = Array.from(cache.entries()).sort(
      (a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0)
    );

    // Remove oldest entries
    const toRemove = entries.slice(0, cache.size - this.maxCacheSize);
    for (const [key] of toRemove) {
      cache.delete(key);
    }
  }

  async validate(
    filePath: string,
    options?: { checkAllGuards?: boolean; role?: string }
  ): Promise<ValidationResult> {
    // Check cache
    const cacheKey = `${filePath}:${JSON.stringify(options)}`;
    const cached = this.validationCache.get(cacheKey);
    if (cached) {
      // Return cached result without timestamp for consistency
      const { timestamp, ...resultWithoutTimestamp } = cached;
      void timestamp; // Mark as intentionally unused
      return resultWithoutTimestamp;
    }

    const validator = new Validator(options);
    const result = await validator.validate(filePath);

    // Cache result with timestamp
    const resultWithTimestamp = { ...result, timestamp: Date.now() };
    this.validationCache.set(cacheKey, resultWithTimestamp);

    // Optional AI analysis
    if (!result.valid && this.mcpClients?.sequentialThinking) {
      const aiAnalysis = await validator.analyzeWithAI(filePath, result);
      return aiAnalysis;
    }

    return result;
  }

  async fetch(sources: string | string[]): Promise<FetchResult[]> {
    const sourceArray = Array.isArray(sources) ? sources : [sources];
    const results: FetchResult[] = [];
    const uncachedSources: string[] = [];

    // Check cache for each source
    for (const source of sourceArray) {
      const cached = this.fetchCache.get(source);
      if (cached && cached.timestamp && Date.now() - cached.timestamp < this.cacheTimeout) {
        results.push(cached);
      } else {
        uncachedSources.push(source);
      }
    }

    // Fetch uncached sources
    if (uncachedSources.length > 0) {
      const freshResults = await this.fetcher.fetchMultiple(uncachedSources);
      for (let i = 0; i < uncachedSources.length; i += 1) {
        const result = { ...freshResults[i], timestamp: Date.now() };
        this.fetchCache.set(uncachedSources[i], result);
        results.push(result);
      }
    }

    return results;
  }

  async fetchSingle(source: string): Promise<FetchResult> {
    const results = await this.fetch(source);
    return results[0];
  }

  async workflow(command: string, options: Record<string, unknown>): Promise<WorkflowResult> {
    switch (command) {
      case 'update-phase': {
        const { issueNumber, fromPhase, toPhase } = options;

        // Validate transition
        const transitionResult = this.workflowManager.validateTransition(
          fromPhase as Phase,
          toPhase as Phase
        );
        if (!transitionResult.valid) {
          return { success: false, error: transitionResult.error };
        }

        // Update labels
        return this.workflowManager.updatePhaseLabel(
          issueNumber as number,
          fromPhase as Phase,
          toPhase as Phase
        );
      }

      case 'add-phase': {
        const { issueNumber, phase, type = 'issue' } = options;
        return this.workflowManager.addPhaseLabel(
          issueNumber as number,
          phase as Phase,
          type as 'issue' | 'pr'
        );
      }

      case 'validate-transition': {
        const { from, to } = options;
        const result = this.workflowManager.validateTransition(from as Phase, to as Phase);
        return { success: result.valid, error: result.error };
      }

      default:
        return { success: false, error: `Unknown workflow command: ${command}` };
    }
  }

  async testContext7(): Promise<string> {
    const libraries = ['react', 'vue', 'express'];
    const results: string[] = [];

    for (const lib of libraries) {
      try {
        const fetchResults = await this.fetch(lib);
        const [result] = fetchResults;
        if (result.success) {
          results.push(`✅ ${lib}: Fetched successfully`);
        } else {
          results.push(`❌ ${lib}: ${result.error}`);
        }
      } catch (error) {
        results.push(`❌ ${lib}: ${(error as Error).message}`);
      }
    }

    return results.join('\n');
  }

  /**
   * Analyze a complex problem using sequential thinking
   */
  async analyzeComplexProblem(
    problem: string,
    context: Record<string, unknown>
  ): Promise<AnalysisResult> {
    return this.analyzer.analyzeComplexProblem(problem, context);
  }

  /**
   * Analyze root cause of an issue
   */
  async analyzeRootCause(
    issue: string,
    symptoms: string[],
    context: Record<string, unknown>
  ): Promise<AnalysisResult> {
    return this.analyzer.analyzeRootCause(issue, symptoms, context);
  }

  /**
   * Generate Work Breakdown Structure
   */
  async generateWBS(
    task: string,
    requirements: string[],
    constraints: Record<string, unknown>
  ): Promise<AnalysisResult> {
    return this.analyzer.generateWBS(task, requirements, constraints);
  }
}

// Export for use in other modules
export { Validator, Fetcher, WorkflowManager, Analyzer };
export type { ValidationResult } from './validator';
export type { FetchResult } from './fetcher';
export type { WorkflowResult, Phase } from './workflow';
export type { AnalysisResult } from './analyzer';
