<!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# 01 – Task-Lifecycle Checklist 🚦

> **Purpose** Provide a repeatable, auditable mini-SDLC that every agent – human
> or LLM – must follow for _each_ work item (issue, PR, CI failure, etc.). It
> prevents the two classic failure modes:
>
> 1. “Shoot-from-the-hip” fixes that skip design, spec or tests and later break.
> 2. Endless analysis loops that never reach an executable patch.

The process is deliberately lightweight (all steps can fit in a single PR), yet
forces explicit _state transitions_ so that omissions are caught early.

---

## State Machine

| State                      | Required Artefacts                                                                                                                                                                    | Exit Gate                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **INV**<br>(Investigation) | • Reproduction steps / failing test<br>• Logs, stack trace, screenshots                                                                                                               | Maintainer (or reporter) acknowledges reproduction is valid |
| **ANA**<br>(Analysis)      | • Root-cause description (1-2 para)<br>• Impacted files / modules list                                                                                                                | Reviewer agrees the analysis matches evidence               |
| **PLAN**                   | • RFC-style note (`docs/rfcs/NNN-*.md`) containing:<br> – Scope & out-of-scope<br> – Risk list & mitigations<br> – Test strategy (unit / int / e2e)<br> – Estimated effort & timeline | 1 reviewer 👍 or design-meeting approval                    |
| **BUILD**                  | • Code, docs, migration scripts, test fixtures                                                                                                                                        | CI ‑ lint + type-check + tests green                        |
| **VERIF**                  | • Test results attached<br>• Manual QA notes (if UI)<br>• CHANGELOG entry                                                                                                             | Reviewer & QA sign-off                                      |

After **VERIF** the task is considered _done_ and can be merged ➜ release train.

### Same flow in Claude Code sessions

When an agent works inside the sandboxed _Claude Code_ (without opening a GitHub
PR yet), the very same artefacts **must still be committed**:

1. Use `apply_patch` to create / update `docs/rfcs/NNN-*.md`, QA sheets, and
   checklists.
2. Update the Markdown checkboxes or add a `State-Transition:` footer **in
   every turn** so that reviewers (and the `stp-guard.yml` workflow) can audit
   the progression once the branch is eventually pushed.
3. Do **not** rely on the model’s “internal memory” – everything required by a
   human reviewer must live in the repository history.

> _Example turn (CLI):_
>
> 1. Run `pnpm lint` → capture output
> 2. `apply_patch` → append log snippet to `docs/qa/0012-eslint-tsdoc-baseline.md`
> 3. `apply_patch` → mark `[x] INV` in the RFC checklist
> 4. Return explanation → next state = **ANA**

> **Skip policy** Trivial chores (typo fixes, comment clarifications, version
> bumps) may collapse states _INV → BUILD → VERIF_ **only if** the change is
> < 5 lines and has no runtime effect.

## How Agents Mark Progress

Each state transition must appear in either:

- The PR comment thread, using markdown checkboxes, e.g.
  ```
  - [x] INV bug reproduced with failing unit test
  - [x] ANA null pointer due to empty array path in `networkService`
  - [ ] PLAN
  ```
- Or the commit message footer (for auto-generated commits inside Claude Code):
  ```
  Co-Authored-By: dev-agent
  State-Transition: ANA→PLAN
  ```

CI validates STP markers by checking:

- PR body for checklists or state transitions
- **All commits** in the PR (not just the latest)
- Changed documentation files for checklist updates

See [`stp-validation-guide.md`](./stp-validation-guide.md) for detailed validation rules.

## Reviewers’ Quick Guide

1. Validate that artefacts are present & meaningful – _not_ boilerplate.
2. Confirm exit-gate criteria are met before you check the box.
3. If the change balloons in scope mid-way, revert to **ANA** and redo PLAN; do
   **not** patch ad-hoc.

## File Locations & Naming

| Artefact   | Path                    | Convention                              |
| ---------- | ----------------------- | --------------------------------------- |
| RFC / PLAN | `docs/rfcs/NNN-slug.md` | Incremental integer id; slug = kebab    |
| QA Sheet   | `docs/qa/NNN-slug.md`   | Templated headings (env, steps, result) |

The indirection keeps the root tidy and lets GitHub render diffs nicely.

---

_This document itself is MIT-licensed so you can copy-paste it into other
projects._
