/**
 * Type definitions for test mocks to ensure type safety
 */

import type { AxiosError } from 'axios';

/**
 * Error type with code property for network errors
 */
export interface NetworkError extends Error {
  code?: string;
}

/**
 * Creates a network error with proper typing
 */
export function createNetworkError(message: string, code?: string): NetworkError {
  const error = new Error(message) as NetworkError;
  if (code) {
    error.code = code;
  }
  return error;
}

/**
 * Type guard for checking if an error has a code property
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof Error && 'code' in error;
}

/**
 * Axios error with code property
 */
export function createAxiosError(message: string, code?: string): AxiosError {
  const error = new Error(message) as AxiosError;
  error.isAxiosError = true;
  if (code) {
    (error as AxiosError & { code?: string }).code = code;
  }
  return error;
}
