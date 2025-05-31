<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Complete Guard Map for Claude Code Workflow

This document provides the complete guard definitions referenced in `02_claude-code.md`. All guards have been enhanced with MCP integration (Phase 2 Complete - 2025-01-29).

## Guard Map Overview

Guards are automated checks enforced by `tools/turn_guard.sh` and CI workflows. Each guard has a unique ID, verification logic, and specific exit code.

**MCP Enhancement**: All guards now support intelligent fallback through the MCP bridge:

```bash
# Traditional execution (still supported)
./tools/turn_guard.sh turn.md

# MCP-enhanced execution (with fallback)
npx tsx .mcp/bridge.ts turn_guard turn.md
```

## Complete Guard Definitions

| Guard ID       | Exit Code | Verification Content                                           | Corresponding Task | Failure Message                        |
| -------------- | --------- | -------------------------------------------------------------- | ------------------ | -------------------------------------- |
| **G-PHASE**    | 10        | Tag order must be: `<think>` → `<act>` → `<verify>` → `<next>` | All tasks          | "Tag order invalid"                    |
| **G-TOKEN**    | 11        | Think token count: 20 ≤ tokens ≤ 700                           | All tasks          | "<think> tokens out of range"          |
| **G-LABEL**    | 12        | Phase label present (FETCH/INV/ANA/PLAN/BUILD/VERIF/REL)       | All tasks          | "Phase label missing"                  |
| **G-NET**      | 13        | Network access (http/https) only in FETCH phase                | All non-FETCH      | "Network access only allowed in FETCH" |
| **G-SIZE**     | 14        | LOC ≤ 1000, files ≤ 10 per patch                               | BUILD tasks        | "Patch size exceeds limit"             |
| **G-DUP**      | 15        | No duplicate URLs (SHA256 check)                               | FETCH tasks        | "Duplicate download SHA detected"      |
| **G-PLAN**     | 16        | `# step-plan:` comment required in `<act>`                     | All tasks          | "step-plan comment missing"            |
| **G-TRIAGE**   | 17        | "Assumed Goals:" section required                              | All non-FETCH      | "Assumed Goals section missing"        |
| **G-RFC**      | 20        | RFC format validation                                          | PLAN/P-1           | "RFC format invalid"                   |
| **G-TEST**     | 21        | Test files must compile                                        | BUILD/B-2          | "Test compilation failed"              |
| **G-LINT**     | 22        | No lint errors                                                 | BUILD/B-3          | "Lint errors found"                    |
| **G-TYPE**     | 23        | No TypeScript errors                                           | BUILD/B-4          | "Type errors found"                    |
| **G-EDGE**     | 24        | New tests must pass                                            | BUILD/B-5          | "New tests failing"                    |
| **G-COV**      | 25        | Coverage ≥ 90% on changed lines                                | VERIF/V-1          | "Coverage below threshold"             |
| **G-PERF**     | 26        | No performance regression                                      | VERIF/V-3          | "Performance regression detected"      |
| **G-SEC**      | 27        | No high/critical vulnerabilities                               | VERIF/V-4          | "Security vulnerabilities found"       |
| **G-SEMVER**   | 28        | Valid semantic version                                         | REL/R-1            | "Invalid version format"               |
| **G-USER-OK**  | 30        | User acknowledgment present                                    | CONFIRM/C-2        | "User-Ack: ✅ missing"                 |
| **G-WBS-OK**   | 31        | All WBS items approved                                         | PLAN/P-2           | "Unapproved WBS items"                 |
| **G-RISK**     | 32        | All risks have mitigations                                     | ANA/A-3            | "Unmitigated risks found"              |
| **G-DOC**      | 33        | Documentation complete                                         | BUILD/B-6          | "Missing documentation"                |
| **G-ROLE**     | 40        | Role-based path restrictions                                   | All tasks          | "Role not allowed to edit path"        |
| **G-STATE**    | 41        | Valid state transitions                                        | All tasks          | "Invalid state transition"             |
| **G-ARTIFACT** | 42        | Required artifacts present                                     | Phase-specific     | "Missing required artifact"            |
| **RFC-OK**     | N/A       | RFC document approved                                          | PLAN phase         | "RFC not approved"                     |
| **WBS-OK**     | N/A       | WBS document approved                                          | PLAN phase         | "WBS not approved"                     |

