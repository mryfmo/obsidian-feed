/* eslint-disable max-classes-per-file */
/**
 * Error types for the Obsidian Feed Reader plugin
 */

/**
 * Error types enumeration for better type safety and consistency
 */
export enum FeedErrorType {
  PLUGIN_OPERATION = 'PLUGIN_OPERATION',
  FEED_VALIDATION = 'FEED_VALIDATION',
  FEED_FETCH = 'FEED_FETCH',
  FEED_PARSE = 'FEED_PARSE',
  FEED_STORAGE = 'FEED_STORAGE',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Base error class for all feed-related errors
 * Provides consistent error handling and metadata
 */
export class FeedError extends Error {
  public readonly type: FeedErrorType;

  public readonly severity: ErrorSeverity;

  public readonly timestamp: Date;

  public readonly context?: Record<string, unknown>;

  public readonly originalError?: Error;

  constructor(
    message: string,
    type: FeedErrorType,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, unknown>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'FeedError';
    this.type = type;
    this.severity = severity;
    this.timestamp = new Date();
    this.context = context;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FeedError);
    }
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    switch (this.type) {
      case FeedErrorType.PLUGIN_OPERATION:
        return `Plugin operation failed: ${this.message}`;
      case FeedErrorType.FEED_VALIDATION:
        return `Invalid feed configuration: ${this.message}`;
      case FeedErrorType.FEED_FETCH:
        return `Failed to fetch feed: ${this.message}`;
      case FeedErrorType.FEED_PARSE:
        return `Failed to parse feed content: ${this.message}`;
      case FeedErrorType.FEED_STORAGE:
        return `Failed to save feed data: ${this.message}`;
      default:
        return this.message;
    }
  }

  /**
   * Convert error to a structured log format
   */
  toLogFormat(): Record<string, unknown> {
    return {
      type: this.type,
      severity: this.severity,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
      originalError: this.originalError
        ? {
            message: this.originalError.message,
            stack: this.originalError.stack,
          }
        : undefined,
    };
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return this.severity !== ErrorSeverity.CRITICAL;
  }
}

/**
 * Factory functions for creating specific error types
 * These provide convenience and ensure consistency
 */
export const FeedErrors = {
  pluginOperation(
    message: string,
    context?: Record<string, unknown>,
    originalError?: Error
  ): FeedError {
    return new FeedError(
      message,
      FeedErrorType.PLUGIN_OPERATION,
      ErrorSeverity.HIGH,
      context,
      originalError
    );
  },

  feedValidation(message: string, context?: Record<string, unknown>): FeedError {
    return new FeedError(message, FeedErrorType.FEED_VALIDATION, ErrorSeverity.MEDIUM, context);
  },

  feedFetch(message: string, context?: Record<string, unknown>, originalError?: Error): FeedError {
    return new FeedError(
      message,
      FeedErrorType.FEED_FETCH,
      ErrorSeverity.MEDIUM,
      context,
      originalError
    );
  },

  feedParse(message: string, context?: Record<string, unknown>, originalError?: Error): FeedError {
    return new FeedError(
      message,
      FeedErrorType.FEED_PARSE,
      ErrorSeverity.MEDIUM,
      context,
      originalError
    );
  },

  feedStorage(
    message: string,
    context?: Record<string, unknown>,
    originalError?: Error
  ): FeedError {
    return new FeedError(
      message,
      FeedErrorType.FEED_STORAGE,
      ErrorSeverity.HIGH,
      context,
      originalError
    );
  },
};

// For backward compatibility, export the old class names as aliases
export class PluginOperationError extends FeedError {
  constructor(message: string) {
    super(message, FeedErrorType.PLUGIN_OPERATION, ErrorSeverity.HIGH);
    this.name = 'PluginOperationError';
  }
}

export class FeedValidationError extends FeedError {
  constructor(message: string) {
    super(message, FeedErrorType.FEED_VALIDATION, ErrorSeverity.MEDIUM);
    this.name = 'FeedValidationError';
  }
}

export class FeedFetchError extends FeedError {
  constructor(message: string) {
    super(message, FeedErrorType.FEED_FETCH, ErrorSeverity.MEDIUM);
    this.name = 'FeedFetchError';
  }
}

export class FeedParseError extends FeedError {
  constructor(message: string) {
    super(message, FeedErrorType.FEED_PARSE, ErrorSeverity.MEDIUM);
    this.name = 'FeedParseError';
  }
}

export class FeedStorageError extends FeedError {
  constructor(message: string) {
    super(message, FeedErrorType.FEED_STORAGE, ErrorSeverity.HIGH);
    this.name = 'FeedStorageError';
  }
}
