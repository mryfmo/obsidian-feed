export interface AnalysisResult {
  success: boolean;
  insights?: string[];
  recommendations?: string[];
  warnings?: string[];
  error?: string;
}

export interface AnalysisContext {
  environment?: string;
  recentChanges?: Array<{ timestamp: string; description: string }>;
  errorLogs?: Array<{ type: string; message: string; timestamp: string }>;
  performanceMetrics?: {
    avgResponseTime: number;
    maxResponseTime: number;
    errorRate: number;
  };
  stackTrace?: string;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  dependencies?: string[];
  complexity?: number;
  [key: string]: unknown;
}

export interface SequentialThinkingClient {
  analyze(params: { problem: string; context: AnalysisContext; steps: string[] }): Promise<{
    success: boolean;
    insights: string[];
    recommendations: string[];
    warnings?: string[];
  }>;
}

export interface MCPClients {
  sequentialThinking?: SequentialThinkingClient;
}

export class Analyzer {
  constructor(private mcpClients?: MCPClients) {}

  /**
   * Analyze a complex problem using sequential thinking
   */
  async analyzeComplexProblem(problem: string, context: AnalysisContext): Promise<AnalysisResult> {
    try {
      // Try MCP sequential-thinking server first if available
      if (this.mcpClients?.sequentialThinking) {
        try {
          const result = await this.mcpClients.sequentialThinking.analyze({
            problem,
            context,
            steps: [
              'Understand the problem scope',
              'Identify key components',
              'Analyze dependencies',
              'Evaluate risks',
              'Generate recommendations',
            ],
          });

          return {
            success: true,
            insights: result.insights,
            recommendations: result.recommendations,
            warnings: result.warnings,
          };
        } catch (mcpError) {
          console.warn('MCP sequential-thinking failed, falling back to local analysis:', mcpError);
        }
      }

      // Fallback to local analysis
      return Analyzer.localAnalysis(problem, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Analyze root cause of an issue
   */
  async analyzeRootCause(
    issue: string,
    symptoms: string[],
    context: AnalysisContext
  ): Promise<AnalysisResult> {
    try {
      // Try MCP sequential-thinking server first if available
      if (this.mcpClients?.sequentialThinking) {
        try {
          const result = await this.mcpClients.sequentialThinking.analyze({
            problem: `Root cause analysis for: ${issue}`,
            context: {
              symptoms,
              ...context,
            },
            steps: [
              'List all symptoms',
              'Identify common patterns',
              'Trace to potential causes',
              'Evaluate each cause',
              'Determine most likely root cause',
            ],
          });

          return {
            success: true,
            insights: result.insights,
            recommendations: result.recommendations,
            warnings: result.warnings,
          };
        } catch (mcpError) {
          console.warn('MCP root cause analysis failed, falling back to local:', mcpError);
        }
      }

      // Fallback to local root cause analysis
      return Analyzer.localRootCauseAnalysis(issue, symptoms, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate Work Breakdown Structure (WBS)
   */
  async generateWBS(
    task: string,
    requirements: string[],
    constraints: Record<string, unknown>
  ): Promise<AnalysisResult> {
    try {
      // Try MCP sequential-thinking server first if available
      if (this.mcpClients?.sequentialThinking) {
        try {
          const result = await this.mcpClients.sequentialThinking.analyze({
            problem: `Generate WBS for: ${task}`,
            context: {
              requirements,
              constraints,
            },
            steps: [
              'Understand task objectives',
              'Identify major deliverables',
              'Break down into work packages',
              'Estimate effort and dependencies',
              'Create hierarchical structure',
            ],
          });

          return {
            success: true,
            insights: result.insights,
            recommendations: result.recommendations,
            warnings: result.warnings,
          };
        } catch (mcpError) {
          console.warn('MCP WBS generation failed, falling back to local:', mcpError);
        }
      }

      // Fallback to local WBS generation
      return Analyzer.localGenerateWBS(task, requirements, constraints);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Local fallback methods
  private static localAnalysis(problem: string, context: AnalysisContext): AnalysisResult {
    const insights: string[] = [];
    const recommendations: string[] = [];
    const warnings: string[] = [];

    // Basic local analysis logic
    insights.push(`Problem identified: ${problem}`);

    if (typeof context.complexity === 'number' && context.complexity > 7) {
      recommendations.push('Consider breaking down into smaller tasks');
      warnings.push('High complexity may require additional review');
    }

    if (context.dependencies && context.dependencies.length > 5) {
      warnings.push('Multiple dependencies detected - ensure proper coordination');
    }

    return {
      success: true,
      insights,
      recommendations,
      warnings,
    };
  }

  private static localRootCauseAnalysis(
    issue: string,
    symptoms: string[],
    context: AnalysisContext
  ): AnalysisResult {
    const insights: string[] = [];
    const recommendations: string[] = [];

    insights.push(`Issue: ${issue}`);
    insights.push(`Symptoms count: ${symptoms.length}`);

    // Analyze context for additional insights
    if (context.environment) {
      insights.push(`Environment: ${context.environment}`);
    }

    if (context.recentChanges) {
      insights.push(`Recent changes detected: ${context.recentChanges.length} modifications`);
      recommendations.push('Review recent changes for potential regression');
    }

    if (context.errorLogs && context.errorLogs.length > 0) {
      const uniqueErrors = new Set(context.errorLogs.map(log => log.type || 'unknown'));
      insights.push(`Error types found: ${Array.from(uniqueErrors).join(', ')}`);
    }

    // Simple pattern matching for common issues
    if (symptoms.some(s => s.includes('timeout') || s.includes('slow'))) {
      insights.push('Performance-related issue detected');
      recommendations.push('Check network latency and resource utilization');

      if (context.performanceMetrics) {
        const { avgResponseTime } = context.performanceMetrics;
        if (avgResponseTime > 1000) {
          recommendations.push(
            `Average response time is ${avgResponseTime}ms - consider optimization`
          );
        }
      }
    }

    if (symptoms.some(s => s.includes('error') || s.includes('fail'))) {
      insights.push('Error-related issue detected');
      recommendations.push('Review error logs and stack traces');

      if (context.stackTrace) {
        const [topFrame] = context.stackTrace.split('\n');
        insights.push(`Error origin: ${topFrame}`);
      }
    }

    // Check for memory-related issues
    if (context.memoryUsage && context.memoryUsage.heapUsed > context.memoryUsage.heapTotal * 0.9) {
      insights.push('High memory usage detected');
      recommendations.push('Consider memory profiling and optimization');
    }

    return {
      success: true,
      insights,
      recommendations,
    };
  }

  private static localGenerateWBS(
    task: string,
    requirements: string[],
    constraints: Record<string, unknown>
  ): AnalysisResult {
    const insights: string[] = [];
    const recommendations: string[] = [];

    insights.push(`Task: ${task}`);
    insights.push(`Requirements: ${requirements.length}`);

    // Basic WBS structure
    recommendations.push('1. Planning Phase');
    recommendations.push('  1.1 Requirements analysis');
    recommendations.push('  1.2 Design documentation');
    recommendations.push('2. Implementation Phase');
    for (const [i, req] of requirements.entries()) {
      recommendations.push(`  2.${i + 1} Implement: ${req}`);
    }
    recommendations.push('3. Testing Phase');
    recommendations.push('  3.1 Unit testing');
    recommendations.push('  3.2 Integration testing');
    recommendations.push('4. Deployment Phase');

    if (constraints.timeline === 'tight') {
      insights.push('Timeline constraint: Consider parallel work streams');
    }

    return {
      success: true,
      insights,
      recommendations,
    };
  }
}