## Guard Categories

### 1. Structure Guards (10-19)

- **G-PHASE**: Ensures correct markdown structure
- **G-TOKEN**: Prevents overly verbose or terse thinking
- **G-LABEL**: Ensures phase tracking
- **G-NET**: Prevents unauthorized network access
- **G-SIZE**: Prevents massive changes
- **G-DUP**: Prevents duplicate downloads
- **G-PLAN**: Ensures planning documentation
- **G-TRIAGE**: Ensures proper investigation

### 2. Quality Guards (20-29)

- **G-RFC**: Validates design documents
- **G-TEST**: Ensures test quality
- **G-LINT**: Code style enforcement
- **G-TYPE**: Type safety
- **G-EDGE**: Test success
- **G-COV**: Coverage requirements
- **G-PERF**: Performance standards
- **G-SEC**: Security requirements
- **G-SEMVER**: Version standards

### 3. Process Guards (30-39)

- **G-USER-OK**: User approval gates
- **G-WBS-OK**: Work breakdown approval
- **G-RISK**: Risk management
- **G-DOC**: Documentation requirements
- **RFC-OK**: RFC approval marker (specialized guard)
- **WBS-OK**: WBS approval marker (specialized guard)

### 4. Access Control Guards (40-49)

- **G-ROLE**: Role-based restrictions
- **G-STATE**: State machine enforcement
- **G-ARTIFACT**: Deliverable verification

## Implementation Details

### Exit Code Ranges

- 10-19: Structure violations
- 20-29: Quality violations
- 30-39: Process violations
- 40-49: Access control violations
- 50+: Reserved for future use

### Role Restrictions (G-ROLE)

```bash
# Example from turn_guard.sh
role=${TURN_ROLE:-dev}
if [[ "$role" == "review" ]]; then
  git diff --name-only --cached | grep -q '^src/' && die "review role not allowed to edit src/"
fi
```

### Coverage Calculation (G-COV)

```bash
# Changed lines coverage check
coverage=$(git diff --cached | coverage-tool --changed-only)
[[ $coverage -ge 90 ]] || exit 25
```

### Performance Check (G-PERF)

```bash
# Benchmark comparison
baseline=$(cat .perf/baseline.json)
current=$(pnpm benchmark --json)
compare-perf "$baseline" "$current" || exit 26
```

## CI Integration

Guards are enforced at different stages:

1. **Pre-commit**: G-PHASE, G-TOKEN, G-LABEL, G-PLAN
2. **PR Checks**: All structure and quality guards
3. **Merge Queue**: All guards including G-USER-OK, G-WBS-OK
4. **Release**: G-SEMVER and final verification

## Adding New Guards

To add a new guard:

1. Choose appropriate ID and exit code
2. Add to `tools/turn_guard.sh`
3. Add test case to `tests/spec.yml`
4. Update this document
5. Add CI integration if needed

## Testing Guards

```bash
# Test individual guard (traditional)
./tools/turn_guard.sh tests/fixtures/example.md

# Test with MCP enhancement
npx tsx .mcp/bridge.ts turn_guard tests/fixtures/example.md

# Run guard test suite (122 tests - all passing)
pnpm test tests/guard.spec.ts

# List all guards (traditional)
./tools/list_guards.sh

# List guards with MCP fallback
npx tsx .mcp/bridge.ts list_guards
```

## MCP Integration Features

### Enhanced Capabilities

1. **Intelligent Fallback**: Automatically falls back to shell scripts if MCP servers unavailable
2. **Performance Optimization**: Caching with TTL and LRU eviction for faster validation
3. **Context7 Integration**: Library documentation fetching for `fetch_doc.sh`
4. **GitHub Integration**: PR/issue management through MCP github server
5. **Sequential Thinking**: AI-powered analysis for complex validations

### Shell Script Compatibility

All shell scripts have been updated for macOS compatibility:

- Replaced `grep -P` with POSIX-compatible patterns
- Added proper exit code propagation
- Automatic cache directory creation
