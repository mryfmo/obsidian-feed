<\!--
This documentation is licensed under the MIT License.
See LICENSE-MIT for details.
-->

# Documentation Agent (`doc`)

The **Documentation Agent** ensures that code-level and user-facing documentation stays current.

## 1. Scope

- `README.md`, `CHANGELOG.md`, `TODO.md`, `AGENTS.md`, this folder.
- In-code JSDoc / TSDoc comments.
- Help overlays and modal text inside `/src/helpModal.ts`.

## 2. Style Guide

- Prefer active voice & short sentences.
- Capitalise UI labels exactly as they appear on screen.
- Use Markdown tables and collapsible blocks (`<details>`) to keep docs tidy.
- English first; add Japanese translation blocks when required.

## 3. Acceptance Criteria

- No broken links (`npm run markdown-link-check`).
- Outdated feature flags removed.
- Screenshots ≤ 100 KB, stored under `docs/images/`.

## 4. Release Notes Skeleton

```
### Added
- …

### Changed
- …

### Fixed
- …

### Removed
- …
```

## 5. Termination

Yield after the updated docs render correctly in GitHub preview and pass `pnpm lint` (markdown plugin).
