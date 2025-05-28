# Common Rules & Coding Guidelines

All agents MUST comply with the rules below unless explicitly told otherwise in the task description.  They are kept in a single file so that every agent can embed it in its prompt without blowing the token budget.

* For detailed workflow, see 02_claude-code.md.
* For specific WBS/RACI/Exit Gate/guardrails, see **02_claude-code.md**.

## 1. Repository Basics

* Node version  : **≥ 20.9**  
* Package manager : **pnpm**   (run `pnpm install` before anything else)  
* Source language  : **TypeScript 5**   (uses modern `ES2024` features)  
* Test frameworks  : **Vitest** (unit / integration) & **Playwright** (E2E)  
* Linter / Format  : **ESLint** (Airbnb-flavoured ruleset) + **Prettier** for consistent whitespace  
* Build script   : `pnpm build` → produces `/dist` bundle via ESBuild  
* Obsidian API     : v1.8.x (Electron 27, DOM = Chromium 119)

## 2. Golden Path for Any Change

1. Create a new branch locally (if you are a human) OR work in-place (if you are a bot running inside a sandbox).
2. Run `pnpm test` → tests must be green **before** you start editing so you catch pre-existing breakage.
3. Perform the minimal code modifications that solve the problem at its root cause.  Avoid “drive-by” stylistic changes.
4. Update or add tests that reproduce the bug / assert the new behaviour.
5. Execute:
   * `pnpm lint` – must be clean.
   * `pnpm test` and, if the change affects UI or async code, `pnpm e2e`.
6. If any new dependency is strictly required, justify it inside the PR description; transient deps are blocked via `depcheck`.
7. Edit `CHANGELOG.md` under the *[Unreleased]* heading following *Keep-a-Changelog* format.
8. Submit the patch (or push the branch).  Keep explanation short (<150 words) unless architectural.

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
• For BUILD-phase size limits **and the new FETCH phase rules**, see *02_claude-code.md*.

## 5. Testing Matrix

| Layer | Command | Runs on CI? | Notes |
|-------|---------|------------|-------|
| Unit & Integration | `pnpm test` | ✅  | fast, JSDOM environment |
| E2E (desktop) | `pnpm e2e` | ✅  | uses Playwright + Electron stub |
| TypeCheck | `pnpm build` | ✅  | `tsc --noEmit` + ESBuild bundle |

CI executes the full matrix on `main` and on every PR using GitHub Actions (`.github/workflows/ci.yml`).  All steps must pass.

## 6. Commit Message Conventions (Conventional Commits)

`type(scope): summary`  
Types accepted: **feat**, **fix**, **refactor**, **docs**, **test**, **chore**, **build**, **ci**, **perf**.  Example:

```
fix(parser): handle CDATA blocks with namespaced tags
```

The `rel` agent will use these to generate the changelog.

## 7. Security & Privacy

• No telemetry is sent.  Do not add network calls outside the `/src/network` abstraction.  
• Secrets (e.g., Claude API key) are provided by the user via plugin settings and stored in Obsidian’s encrypted DB; never log them.  
• Adhere to the Obsidian sandbox policy: file reads/writes must stay under the user’s vault path.

## 8. Performance Targets

• Cold plugin load ≤ 150 ms on an M1 Mac / 8th-gen i5.  
• Refresh 100 feeds ≤ 8 s assuming average 150 KB XML each.  
• UI should remain responsive (> 45 FPS) during background fetches.

## 9. When in Doubt

Ask for clarification in the issue or PR thread.  Over-communication is cheaper than fixing misunderstandings later.
