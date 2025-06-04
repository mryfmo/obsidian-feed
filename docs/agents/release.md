<\!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Release Agent (`rel`)

The **Release Agent** orchestrates version bumps and publishes plugin binaries to GitHub releases plus the Obsidian BRAT feed.

## 1. Trigger

Runs after a PR labelled `ready-for-release` is merged into `main` **and** CI is fully green.

## 2. Steps

1. **Determine Next Version**  
   • inspect commit messages since last tag (Conventional Commits).  
   • bump _patch_ for `fix`, _minor_ for `feat`, _major_ if `BREAKING CHANGE` footer present.
2. **Update Files**
   - `package.json`
   - `manifest.json` (Obsidian manifest)
   - `versions.json` (BRAT)
   - heading in `CHANGELOG.md` → move _[Unreleased]_ under the new version.
3. **Build**  
   `pnpm build` → produces zipped `contents-feeds-reader-vX.Y.Z.zip`.
4. **Git & GitHub**
   - Commit with `chore(release): vX.Y.Z`.
   - Create annotated tag `vX.Y.Z`.
   - Draft GitHub Release with changelog body; attach the zip.

## 3. Safety Nets

- Abort if working tree dirty.
- Abort if tests or lint fail.
- Abort if `CHANGELOG.md` still contains `[Unreleased]` section.

## 4. Termination

Stop after the GitHub Release is published and BRAT manifest receives the new commit SHA.

## 5. Mandatory Pre-Release Verification

**CRITICAL**: Before creating ANY release, the release agent MUST verify completion of the CLAUDE.md Development Completion Checklist:

### Required Verifications:
1. **Documentation Complete**
   - README.md updated for new features/changes
   - API documentation reflects all changes
   - CHANGELOG.md has detailed release notes
   - Migration guide for breaking changes

2. **Quality Standards Met**
   - All tests pass (`pnpm test`)
   - Test coverage ≥90% for modified files
   - Lint checks pass (`pnpm lint`)
   - Build succeeds (`pnpm build`)
   - No console.log or debug code

3. **Release Readiness**
   - Version numbers consistent across all files
   - No uncommitted changes
   - CI pipeline is green
   - E2E tests confirm no regressions

### Pre-Release Commands:
```bash
# Verify all quality checks
pnpm check:all

# Verify clean working tree
git status --porcelain

# Check for debug code
grep -r "console.log" src/
```

**IMPORTANT**: If ANY checklist item is incomplete, ABORT the release and report what needs to be completed.
