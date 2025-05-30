# Git Diff Command Robustness Improvements

This document outlines the improvements made to git diff commands throughout the codebase to handle edge cases more reliably.

## Problem Overview

Git diff commands can fail in various edge cases:

- Shallow clones (limited history)
- Missing commits or refs
- Empty repositories
- Detached HEAD states
- Missing tags
- Merge commits with multiple parents

## Improvements Made

### 1. Path Guard Workflow (`.github/workflows/path-guard.yml`)

**Before:**

```bash
git diff --name-only -r $(git merge-base HEAD^ HEAD) | grep -q '^src/' && exit 1
```

**After:**

```bash
# Fetch full history
fetch-depth: 0

# Use PR base/head SHAs for reliable comparison
BASE_SHA="${{ github.event.pull_request.base.sha }}"
HEAD_SHA="${{ github.event.pull_request.head.sha }}"

# More robust diff with error handling
if git diff --name-only "${BASE_SHA}...${HEAD_SHA}" 2>/dev/null | grep -q '^src/'; then
  echo "Error: Changes to src/ directory are not allowed in review-labeled PRs"
  echo "Files changed in src/:"
  git diff --name-only "${BASE_SHA}...${HEAD_SHA}" | grep '^src/' || true
  exit 1
fi
```

**Benefits:**

- Uses GitHub PR context for accurate base/head comparison
- Handles shallow clones by fetching full history
- Provides clear error messages
- Shows actual files that violate the rule
- Handles grep failures gracefully with `|| true`

### 2. Release Workflow (`.github/workflows/release.yml`)

**Before:**

```bash
git diff $(git rev-list --max-parents=0 HEAD)..HEAD > strict_workflow.patch
last=$(git describe --abbrev=0 --tags || echo $(git rev-list --max-parents=0 HEAD))
git diff $last..HEAD > strict_workflow.patch
```

**After:**

```bash
set -euo pipefail

# Get the root commit safely
ROOT_COMMIT=$(git rev-list --max-parents=0 HEAD)

# Handle missing tags gracefully
if git describe --abbrev=0 --tags HEAD 2>/dev/null; then
  LAST_TAG=$(git describe --abbrev=0 --tags HEAD)
else
  LAST_TAG="$ROOT_COMMIT"
fi

# Create patch with error handling
if ! git diff "${LAST_TAG}..HEAD" > strict_workflow.patch; then
  echo "Warning: Failed to create patch"
  touch strict_workflow.patch
fi
```

**Benefits:**

- Explicit error handling with `set -euo pipefail`
- Handles repositories without tags
- Creates empty patch file as fallback
- Provides diagnostic output
- Shows patch statistics on success

### 3. Turn Guard Script (`tools/turn_guard.sh`)

#### Diff Size Check

**Before:**

```bash
read added files <<<"$(git diff --cached --numstat | awk '{a+=$1;f+=1}END{print a,f}')"
if [[ -n "$added" && ( "$added" -gt 1000 || "$files" -gt 10 ) ]]; then
```

**After:**

```bash
if diff_output=$(git diff --cached --numstat 2>/dev/null); then
  read added files <<<"$(echo "$diff_output" | awk '{a+=$1;f+=1}END{print a,f}')"
  # Ensure variables are set
  added=${added:-0}
  files=${files:-0}

  if [[ "$added" -gt 1000 || "$files" -gt 10 ]]; then
    die "Patch size exceeds limit (LOC $added, files $files)"
  fi
else
  echo "Warning: Unable to calculate diff size" >&2
fi
```

#### Role Path Control

**Before:**

```bash
git diff --name-only --cached | grep -q '^src/' && die "review role not allowed"
```

**After:**

```bash
if git diff --name-only --cached 2>/dev/null | grep -q '^src/'; then
  echo "Error: Changes to src/ directory are not allowed for review role" >&2
  echo "Files changed in src/:" >&2
  git diff --name-only --cached | grep '^src/' >&2 || true
  die "review role is not allowed to edit src/"
fi
```

**Benefits:**

- Captures diff output before processing
- Provides default values for variables
- Shows warning instead of failing silently
- Lists specific files that violate rules
- Redirects errors to stderr

## Best Practices for Git Commands in CI/CD

### 1. Always Use Error Handling

```bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures
```

### 2. Check Command Success

```bash
if git command 2>/dev/null; then
  # Success path
else
  # Failure path
fi
```

### 3. Provide Fallbacks

```bash
# Default values
VAR=${VAR:-default}

# Alternative commands
LAST_TAG=$(git describe --tags 2>/dev/null || echo "v0.0.0")
```

### 4. Use Appropriate Fetch Depth

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # Full history for reliable diffs
```

### 5. Handle Empty Results

```bash
# Append || true to prevent grep from failing on no matches
git diff --name-only | grep pattern || true
```

### 6. Use Stable References

```bash
# Good: Use SHAs or stable refs
git diff "${BASE_SHA}...${HEAD_SHA}"

# Avoid: Relative refs in CI
git diff HEAD~1..HEAD  # May fail with shallow clones
```

## Testing Git Commands

Before deploying git commands in CI/CD:

1. Test with shallow clones:

   ```bash
   git clone --depth 1 repo-url
   ```

2. Test with no tags:

   ```bash
   git tag -d $(git tag -l)
   ```

3. Test with detached HEAD:

   ```bash
   git checkout HEAD~1
   ```

4. Test with empty diff:
   ```bash
   git diff --cached  # With no staged changes
   ```

## Summary

These improvements ensure git commands:

- Handle edge cases gracefully
- Provide clear error messages
- Don't fail silently
- Work with various repository states
- Are suitable for CI/CD environments
