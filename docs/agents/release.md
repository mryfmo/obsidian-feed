# Release Agent (`rel`)

The **Release Agent** orchestrates version bumps and publishes plugin binaries to GitHub releases plus the Obsidian BRAT feed.

## 1. Trigger

Runs after a PR labelled `ready-for-release` is merged into `main` **and** CI is fully green.

## 2. Steps

1. **Determine Next Version**  
   • inspect commit messages since last tag (Conventional Commits).  
   • bump *patch* for `fix`, *minor* for `feat`, *major* if `BREAKING CHANGE` footer present.
2. **Update Files**  
   * `package.json`  
   * `manifest.json` (Obsidian manifest)  
   * `versions.json` (BRAT)  
   * heading in `CHANGELOG.md` → move *[Unreleased]* under the new version.
3. **Build**  
   `pnpm build` → produces zipped `contents-feeds-reader-vX.Y.Z.zip`.
4. **Git & GitHub**  
   * Commit with `chore(release): vX.Y.Z`.  
   * Create annotated tag `vX.Y.Z`.  
   * Draft GitHub Release with changelog body; attach the zip.

## 3. Safety Nets

* Abort if working tree dirty.
* Abort if tests or lint fail.
* Abort if `CHANGELOG.md` still contains `[Unreleased]` section.

## 4. Termination

Stop after the GitHub Release is published and BRAT manifest receives the new commit SHA.
