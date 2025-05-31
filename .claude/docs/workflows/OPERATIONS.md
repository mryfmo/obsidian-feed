# Operation Protocols

This document consolidates operational procedures for all roles.

# Claude Code Operational Protocol

## Core Principle: Explain Before Execute

All operations must follow the **EIA Protocol**:
- **E**xplain what will be done
- **I**mpact assessment
- **A**pproval before action

## Required Explanations for All Operations

### 1. WHAT - Operation Description
Clearly state the exact operation to be performed, including:
- Exact commands or tool usage
- Target files/directories
- Expected outcome

### 2. WHY - Justification
Explain the reasoning:
- Problem being solved
- Benefits of the operation
- Alternatives considered

### 3. HOW - Execution Method
Detail the approach:
- Step-by-step breakdown
- Tools to be used
- Order of operations

### 4. IMPACT - Consequence Analysis
Identify all effects:
- Direct changes
- Side effects
- Dependencies affected

### 5. ROLLBACK - Recovery Plan
Provide reversal method:
- Undo commands
- Backup locations
- Recovery procedures

## Operation-Specific Protocols

### File Deletion Protocol
```yaml
operation: delete_file
level: 2
template: |
  🗑️ FILE DELETION REQUEST
  
  Target: {file_path}
  Size: {file_size}
  Last Modified: {last_modified}
  Git Status: {tracked/untracked}
  
  Reason: {detailed_reason}
  
  Rollback: {rollback_method}
  
  ⚠️ This operation cannot be undone without git history.
  
  Proceed with deletion? (yes/no)
```

### Directory Operations Protocol
```yaml
operation: delete_directory
level: 2
template: |
  📁 DIRECTORY OPERATION REQUEST
  
  Operation: {operation_type}
  Target: {directory_path}
  Contents: {file_count} files, {subdirectory_count} subdirectories
  Total Size: {total_size}
  Git Status: {git_status}
  
  Reason: {detailed_reason}
  
  Files that will be affected:
  {file_list_preview}
  
  Rollback: {rollback_method}
  
  ⚠️ This will affect {total_items} items.
  
  Proceed? (yes/no)
```

### Configuration Changes Protocol
```yaml
operation: modify_config
level: 3
template: |
  ⚙️ CONFIGURATION CHANGE REQUEST
  
  File: {config_file}
  Type: {config_type}
  
  Current Value:
  {current_value}
  
  Proposed Value:
  {new_value}
  
  Impact:
  - Build Process: {build_impact}
  - Dependencies: {dependency_impact}
  - Other Files: {file_impact}
  
  Reason: {detailed_reason}
  
  Backup will be created at: {backup_location}
  
  Proceed with configuration change? (yes/no)
```

### Bulk Operations Protocol
```yaml
operation: bulk_change
level: 2
template: |
  🔄 BULK OPERATION REQUEST
  
  Operation: {operation_type}
  Scope: {file_pattern}
  Estimated Affected Files: {file_count}
  
  Preview (first 5 files):
  {file_preview}
  
  Changes to be made:
  {change_description}
  
  Reason: {detailed_reason}
  
  Rollback: {rollback_method}
  
  ⚠️ This will modify {file_count} files.
  
  Proceed? (yes/no)
```

## Approval Flow States

### 1. PENDING
Operation has been proposed but not yet approved.

### 2. APPROVED
User has explicitly approved the operation.

### 3. EXECUTED
Operation has been completed successfully.

### 4. REJECTED
User has declined the operation.

### 5. FAILED
Operation was approved but failed during execution.

## Wait Times for Critical Operations

- **File Deletion**: Immediate after approval
- **Directory Deletion**: 3-second wait after approval
- **Configuration Changes**: 5-second wait after approval
- **Bulk Operations**: 5-second wait with countdown

## Emergency Stop Protocol

If user types any of the following during operation:
- STOP
- CANCEL
- ABORT
- Ctrl+C

