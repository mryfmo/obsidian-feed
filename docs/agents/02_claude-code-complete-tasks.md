# Complete Task Definitions for Claude Code Workflow

This document provides the complete 28 task definitions referenced in `02_claude-code.md`.

## Complete Phase → Step → Task Definitions

### FETCH Phase (3 tasks)
| Step | Task | Purpose | Procedure | Input | Output | Exit Gate |
|------|------|---------|-----------|-------|--------|-----------|
| F-1 | Retrieval plan | List required URLs | Create markdown table in `<think>` tags | Assignment text | doc-list.md | File exists with valid URLs |
| F-2 | Retrieval execution | File download & cache | `$ tools/fetch_doc.sh URL` | doc-list.md | .cache/... | G-DUP (no duplicates) |
| F-3 | Commit | Add retrieved items | `apply_patch` to git | .cache | Git tree | Diff contains only retrieved items |

### INV Phase (Investigation - 3 tasks)
| Step | Task | Purpose | Procedure | Input | Output | Exit Gate |
|------|------|---------|-----------|-------|--------|-----------|
| I-1 | Reproduce | Reproduce failure | `$ pnpm test` | Bug report | fail-log.md | Exit code ≠ 0 |
| I-2 | Minimal test | Create failing test | `apply_patch` | fail-log.md | test.spec.ts | Test shows RED |
| I-3 | Document | Record reproduction | Write to docs/qa/ | Test output | qa-sheet.md | G-PHASE (proper tags) |

### ANA Phase (Analysis - 4 tasks)
| Step | Task | Purpose | Procedure | Input | Output | Exit Gate |
|------|------|---------|-----------|-------|--------|-----------|
| A-1 | Causal tree | Root cause analysis | Create mermaid diagram | fail-log.md | cause-tree.md | Reviewer approval |
| A-2 | Impact scope | List affected modules | `grep -r` analysis | cause-tree.md | impact.md | All files listed |
| A-3 | Risk assessment | Identify risks | FMEA table creation | impact.md | risks.md | G-RISK (all mitigated) |
| A-4 | Commit analysis | Add to git | `apply_patch` | All ANA outputs | Git commit | Clean diff |

### PLAN Phase (4 tasks)
| Step | Task | Purpose | Procedure | Input | Output | Exit Gate |
|------|------|---------|-----------|-------|--------|-----------|
| P-1 | RFC draft | Design document | Write RFC format | ANA outputs | rfc-draft.md | G-RFC (format check) |
| P-2 | Test strategy | Define test approach | List test types needed | rfc-draft.md | test-plan.md | Coverage ≥ 90% planned |
| P-3 | Patch design | Implementation plan | Pseudocode/diagrams | rfc-draft.md | patch-plan.md | LOC estimate ≤ 1000 |
| P-4 | Review checkpoint | Get approval | Submit for review | All PLAN outputs | approved-rfc.md | 1+ reviewer 👍 |

### BUILD Phase (6 tasks)
| Step | Task | Purpose | Procedure | Input | Output | Exit Gate |
|------|------|---------|-----------|-------|--------|-----------|
| B-1 | Code modification | Implement changes | `apply_patch` | patch-plan.md | src/ diff | G-SIZE (LOC ≤ 1000) |
| B-2 | Unit tests | Add/update tests | TDD approach | test-plan.md | test/ diff | All tests GREEN |
| B-3 | Lint & format | Code quality | `$ pnpm lint:fix` | All code | Clean output | No warnings |
| B-4 | Type check | Type safety | `$ pnpm typecheck` | All code | Clean output | No errors |
| B-5 | Integration | Verify integration | `$ pnpm test:int` | Built code | test-results.md | All pass |
| B-6 | Documentation | Update docs | Markdown/JSDoc | Code changes | docs/ diff | G-DOC (complete) |

### VERIF Phase (Verification - 5 tasks)
| Step | Task | Purpose | Procedure | Input | Output | Exit Gate |
|------|------|---------|-----------|-------|--------|-----------|
| V-1 | Coverage check | Ensure test coverage | `$ pnpm test:cov` | All tests | coverage.html | G-COV (≥ 90%) |
| V-2 | Manual QA | UI/UX validation | Follow QA checklist | Built app | qa-results.md | No P1 issues |
| V-3 | Performance | Benchmark if needed | Run perf tests | Built app | perf-report.md | No regression |
| V-4 | Security scan | Vulnerability check | `$ pnpm audit` | Dependencies | audit-log.md | No high/critical |
| V-5 | Changelog | Document changes | Update CHANGELOG.md | All changes | CHANGELOG diff | G-SEMVER (correct) |

### REL Phase (Release - 3 tasks)
| Step | Task | Purpose | Procedure | Input | Output | Exit Gate |
|------|------|---------|-----------|-------|--------|-----------|
| R-1 | Version bump | Update version | `$ npm version` | CHANGELOG | package.json | Semantic version |
| R-2 | Release notes | User-facing docs | Summarize changes | CHANGELOG | RELEASE.md | Clear & complete |
| R-3 | Tag & publish | Create release | `$ git tag -a` | All artifacts | Git tag | CI/CD GREEN |

## Summary
Total: 28 tasks across 7 phases
- FETCH: 3 tasks
- INV: 3 tasks  
- ANA: 4 tasks
- PLAN: 4 tasks
- BUILD: 6 tasks
- VERIF: 5 tasks
- REL: 3 tasks

## Guard ID Reference
See section 3 of `02_claude-code.md` for complete guard definitions (G-PHASE, G-NET, G-SIZE, G-EDGE, G-COV, etc.)

## Notes
- Each task must be completed in sequence within its phase
- Phase transitions require all tasks in the current phase to pass exit gates
- Guards are enforced by `tools/turn_guard.sh` and CI workflows
- All outputs must be committed to git for audit trail