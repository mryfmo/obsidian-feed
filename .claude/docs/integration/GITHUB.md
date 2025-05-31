# GitHub Actions Integration

This document covers GitHub Actions integration and STP validation.

<\!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Claude Code Action Integration Guide

This guide explains how Claude Code Action integrates with the strict workflow system.

## Core Principles

1. **Phase Adherence**: All work must follow the 7-phase lifecycle
2. **Guard Rails**: Every output validated by `turn_guard.sh`
3. **Artifact Creation**: Required deliverables for each phase
4. **Audit Trail**: All state transitions recorded

## Integration Architecture

### 1. Workflow Triggers

Claude Code Action activates when:

- `@claude` mentioned in issues/PRs/comments
- PR opened/synchronized (for auto-review)

### 2. Context Detection

The action automatically detects:

- Current phase from PR title/labels
- Required artifacts for the phase
- Valid next transitions

### 3. Response Format

All Claude responses must follow:

```markdown
<think>
[Analysis of request and current state]
[20-700 words]
</think>

<act>
PHASE: Specific task description
[Actual work - commands, patches, analysis]
</act>

<verify>
[Verification of work completed]
[Test results, checks performed]
</verify>

<next>
[Next steps or state transition]
State-Transition: CURRENT→NEXT
</next>
```

### 4. Phase-Specific Requirements

#### FETCH Phase

- **Purpose**: Retrieve external documents/resources
- **Allowed**: Network operations via `fetch_doc.sh`
- **Artifacts**: Downloaded files in `.cache/`
- **Restrictions**: No code changes
- **Security**: URL validation, malicious content blocking, 10MB size limit

#### INV Phase

- **Purpose**: Investigate and reproduce issues
- **Allowed**: Run tests, create reproduction cases
- **Artifacts**: Failing test, investigation notes in `docs/qa/`
- **Restrictions**: No fixes, only diagnosis

#### ANA Phase

- **Purpose**: Root cause analysis
- **Allowed**: Code analysis, impact assessment
- **Artifacts**: Analysis document in `docs/qa/`
- **Restrictions**: No implementation

#### PLAN Phase

- **Purpose**: Design solution
- **Allowed**: Create RFC, define scope
- **Artifacts**: RFC in `docs/rfcs/`
- **Restrictions**: Requires review approval to proceed

#### BUILD Phase

- **Purpose**: Implement solution
- **Allowed**: Code changes, test updates
- **Artifacts**: Patches via `apply_patch`
- **Restrictions**: ≤1000 LOC, ≤10 files (exceptions allowed with approval)
- **Dependencies**: Requires approved PLAN phase completion

#### VERIF Phase

- **Purpose**: Verify implementation
- **Allowed**: Run tests, check coverage
- **Artifacts**: Test results, CHANGELOG update
- **Restrictions**: No new features

#### REL Phase

- **Purpose**: Release preparation
- **Allowed**: Version bump, release notes
- **Artifacts**: Release commit, GitHub release, VERIF completion certificate
- **Restrictions**: Only after VERIF complete with QA sign-off
- **Dependencies**: Requires VERIF phase completion artifact

## GitHub Action Configuration

### Required Secrets

```yaml
CLAUDE_ACCESS_TOKEN: OAuth access token
CLAUDE_REFRESH_TOKEN: OAuth refresh token
CLAUDE_EXPIRES_AT: Token expiration timestamp
```

### Workflow Integration

The main workflow (`claude.yml`) should:

1. Detect current phase from context
2. Run Claude with phase-aware prompt
3. Validate output with turn_guard.sh
4. Update PR labels/state
5. Trigger dependent workflows

### Example PR Flow

1. User creates PR with title "INV: Fix feed parsing error"
2. User comments "@claude investigate this issue"
3. Claude Code Action:
   - Detects INV phase
   - Reproduces issue
   - Creates failing test
   - Updates PR with findings
   - Suggests transition to ANA
4. Guard validation ensures compliance
5. PR label updated automatically

## Best Practices

1. **Always validate phase context** before responding
2. **Create artifacts incrementally** as work progresses
3. **Use explicit state transitions** in every response
4. **Follow existing patterns** in the codebase
5. **Respect role boundaries** defined in agent docs
6. **Run local validation** before submitting

## Error Recovery

If validation fails:

1. Error logged to PR comment
2. Phase label remains unchanged
3. User must correct and retry
4. No state transition occurs

## Monitoring

Track success via:

- Guard validation pass rate
- Phase transition accuracy
- Artifact completeness
- CI/CD pipeline status


---


<\!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# STP Validation Guide

This guide explains how the Standard Task Protocol (STP) validation works and how to ensure your PRs pass validation.

## Overview

The STP Guard validates that all pull requests follow the Standard Task Protocol by checking for state transition markers or checklist updates. This ensures proper task lifecycle tracking.

## What Gets Validated

The validation checks **three sources** for STP markers:

### 1. Pull Request Body

The PR description is checked for:

- State transition markers: `State-Transition: INV→ANA`
- Checklist items: `- [x] INV: Investigation complete`
- Phase markers: `INV ✅`, `ANA ✓`