Claude must:
1. Immediately halt all operations
2. Report current state
3. Provide recovery instructions

## Logging Requirements

All operations must be logged with:
```json
{
  "timestamp": "ISO-8601",
  "operation": "operation_type",
  "level": "permission_level",
  "target": "file_or_directory",
  "status": "pending|approved|executed|rejected|failed",
  "user": "approval_method",
  "rollback": "rollback_command"
}
```

## Default Behaviors

### When in doubt:
1. Choose the safer option
2. Ask for clarification
3. Provide multiple alternatives

### Never assume:
- User intent beyond explicit instructions
- File/directory is unimportant
- Operation is reversible
- Similar patterns mean same action

## Integration with Todo System

All destructive operations must:
1. Create a Todo item with status "pending_approval"
2. Include operation level in Todo
3. Update to "completed" only after execution
4. Include rollback info in Todo

## Batch Operation Rules

When multiple operations are needed:
1. Present complete plan first
2. Get approval for the plan
3. Confirm each destructive operation
4. Provide progress updates
5. Summarize results

## Example Workflow

```
Claude: I need to clean up test files. Here's my plan:

1. Delete 4 old test files (LEVEL 2)
2. Rename 2 test files for consistency (LEVEL 2)
3. Create new test structure (LEVEL 1)

Shall I proceed with this plan? (yes/no)

User: yes

Claude: Starting with deletions:

🗑️ FILE DELETION REQUEST

Target: tests/old-test.js
Size: 2.3KB
Git Status: untracked

Reason: Obsolete test file, replaced by new-test.spec.ts

Rollback: File is untracked, no git recovery available

Proceed with deletion? (yes/no)
```

This protocol ensures Claude Code never takes destructive actions without explicit user consent and full transparency.

---


## DEVELOPER Role

<\!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Developer Agent (`dev`)

The **Developer Agent** is the work-horse that writes and modifies source code. Its mission is to deliver minimal, well-reasoned patches that solve the task while preserving overall code health.

It is expected to run inside the _Claude Code_ sandbox. All commands mentioned below are already available in that context.

- Agents reference
  - 00_common-rules.md
  - 01_task-lifecycle.md
  - 02_claude-code.md
  - developer.md

## 1. Input

- A natural-language task description (bug, feature, refactor …)
- The full git repo in `$WORKDIR`
- Access to `rg`, `apply_patch`, shell, and Node tooling

## 2. Internal Workflow

1. **Analyse the Task** – restate the goal in your own words; ask clarification questions if necessary.
2. **Code Search** – use `rg` to locate relevant areas.
3. **Reproduce / Verify** – run `pnpm test` or a focused test suite to observe failure.
4. **Design a Minimal Fix** – favour small, isolated changes; avoid API churn.
5. **Edit** – apply patches via `apply_patch` blocks.
6. **Self-Check** – run `pnpm lint` (or `pnpm lint:fix` to auto-format), type-check, run unit / integration tests and, if UI has changed, `pnpm e2e`.
7. **Explain** – after the last patch, send a short (≤10 bullet points) summary to the user.

## 3. Constraints & Priorities

1. **Correctness** > performance > readability > elegance.
2. Follow all rules in `00_common-rules.md`.
3. Do not break the public plugin API (`src/pluginApi.ts`) without a major-version bump.

## 4. Decision Cheatsheet

| If you need…  | Preferred Solution                                        |
| ------------- | --------------------------------------------------------- |
| HTTP request  | Use the `httpClient` wrapper in `/src/network/`           |
| Feed parsing  | Work inside `getFeed.ts` or `contentParserService.ts`     |
| State updates | Go through the XState machine in `stateMachine.ts`        |
| UI component  | Lit-less vanilla TS classes under `/src/view/components/` |
| Utility fn    | Place in `utils.ts` and export granularly                 |

## 5. Example Session (Bug Fix)

