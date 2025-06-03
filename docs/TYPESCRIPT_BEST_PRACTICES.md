# TypeScript Best Practices - Evidence-Based Guidelines

## Overview

This document provides evidence-based TypeScript best practices based on official documentation, community consensus, and this project's existing patterns.

## Type Usage Guidelines

### 1. The `any` Type - Avoid When Possible

**Official TypeScript Position:**
> "The `any` type is essentially an escape hatch from the type system." - TypeScript Handbook

**When to use `any`:**
- **Migration phase**: When converting JavaScript to TypeScript gradually
- **Third-party libraries**: When type definitions are unavailable
- **Never in new code**: New TypeScript code should avoid `any`

**Current project usage:**
- Only 2 instances of explicit `any` in source code (both in test helpers)
- Project follows best practice of avoiding `any`

### 2. The `unknown` Type - The Safe Alternative

**Official TypeScript Position (v3.0+):**
> "`unknown` is the type-safe counterpart of `any`. Anything is assignable to `unknown`, but `unknown` isn't assignable to anything but itself and `any` without a type assertion or narrowing."

**When to use `unknown`:**
```typescript
// ✅ GOOD - External data with unknown shape
async function parseExternalData(data: unknown): Promise<ParsedData> {
  // Must validate/narrow before use
  if (isValidData(data)) {
    return data;
  }
  throw new Error('Invalid data');
}

// ✅ GOOD - Error handling
catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Unknown error:', String(error));
  }
}
```

**Current project example:**
```typescript
// From src/getFeed.ts - Good use of unknown
type ImageObject = { url?: string; [key: string]: unknown };
```

### 3. The `undefined` Type - Handle Explicitly

**TypeScript Best Practice:**
- Enable `strictNullChecks` (this project has it enabled via `strict: true`)
- Be explicit about optional values

**Patterns:**
```typescript
// ✅ GOOD - Optional parameters
function process(data: string, options?: ProcessOptions): void

// ✅ GOOD - Union types for nullable values  
type Result = string | undefined;

// ✅ GOOD - Type guards
if (value !== undefined) {
  // Safe to use value
}
```

## Type Safety Hierarchy

1. **Specific types** (e.g., `string`, `number`, custom interfaces) - BEST
2. **Generic types** (e.g., `T extends BaseType`) - GOOD  
3. **`unknown`** - SAFE when type is truly unknown
4. **`any`** - AVOID except for migration/interop

## Practical Examples from This Project

### Good Patterns Already in Use:

```typescript
// From src/types.ts - Specific types
export interface FeedItem {
  id: string;
  title: string;
  content: string;
  // ... specific fields
}

// From src/getFeed.ts - Unknown for dynamic data
type ImageObject = { url?: string; [key: string]: unknown };

// From src/errors.ts - Proper error handling
export class FeedError extends Error {
  constructor(
    message: string,
    public readonly errorType: FeedErrorType,
    public readonly severity: ErrorSeverity
  ) {
    super(message);
  }
}
```

### Patterns to Fix:

```typescript
// ❌ CURRENT (in tests)
export function isMockFunction<T extends (...args: any[]) => any>(fn: T)

// ✅ SHOULD BE
export function isMockFunction<T extends (...args: unknown[]) => unknown>(fn: T)
```

## ESLint Configuration

This project correctly enforces:
```javascript
'@typescript-eslint/no-explicit-any': 'error',
```

## Migration Strategy for Remaining Issues

1. **Test helpers with `any`**: Replace with `unknown` or specific types
2. **Promise executor returns**: Add explicit `void` type
3. **Destructuring preferences**: Use ESLint auto-fix

## References

1. [TypeScript Handbook - Type System](https://www.typescriptlang.org/docs/handbook/type-checking-javascript-files.html)
2. [TypeScript 3.0 Release Notes - Unknown Type](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-0.html)
3. [TypeScript Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

## Summary

- **Use specific types** whenever possible
- **Use `unknown`** for truly unknown types (requires validation)
- **Never use `any`** in new code
- **Handle `undefined`** explicitly with optional chaining and guards
- **Enable strict mode** (already enabled in this project)