### 2. All Commit Messages

**Every commit** in the PR is checked, not just the latest one:

- Commit footers: `State-Transition: BUILD→VERIF`
- Inline markers: `[x] PLAN: RFC created`

### 3. Changed Documentation Files

Diffs in these files are checked for checklist updates:

- `docs/rfcs/*.md`
- `docs/qa/*.md`
- `.github/*.md`

## Valid STP Markers

### State Transition Format

```
State-Transition: CURRENT→NEXT
State-Transition: INV → ANA
State-Transition: BUILD -> VERIF
```

### Checklist Format

```markdown
- [x] INV: Investigation complete
- [x] ANA: Root cause identified
- [ ] PLAN: RFC not yet created
```

### Phase Markers

```
INV ✅
ANA ✓
PLAN ☑
```

### Valid Phases

- `INV` - Investigation
- `ANA` - Analysis
- `PLAN` - Planning
- `BUILD` - Building/Implementation
- `VERIF` - Verification
- `REL` - Release

## How to Add STP Markers

### Method 1: In PR Description

When creating or editing a PR, add a checklist:

```markdown
## Changes

Fixed the feed parsing issue.

## STP Progress

- [x] INV: Reproduced the issue with test case
- [x] ANA: Identified root cause in parser logic
- [x] PLAN: Simple fix, no RFC needed
- [x] BUILD: Updated parser and tests
- [ ] VERIF: Awaiting review
```

### Method 2: In Commit Messages

Add state transitions to your commits:

```bash
git commit -m "Fix feed parser edge case

Handles empty feed titles gracefully.

State-Transition: BUILD→VERIF"
```

### Method 3: In Documentation

Update checklists in RFC or QA documents:

```markdown
# RFC-001: Feed Parser Improvements

## Progress

- [x] INV: Issue investigated
- [x] ANA: Analysis complete
- [x] PLAN: This RFC
- [ ] BUILD: Implementation pending
```

## Local Validation

You can validate STP markers locally before pushing:

### Traditional Shell Script

```bash
# Check current branch
./tools/validate-stp-markers.sh

# Check with PR body
./tools/validate-stp-markers.sh "Your PR description here"

# Check specific commit range
./tools/validate-stp-markers.sh "" origin/main feature-branch
```

### MCP-Enhanced Execution

```bash
# Check with MCP bridge (intelligent fallback)
npx tsx .mcp/bridge.ts validate_stp_markers

# With PR body
npx tsx .mcp/bridge.ts validate_stp_markers "Your PR description"
```

**Note**: The MCP integration provides enhanced validation with caching and performance optimization. It automatically falls back to the shell script if MCP servers are unavailable.

## CI/CD Integration

The STP Guard runs automatically on:

- PR creation
- PR edits
- New commits
- PR reopening

### Workflow Details

1. **Full History**: The workflow fetches complete git history to check all commits
2. **Multiple Sources**: Checks PR body, all commits, and file changes
3. **Clear Feedback**: Shows exactly where markers were found or missing

## Troubleshooting

### "No STP markers found"

This means none of the three sources contained valid markers. Add markers using any of the methods above.

### "Lifecycle spec missing"

The file `docs/agents/01_task-lifecycle.md` must exist in the repository.

### Shallow Clone Issues

If running locally with a shallow clone:

```bash
git fetch --unshallow
```

### Special Characters

Both arrow formats work:

- Unicode arrow: `→` (U+2192)
- ASCII arrow: `->`

## Examples of Valid Markers

### In PR Body

```markdown
This PR implements the new feed parser.

Progress:

- [x] INV: Investigated performance issues
- [x] ANA: Profiled and found bottleneck
- [x] PLAN: Created optimization plan
- [x] BUILD: Implemented caching
- [ ] VERIF: Performance testing pending
```

### In Commit Message

```
refactor: Extract feed validation logic

Moved validation to separate module for reusability.
Added comprehensive test coverage.

State-Transition: BUILD→VERIF
Co-authored-by: @teammate
```

### In Changed Files

```diff
# docs/rfcs/002-feed-validation.md

## Implementation Progress
- - [ ] BUILD: Implementation
+ - [x] BUILD: Implementation complete
```

## Benefits

1. **Traceability**: Every PR shows its position in the task lifecycle
2. **Automation**: CI/CD can enforce workflow compliance
3. **Flexibility**: Multiple ways to add markers
4. **Completeness**: Checks all commits, not just the latest

## Related Documentation

- [`01_task-lifecycle.md`](./01_task-lifecycle.md) - Full STP specification
- [`validate-stp-markers.sh`](../../tools/validate-stp-markers.sh) - Validation script (MCP-enhanced)
- [`.github/workflows/stp-guard.yml`](../../.github/workflows/stp-guard.yml) - CI workflow
- [`MCP_DOCUMENTATION.md`](../../MCP_DOCUMENTATION.md) - Complete MCP integration details
- [`.mcp/bridge.ts`](../../.mcp/bridge.ts) - MCP bridge implementation