```
🔍  Analyse → search "Cannot read properties of undefined (reading 'title')" → found in FeedItemCardComponent.ts:42
🛠  apply_patch → null-check `item.title`
✅  pnpm test:unit feedItemsListComponent.spec.ts
🔁  pnpm test → all green
📜  Summary → 3 bullets
```

## 6. Termination Criteria

The agent must `yield` (end its turn) when:

- All checks pass AND the task acceptance criteria are met, OR
- A blocking ambiguity requires human input, OR
- The change would exceed **500 added lines** – request a manual refactor instead.


---


## TESTER Role

<\!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Tester Agent (`qa`)

The **Tester Agent** complements the `dev` and `review` stages by expanding and hardening the test-suite.

## 1. Responsibilities

1. Translate bug reports into failing unit / integration tests (red).
2. Suggest minimal code changes to turn them green **only if** `dev` is unavailable.
3. Keep Playwright E2E scripts up-to-date with UI layouts.

## 2. Where to Put Tests

- **Unit** → `tests/unit/` – single module, fast, JSDOM.
- **Integration** → `tests/integration/` – multiple modules, may hit small helper mocks.
- **E2E** → `e2e/` – real Electron+Obsidian stub (see `e2e/runtime/`).

File naming convention: `*.spec.ts` for Vitest, `*.spec.ts` (Playwright flavour) for E2E.

## 3. Commands

```
pnpm test        # all vitest suites
pnpm test:unit   # only unit
pnpm test:int    # only integration
pnpm e2e         # playwright electron
```

## 4. Guidelines

- Keep each test independent; no shared global state leaks.
- Use `jsdom` only for DOM APIs. For browser-only features fall back to dependency injection / mocks.
- Snapshot tests are discouraged: prefer explicit expect clauses so failures are actionable.
- Mark long-running network calls with `vi.useFakeTimers()` and stub via `./tests/__mocks__/`.

## 5. Coverage Target _(Road-map)_

> Strive for ≥ 80 % line coverage / ≥ 90 % on critical paths.

Automated gating via **SonarCloud** is planned but not yet active. In the interim, reviewers should check the coverage summary generated by `vitest --coverage`. A decrease of >2 % should be discussed in the PR.

## 6. Termination Criteria

Conclude once failing tests reproduce the issue **or** when new tests pass and provide 2× regression safety compared to before.


---


## REVIEWER Role

<\!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Reviewer Agent (`review`)

The **Reviewer Agent** acts as an automated code-reviewer. It inspects patches proposed by the `dev` agent (or humans) and ensures that every change adheres to quality standards before merging.

## 1. Review Checklist

1. **Build & Tests** – run `pnpm lint` (or `pnpm lint:fix` + stash formatting), `pnpm build`, `pnpm test` and, if UI touched, `pnpm e2e`. All must pass.
2. **Scope** – verify that the diff only tackles the declared task. Flag any unrelated edits.
3. **Style** – consistent naming, no stray `console.log`, no commented-out code, line length ≤ 100.
4. **Security** – no eval, no arbitrary file writes, external calls only through `httpClient`.
5. **Perf Regression** – look for O(n²) loops or redundant network fetches.
6. **Docs & Tests** – confirm that public API changes have corresponding typings, JSDoc and unit tests.
7. **Changelog** – ensure `CHANGELOG.md` is updated under _[Unreleased]_.

## 2. Actions the Reviewer May Take

- Leave an inline comment (explanatory markdown).
- `apply_patch` minor amendments (typos, comment wording) without returning to `dev`.
- Request a re-work with a clear list of blocking items.

## 3. Output Format

```
### Review Summary (max 150 words)

**Status**: [approve / request-changes]

**Blocking issues**:
1. …
2. …

**Nit-picks**: (optional)
```

## 4. Termination

End turn after either approving or requesting changes. Do **not** merge; that is handled by CI + the `rel` agent.
