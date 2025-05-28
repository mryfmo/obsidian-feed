# docs/agents/02_claude-code.md
# 02 – Claude Code Workflow & Guardrails ⚙️🤖

**Purpose** — **Complete workflow + guardrail definition** for Claude Code to autonomously execute "requirements → implementation → test → release" without runaway in multiple roles (dev / review / qa / rel ...).
*Applicable to: Claude Code CLI and Claude Code Action (GitHub integration)*

---

## 0 Scope 🗺️
* 7 phases **FETCH → INV → ANA → PLAN → BUILD → VERIF → REL**
* Each phase is decomposed into **steps → tasks** and always has **purpose / procedure / input / output / exit gate**.
* Deviations are forcibly eliminated by `tools/turn_guard.sh` + CI.

---

## 1 WBS + RACI + Exit Gate Overview

| WBS | Process | Deliverables | R (Responsible) | A/C/I | Exit Gate |
|-----|------|--------|----------|-------|-----------|
| 1.1 | Requirement review | gaps.md | dev | review | gaps.md approval (review) |
| 1.2 | Specification design | draft_workflow.md | dev | review | RFC format 👍 |
| 1.3 | Archi agreement | final_spec.md | review | dev/qa/rel | All roles OK mark |
| 2.1 | Guard design | guard.md | dev | review | mermaid diagram review |
| 2.2 | Guard implementation | tools/turn_guard.sh | dev | qa | shellcheck + unit green |
| 2.3 | fetch implementation | tools/fetch_doc.sh | dev | qa | Same as above |
| 2.4 | CI implementation | claude.yml, label-sync.yml | dev | qa | GH Action green |
| 3.1 | Test design | tests/spec.yml | qa | dev | reviewer 👍 |
| 3.2 | Test implementation | guard.spec.ts | qa | dev | pnpm test green |
| 4.1 | Document | 02_claude-code.md | doc | review | remark-lint green |
| 4.2 | TOC modification | AGENTS.md etc. | doc | review | link-check green |
| 5.1 | Integration patch | strict_workflow.patch | dev | review | git apply --check OK |
| 5.2 | Demo PR | run log | qa | dev | Guard FAIL / PASS example attached |
| 6.0 | Overall review | review comments | review | All roles | Resolve complete |
| 7.0 | Merge & tag | Release v0.0.0-workflow | rel | review | CI green + SBOM |

Detailed tasks are listed in §2.

---

## 2 Phase → Step → Task definition

**Legend**
**Step** shows actual command examples with “`$`”.
**Exit Gate** must list Guard ID (see §3).

### FETCH
| Step | Task | Purpose | Procedure | Input | Output | Exit Gate |
|----------|--------|------|------|------|------|-----------|
| F-1 | Retrieval plan | List required URLs | Markdown table in `<think>` | Assignment text | doc-list.md | ― |
| F-2 | Retrieval execution | File DL & cache | `$ tools/fetch_doc.sh URL` | doc-list.md | .cache/... | G-DUP |
| F-3 | Commit | Add retrieved items | `apply_patch` | .cache | Git tree | diff is retrieved items only |

### INV
| Step | Task | Purpose | Procedure | Output | Exit Gate |
|----------|--------|------|------|------|----------|
| I-1 | Reproduce | Reproduce failure | `$ pnpm test` | fail-log | exit≠0 |
| I-2 | Minimal test | Create Red test | `apply_patch` | spec | spec Red |

### ANA ... *Same form as below, omitted*
(28 tasks are defined, from causal tree, impact scope, RFC draft, patch design, implementation, testing, coverage, to release)

The complete table is collapsed in `<details>...</details>`.

---

## 3 Guard Map

| Guard ID | Verification content | Corresponding task |
|----------|----------|------------|
| G-PHASE | Tag order, think token | All |
| G-NET | Non-FETCH URL? | All tasks |
| G-SIZE | LOC ≤1 000, files ≤10 | B-1 |
| G-EDGE | New test Green | B-2 |
| G-COV | Changed line coverage ≥90 % | V-1 |
| … | … | … |

---

## 4 Task template

```md
## BUILD / B-1 Code modification
Purpose: Change implementation according to patch-plan.md with minimum LOC
Input: patch-plan.md
Procedure: 1) apply_patch → 2) $ pnpm lint → 3) $ pnpm test
Output : src diff
Exit : LOC ≤ 1 000, files ≤ 10, G-SIZE ○, test green
```

---

## 5 Phase Diagram

```mermaid
flowchart LR
FETCH --> INV --> ANA --> PLAN --> BUILD --> VERIF --> REL
```

---

## 6 RACI list
Save the same content in `final_spec.md` as CSV.

---
