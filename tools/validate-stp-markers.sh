#!/usr/bin/env bash
# Validate STP (Standard Task Protocol) markers across PR body, commits, and files
# Can be used in CI/CD or locally

set -euo pipefail

# Check for MCP bridge availability
if [ -f ".mcp/bridge.ts" ] && command -v npx >/dev/null 2>&1; then
    # Try to use MCP bridge for enhanced validation
    if npx tsx .mcp/bridge.ts validate_stp "$@" 2>/dev/null; then
        exit $?
    fi
    # Fall back to shell implementation if MCP fails
fi

# Colors for output (disabled in CI)
if [[ -t 1 ]] && [[ -z "${CI:-}" ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Configuration
STP_PHASES=(FETCH INV ANA PLAN BUILD VERIF REL)
STP_PHASE_PATTERN=$(IFS='|'; echo "${STP_PHASES[*]}")

# Patterns to search for
PATTERNS=(
  'State-Transition:\s*[A-Z]+\s*[→→]\s*[A-Z]+'
  '^\s*-\s*\[[xX]\]\s*('$STP_PHASE_PATTERN')\b'
  '\b('$STP_PHASE_PATTERN')\s*[✓✅☑]'
  'State:\s*('$STP_PHASE_PATTERN')'
)

# Helper functions
log() {
  echo -e "$1" >&2
}

success() {
  log "${GREEN}✅ $1${NC}"
}

warning() {
  log "${YELLOW}⚠️  $1${NC}"
}

error() {
  log "${RED}❌ $1${NC}"
}

info() {
  log "${BLUE}ℹ️  $1${NC}"
}

# Check if pattern exists in text
check_patterns() {
  local text="$1"
  local description="$2"
  
  for pattern in "${PATTERNS[@]}"; do
    if echo "$text" | grep -Eq "$pattern"; then
      success "Found STP marker in $description"
      echo "$text" | grep -E "$pattern" | head -3 | sed 's/^/    /'
      return 0
    fi
  done
  
  return 1
}

# Main validation function
validate_stp() {
  local pr_body="${1:-}"
  local base_ref="${2:-origin/main}"
  local head_ref="${3:-HEAD}"
  
  log "🔍 Validating STP markers..."
  log ""
  
  local found_markers=()
  local validation_passed=false
  
  # 1. Check PR body (if provided)
  if [[ -n "$pr_body" ]]; then
    info "Checking PR body..."
    if check_patterns "$pr_body" "PR body"; then
      found_markers+=("PR body")
    else
      warning "No STP marker found in PR body"
    fi
    log ""
  fi
  
  # 2. Check all commits
  info "Checking commit messages..."
  
  # Get commit range
  local commits
  if git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
    commits=$(git rev-list "$base_ref..$head_ref" 2>/dev/null || echo "")
  else
    # Fallback for shallow clones or missing base
    commits=$(git rev-list --max-count=50 "$head_ref" 2>/dev/null || echo "")
  fi
  
  if [[ -z "$commits" ]]; then
    warning "No commits found to check"
  else
    local commit_count=$(echo "$commits" | wc -l | tr -d ' ')
    log "  Checking $commit_count commits..."
    
    local found_in_commit=false
    while IFS= read -r commit; do
      [[ -z "$commit" ]] && continue
      
      local commit_msg=$(git show -s --pretty=%B "$commit" 2>/dev/null || echo "")
      local short_sha=$(echo "$commit" | cut -c1-8)
      
      if check_patterns "$commit_msg" "commit $short_sha" >/dev/null 2>&1; then
        found_in_commit=true
        log "    ${GREEN}✓${NC} $short_sha - $(git show -s --pretty=%s "$commit" | head -c 50)"
      else
        log "    · $short_sha - $(git show -s --pretty=%s "$commit" | head -c 50)"
      fi
    done <<< "$commits"
    
    if [[ "$found_in_commit" == "true" ]]; then
      success "Found STP markers in commits"
      found_markers+=("commits")
    else
      warning "No STP markers found in commits"
    fi
  fi
  log ""
  
  # 3. Check changed files for checklist updates
  info "Checking changed files..."
  
  # Patterns for file content
  local file_patterns=(
    'docs/rfcs/*.md'
    'docs/qa/*.md'
    '.github/*.md'
  )
  
  local found_in_files=false
  for pattern in "${file_patterns[@]}"; do
    local diff_output
    if git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
      diff_output=$(git diff "$base_ref...$head_ref" -- "$pattern" 2>/dev/null || echo "")
    else
      diff_output=$(git diff --cached -- "$pattern" 2>/dev/null || echo "")
    fi
    
    if [[ -n "$diff_output" ]]; then
      # Look for added checklist items
      if echo "$diff_output" | grep -E '^\+.*\[[xX]\].*\b('$STP_PHASE_PATTERN')\b' >/dev/null 2>&1; then
        found_in_files=true
        success "Found checklist updates in $pattern"
        echo "$diff_output" | grep -E '^\+.*\[[xX]\].*\b('$STP_PHASE_PATTERN')\b' | head -3 | sed 's/^+/    + /'
      fi
    fi
  done
  
  if [[ "$found_in_files" == "true" ]]; then
    found_markers+=("changed files")
  else
    warning "No checklist updates found in documentation files"
  fi
  log ""
  
  # 4. Summary and final validation
  info "Summary:"
  if [[ ${#found_markers[@]} -gt 0 ]]; then
    success "STP markers found in: ${found_markers[*]}"
    validation_passed=true
  else
    error "No STP markers found anywhere!"
  fi
  log ""
  
  # Provide guidance if validation failed
  if [[ "$validation_passed" != "true" ]]; then
    error "STP validation failed!"
    log ""
    log "Please add STP markers using one of these methods:"
    log ""
    log "1. Add to PR description:"
    log "   - [x] INV: Investigation complete"
    log "   - [x] ANA: Root cause identified"
    log "   - [ ] PLAN: Design RFC created"
    log ""
    log "2. Add to commit message:"
    log "   git commit -m 'Fix issue #123"
    log "   "
    log "   State-Transition: INV→ANA'"
    log ""
    log "3. Update checklist in docs/rfcs/NNN-*.md or docs/qa/NNN-*.md"
    log ""
    log "See docs/agents/01_task-lifecycle.md for details."
    return 1
  fi
  
  return 0
}

# Main entry point
main() {
  case "${1:-}" in
    --help|-h)
      cat <<EOF
Usage: $0 [PR_BODY] [BASE_REF] [HEAD_REF]

Validate STP (Standard Task Protocol) markers in:
  - PR body (if provided)
  - Commit messages
  - Changed documentation files

Arguments:
  PR_BODY   - Pull request description text (optional)
  BASE_REF  - Base git reference (default: origin/main)
  HEAD_REF  - Head git reference (default: HEAD)

Environment variables:
  CI        - Set to disable colored output

Examples:
  # Check current branch against main
  $0

  # Check with PR body
  $0 "PR description with - [x] INV complete"

  # Check specific range
  $0 "" feature-branch main

Exit codes:
  0 - Validation passed
  1 - Validation failed
  2 - Usage error
EOF
      exit 0
      ;;
  esac
  
  # Run validation
  validate_stp "$@"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi