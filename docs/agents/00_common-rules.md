<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Common Rules & Coding Guidelines

All agents MUST comply with the rules below unless explicitly told otherwise in the task description. They are kept in a single file so that every agent can embed it in its prompt without blowing the token budget.

- For detailed workflow, see 02_claude-code.md.
- For specific WBS/RACI/Exit Gate/guardrails, see **02_claude-code.md**.

## 1. Repository Basics

- Node version : **≥ 20.9**
- Package manager : **pnpm** (run `pnpm install` before anything else)
- Source language : **TypeScript 5** (uses modern `ES2024` features)
- Test frameworks : **Vitest** (unit / integration) & **Playwright** (E2E)
- Linter / Format : **ESLint** (Airbnb-flavoured ruleset) + **Prettier** for consistent whitespace
- Build script : `pnpm build` → produces `/dist` bundle via ESBuild
- Obsidian API : v1.8.x (Electron 27, DOM = Chromium 119)

## 2. Golden Path for Any Change

1. Create a new branch locally (if you are a human) OR work in-place (if you are a bot running inside a sandbox).
2. Run `pnpm test` → tests must be green **before** you start editing so you catch pre-existing breakage.
3. Perform the minimal code modifications that solve the problem at its root cause. Avoid "drive-by" stylistic changes.
4. Update or add tests that reproduce the bug / assert the new behaviour.
5. Execute:
   - `pnpm lint` – must be clean.
   - `pnpm test` and, if the change affects UI or async code, `pnpm e2e`.
6. If any new dependency is strictly required, justify it inside the PR description; transient deps are blocked via `depcheck`.
7. Edit `CHANGELOG.md` under the _[Unreleased]_ heading following _Keep-a-Changelog_ format.
8. Submit the patch (or push the branch). Keep explanation short (<150 words) unless architectural.

## 3. TypeScript Coding & Comment Style

This project aligns with the **Airbnb JavaScript / TypeScript Style Guide** (via `eslint-config-airbnb-base` + `@typescript-eslint`), augmented by **Prettier** for deterministic formatting and **TSDoc** for API documentation.

Key points to remember:

• 2-space indentation, semicolons always, single quotes, trailing commas where valid.  
• `type`-level exports go at the bottom of a file; concrete implementations first.  
• Prefer `const` and `readonly` – mutable state should be explicit.  
• Avoid the `any` type; exhaustiveness via discriminated unions.  
• Public functions/classes require a TSDoc block:

```ts
/**
 * Parses an RSS/Atom feed string into a strongly-typed {@link ParsedFeed}.
 *
 * @param xml   Raw XML as returned by the network layer.
 * @returns     Parsed representation guaranteed to have at least one item.
 * @throws      {@link FeedParseError} if the XML is invalid.
 *
 * @example
 * const feed = parseFeed(xmlString);
 * console.log(feed.title);
 */
```

ESLint + Prettier are wired into the CI; local pre-commit hooks run `pnpm lint:fix` to auto-apply stylistic changes.

## 4. Patch Formatting Rules

• Use the Claude Code `apply_patch` JSON RPC (already available in the sandbox) to edit files.  
• **Do not** attach entire file contents if you changed only a few lines.  
• Remove inline comments you added for yourself before finalising the patch.  
• Never introduce licence headers or watermarks unless the issue explicitly requests it.  
• Keep line length ≤ 100 chars when practical.
• For BUILD-phase size limits **and the new FETCH phase rules**, see _02_claude-code.md_.

## 5. Testing Matrix

| Layer              | Command      | Runs on CI? | Notes                           |
| ------------------ | ------------ | ----------- | ------------------------------- |
| Unit & Integration | `pnpm test`  | ✅          | fast, JSDOM environment         |
| E2E (desktop)      | `pnpm e2e`   | ✅          | uses Playwright + Electron stub |
| TypeCheck          | `pnpm build` | ✅          | `tsc --noEmit` + ESBuild bundle |

CI executes the full matrix on `main` and on every PR using GitHub Actions (`.github/workflows/ci.yml`). All steps must pass.

## 6. Commit Message Conventions (Conventional Commits)

`type(scope): summary`  
Types accepted: **feat**, **fix**, **refactor**, **docs**, **test**, **chore**, **build**, **ci**, **perf**. Example:

```
fix(parser): handle CDATA blocks with namespaced tags
```

The `rel` agent will use these to generate the changelog.

## 7. Security & Privacy

### Core Principles

• **No telemetry**: Never add analytics, tracking, or unauthorized network calls outside `/src/network` abstraction.  
• **Secret handling**: API keys and tokens are stored in Obsidian's encrypted DB; never log, display, or include them in error messages.  
• **Sandbox compliance**: All file operations must stay within the user's vault path - no access to system files.  
• **Input validation**: Sanitize and validate all user inputs, especially file paths, URLs, and HTML content.  
• **Content Security**: Use CSP headers and sanitization when rendering external content.  
• **No code execution**: Never use `eval()`, `Function()`, or execute user-provided scripts.

### Common Security Pitfalls & Examples

#### ❌ BAD: Logging Sensitive Data

```typescript
// NEVER DO THIS
console.log(`Fetching with API key: ${settings.apiKey}`);
throw new Error(`Auth failed with key: ${settings.apiKey}`);

// ✅ GOOD: Sanitize error messages
console.log('Fetching with API key: [REDACTED]');
throw new Error('Authentication failed - check your API key in settings');
```

#### ❌ BAD: Path Traversal Vulnerability

```typescript
// NEVER DO THIS - allows accessing files outside vault
const path = `${vaultPath}/${userInput}`; // userInput could be "../../etc/passwd"

// ✅ GOOD: Validate and normalize paths
import { normalize, join } from 'path';

function safeJoinPath(base: string, userPath: string): string {
  const normalized = normalize(userPath);
  const joined = join(base, normalized);

  // Ensure the result is still within the base directory
  if (!joined.startsWith(normalize(base))) {
    throw new Error('Invalid path: access outside vault not allowed');
  }
  return joined;
}
```

#### ❌ BAD: XSS via Unsanitized Content

```typescript
// NEVER DO THIS - allows script injection
contentEl.innerHTML = feedItem.content;

// ✅ GOOD: Sanitize HTML content
import { sanitizeHTMLToDom } from 'obsidian';

const sanitized = sanitizeHTMLToDom(feedItem.content);
contentEl.appendChild(sanitized);

// Or use DOMPurify for custom sanitization
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(feedItem.content, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
  ALLOWED_ATTR: ['href', 'title'],
});
```

#### ❌ BAD: Unsafe URL Handling

```typescript
// NEVER DO THIS - allows javascript: and data: URLs
window.open(userProvidedUrl);

// ✅ GOOD: Validate URL protocols
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

if (isValidUrl(userProvidedUrl)) {
  window.open(userProvidedUrl);
}
```

#### ❌ BAD: Command Injection

```typescript
// NEVER DO THIS - allows command injection
exec(`curl ${userUrl}`); // userUrl could be "example.com; rm -rf /"

// ✅ GOOD: Use safe APIs or proper escaping
import { requestUrl } from 'obsidian';

const response = await requestUrl({
  url: userUrl,
  method: 'GET',
  headers: { 'User-Agent': 'Obsidian-Feed-Reader' },
});
```

#### ❌ BAD: Storing Secrets in Code

```typescript
// NEVER DO THIS
const DEFAULT_API_KEY = 'sk-1234567890abcdef';
const CORS_PROXY = 'https://api.example.com/proxy?key=secret';

// ✅ GOOD: Require user configuration
interface Settings {
  apiKey: string; // User must provide
  corsProxy?: string; // Optional, no defaults
}

// Validate before use
if (!settings.apiKey) {
  new Notice('Please configure your API key in settings');
  return;
}
```

### Security Checklist for Code Review

- [ ] No secrets, tokens, or API keys in code or logs
- [ ] All user inputs are validated and sanitized
- [ ] File paths are normalized and confined to vault
- [ ] External content is sanitized before rendering
- [ ] URLs are validated for safe protocols
- [ ] No use of eval() or dynamic code execution
- [ ] Error messages don't leak sensitive information
- [ ] Network requests use proper abstractions
- [ ] CORS proxy usage is documented and optional
- [ ] Content Security Policy is enforced where applicable

## 8. Performance Targets

• Cold plugin load ≤ 150 ms on an M1 Mac / 8th-gen i5.  
• Refresh 100 feeds ≤ 8 s assuming average 150 KB XML each.  
• UI should remain responsive (> 45 FPS) during background fetches.

## 9. When in Doubt

Ask for clarification in the issue or PR thread. Over-communication is cheaper than fixing misunderstandings later.
