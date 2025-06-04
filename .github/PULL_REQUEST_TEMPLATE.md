# Checklist

## Phase Requirements
- [ ] Added phase label (e.g. `INV:`) to title
- [ ] Added the same label to PR
- [ ] `pnpm test` green
- [ ] Satisfied exit-gate
  - [ ] LOC ≤1 000 / files ≤10
  - [ ] Internet access is only available during the FETCH phase
  - [ ] No duplicate SHA (.cache/sha256.db)

## Development Completion (MANDATORY)
- [ ] Completed ALL items in CLAUDE.md Development Completion Checklist
- [ ] Documentation updated (README, API docs, CHANGELOG)
- [ ] Test coverage ≥90% for modified files
- [ ] All quality checks pass (`pnpm lint`, `pnpm tsc --noEmit`, `pnpm build`)
- [ ] Impact analysis documented
