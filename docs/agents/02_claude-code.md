<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# docs/agents/02_claude-code.md

# 02 – Claude Code Workflow & Guardrails ⚙️🤖

**Purpose** — **Complete workflow + guardrail definition** for Claude Code to autonomously execute "requirements → implementation → test → release" without runaway in multiple roles (dev / review / qa / rel ...).
_Applicable to: Claude Code CLI and Claude Code Action (GitHub integration)_

---

## 0 Scope 🗺️

- 7 phases **FETCH → INV → ANA → PLAN → BUILD → VERIF → REL**
- Each phase is decomposed into **steps → tasks** and always has **purpose / procedure / input / output / exit gate**.
- Deviations are forcibly eliminated by `.claude/validation/turn-guard.sh` + CI.

---

## 1 WBS + RACI + Exit Gate Overview

| WBS | Process              | Deliverables               | R (Responsible) | A/C/I      | Exit Gate                          |
| --- | -------------------- | -------------------------- | --------------- | ---------- | ---------------------------------- |
| 1.1 | Requirement review   | gaps.md                    | dev             | review     | gaps.md approval (review)          |
| 1.2 | Specification design | specification.md           | dev             | review     | RFC format 👍                      |
| 1.3 | Archi agreement      | final_spec.md              | review          | dev/qa/rel | All roles OK mark                  |
| 2.1 | Guard design         | guard.md                   | dev             | review     | mermaid diagram review             |
| 2.2 | Guard implementation | .claude/validation/turn-guard.sh        | dev             | qa         | shellcheck + unit green            |
| 2.3 | fetch implementation | .claude/validation/fetch-doc.sh         | dev             | qa         | Same as above                      |
| 2.4 | CI implementation    | claude.yml, label-sync.yml | dev             | qa         | GH Action green                    |
| 3.1 | Test design          | tests/spec.yml             | qa              | dev        | reviewer 👍                        |
| 3.2 | Test implementation  | guard.spec.ts              | qa              | dev        | pnpm test green                    |
| 4.1 | Document             | 02_claude-code.md          | doc             | review     | remark-lint green                  |
| 4.2 | TOC modification     | AGENTS.md etc.             | doc             | review     | link-check green                   |
| 5.1 | Integration patch    | strict_workflow.patch      | dev             | review     | git apply --check OK               |
| 5.2 | Demo PR              | run log                    | qa              | dev        | Guard FAIL / PASS example attached |
| 6.0 | Overall review       | review comments            | review          | All roles  | Resolve complete                   |
| 7.0 | Merge & tag          | Release v0.0.0-workflow    | rel             | review     | CI green + SBOM                    |

Detailed tasks are listed in §2.

---

## 2 Phase → Step → Task definition

**Legend**
**Step** shows actual command examples with “`$`”.
**Exit Gate** must list Guard ID (see §3).

### FETCH

| Step | Task                | Purpose             | Procedure                   | Input           | Output      | Exit Gate                    |
| ---- | ------------------- | ------------------- | --------------------------- | --------------- | ----------- | ---------------------------- |
| F-1  | Retrieval plan      | List required URLs  | Markdown table in `<think>` | Assignment text | doc-list.md | ―                            |
| F-2  | Retrieval execution | File DL & cache     | `$ .claude/validation/fetch-doc.sh URL`  | doc-list.md     | .cache/...  | G-DUP                        |
| F-3  | Commit              | Add retrieved items | `apply_patch`               | .cache          | Git tree    | diff is retrieved items only |

### INV

| Step | Task         | Purpose           | Procedure     | Output   | Exit Gate |
| ---- | ------------ | ----------------- | ------------- | -------- | --------- |
| I-1  | Reproduce    | Reproduce failure | `$ pnpm test` | fail-log | exit≠0    |
| I-2  | Minimal test | Create Red test   | `apply_patch` | spec     | spec Red  |

### Complete Task Definitions

The remaining tasks follow the same tabular format. All 28 tasks are defined across the 7 phases:

- FETCH: 3 tasks (F-1 to F-3)
- INV: 3 tasks (I-1 to I-3)
- ANA: 4 tasks (A-1 to A-4)
- PLAN: 4 tasks (P-1 to P-4)
- BUILD: 6 tasks (B-1 to B-6)
- VERIF: 5 tasks (V-1 to V-5)
- REL: 3 tasks (R-1 to R-3)

**Complete task definitions are included in the sections below.**

<details>
<summary>View task summary</summary>

| Phase     | Tasks                                                                                | Key Deliverables                             |
| --------- | ------------------------------------------------------------------------------------ | -------------------------------------------- |
| **ANA**   | Causal tree, Impact scope, Risk assessment, Commit analysis                          | cause-tree.md, impact.md, risks.md           |
| **PLAN**  | RFC draft, Test strategy, Patch design, Review checkpoint                            | rfc-draft.md, test-plan.md, patch-plan.md    |
| **BUILD** | Code modification, Unit tests, Lint & format, Type check, Integration, Documentation | src/ diff, test/ diff, docs/ diff            |
| **VERIF** | Coverage check, Manual QA, Performance, Security scan, Changelog                     | coverage.html, qa-results.md, CHANGELOG diff |
| **REL**   | Version bump, Release notes, Tag & publish                                           | package.json, RELEASE.md, Git tag            |

</details>

---

## 3 Guard Map

Guards are automated checks that enforce workflow rules and quality standards. The table below shows key examples:

| Guard ID | Verification content        | Corresponding task |
| -------- | --------------------------- | ------------------ |
| G-PHASE  | Tag order, think token      | All                |
| G-NET    | Non-FETCH URL?              | All tasks          |
| G-SIZE   | LOC ≤1 000, files ≤10       | B-1                |
| G-EDGE   | New test Green              | B-2                |
| G-COV    | Changed line coverage ≥90 % | V-1                |

**Complete guard definitions are included in the guard map section below.**

The guards are categorized as:

- **Structure Guards** (G-PHASE, G-TOKEN, G-LABEL, etc.) - Enforce workflow structure
- **Quality Guards** (G-RFC, G-TEST, G-LINT, etc.) - Ensure code quality
- **Process Guards** (G-USER-OK, G-WBS-OK, etc.) - Validate approvals
- **Access Control Guards** (G-ROLE, G-STATE, etc.) - Enforce permissions

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

**For complete phase transition validation and dependency enforcement, see: [`phase-transition-validation.md`](./phase-transition-validation.md)**

Key improvements:

- Explicit phase dependencies with completion artifacts
- Enhanced security validation for FETCH phase
- Flexible BUILD constraints with exception handling
- REL phase requires VERIF completion certificate

---

## 6 RACI list

Save the same content in `final_spec.md` as CSV.

---
