#!/usr/bin/env bash
# Claude Code turn-guard  :  fail-fast if a turn violates rules
#  - Checks: tag order, think token length, phase mismatch, net access,
#            diff size (LOC/files) when run inside CI.

set -euo pipefail

# Check if MCP integration is available
if [ -f ".claude/mcp-integration/bridge.ts" ] && command -v npx >/dev/null 2>&1 && command -v tsx >/dev/null 2>&1; then
  # Debug mode for MCP integration
  if [[ "${DEBUG_MCP:-}" == "true" ]]; then
    echo "[DEBUG] MCP integration available, attempting to use it..." >&2
    echo "[DEBUG] Running: npx tsx .claude/mcp-integration/bridge.ts turn_guard $*" >&2
    if npx tsx .claude/mcp-integration/bridge.ts turn_guard "$@"; then
      echo "[DEBUG] MCP integration successful" >&2
      exit $?
    else
      mcp_exit=$?
      echo "[DEBUG] MCP integration failed with exit code: $mcp_exit" >&2
      echo "[DEBUG] Falling back to shell implementation" >&2
    fi
  else
    # Silent mode (current behavior)
    if npx tsx .claude/mcp-integration/bridge.ts turn_guard "$@" 2>/dev/null; then
      exit $?
    fi
  fi
  # Fall back to shell implementation if MCP fails
elif [[ "${DEBUG_MCP:-}" == "true" ]]; then
  echo "[DEBUG] MCP integration not available:" >&2
  [[ ! -f ".mcp/bridge.ts" ]] && echo "[DEBUG]   - .mcp/bridge.ts not found" >&2
  ! command -v npx >/dev/null 2>&1 && echo "[DEBUG]   - npx not found" >&2
  ! command -v tsx >/dev/null 2>&1 && echo "[DEBUG]   - tsx not found" >&2
  echo "[DEBUG] Using shell implementation" >&2
fi

# Input validation
if [ $# -ne 1 ]; then
  echo "Error: turn_guard.sh requires exactly one argument (markdown file path)" >&2
  echo "Usage: $0 <markdown-file>" >&2
  exit 1
fi

file="$1"                 # markdown turn file

# Check if file exists and is readable
if [ ! -f "$file" ]; then
  echo "Error: File '$file' does not exist" >&2
  exit 1
fi

if [ ! -r "$file" ]; then
  echo "Error: File '$file' is not readable" >&2
  exit 1
fi

phase_regex='(FETCH|INV|ANA|PLAN|BUILD|VERIF|REL):'

# ---------- helper ----------
# Define exit codes for different guard failures
G_TOKEN=11
G_LABEL=12
G_NET=13
G_DIFF=14
G_SHA=15
G_TRIAGE=16
G_PLAN=17
G_ROLE=18
G_WBS=19
G_ORDER=20

die() { 
  local code=$1
  shift
  echo "turn_guard: $*" >&2
  exit $code
}

extract_tag() { grep -o '^\s*<[^/>]*>' "$file" | sed 's/^\s*<//; s/>$//'; }
extract_think() { awk '/<think>/{flag=1;next}/<\/think>/{flag=0}flag' "$file"; }

# ---------- tag order ----------
# Check if tags exist and are in correct order (allow missing tags)
tags=$(extract_tag | tr '\n' ' ')
# Only check order if all required tags exist
if [[ "$tags" =~ think ]] && [[ "$tags" =~ act ]] && [[ "$tags" =~ verify ]] && [[ "$tags" =~ next ]]; then
  [[ "$tags" =~ ^think.*act.*verify.*next ]] \
    || die $G_ORDER "Tag order invalid: $tags"
fi

# ---------- phase label ----------
# Look for phase label anywhere in the file (including inside think)
phase=$(grep -m1 -E "$phase_regex" "$file" | grep -o '[A-Z]*:' | sed 's/:$//' || true)
[[ -n "$phase" ]] || die $G_LABEL "Phase label missing"

# ---------- token length ----------
# Check if think section exists first
if ! grep -q '<think>' "$file"; then
  die $G_TOKEN "<think> section missing"
fi

# Count words in think section, but exclude the phase label line if it's there
think_content=$(extract_think)
# Remove phase label line if present
think_content_clean=$(echo "$think_content" | grep -v -E "$phase_regex" || echo "$think_content")
# Trim whitespace and count words properly
think_tokens=$(echo "$think_content_clean" | tr -s ' \t\n' ' ' | wc -w | tr -d ' ')
(( think_tokens >= 20 && think_tokens <= 700 )) \
  || die $G_TOKEN "<think> tokens out of range ($think_tokens)"

# ---------- network access ----------
if grep -qE 'https?://' "$file"; then
  [[ "$phase" == "FETCH" ]] \
    || die $G_NET "Network access only allowed in FETCH phase"
fi

# ---------- triage guard ----------
if grep -q '^FETCH' <<<"$phase"; then :; else
  if ! grep -q 'Assumed Goals:' "$file"; then
    die $G_TRIAGE "G-TRIAGE: Assumed Goals section missing"
  fi
fi

# ---------- diff size (applies only when GIT_DIR present and in CI) ----------
if [[ -n "${CI:-}" ]] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # Use --cached for staged changes, with proper error handling
  if diff_output=$(git diff --cached --numstat 2>/dev/null); then
    read added files <<<"$(echo "$diff_output" | awk '{a+=$1;f+=1}END{print a,f}')"
    # Ensure variables are set (default to 0 if empty)
    added=${added:-0}
    files=${files:-0}
    
    if [[ "$added" -gt 1000 || "$files" -gt 10 ]]; then
      die $G_DIFF "Patch size exceeds limit (LOC $added, files $files)"
    fi
  else
    echo "Warning: Unable to calculate diff size" >&2
  fi
fi

# ---------- duplicate SHA256 check for FETCH files ----------
if [[ "$phase" == "FETCH" ]]; then
  db=".cache/sha256.db"
  mkdir -p "$(dirname "$db")"
  # Extract all URLs and check for duplicates based on content
  grep -oE 'https?://[^[:space:]]+' "$file" 2>/dev/null | while read -r u; do
    # Try to fetch content hash if possible (requires curl)
    if command -v curl >/dev/null 2>&1; then
      # Fetch first 1KB of content to generate hash (more efficient than full download)
      content_sample=$(curl -sL --max-time 5 --max-filesize 1024 "$u" 2>/dev/null | head -c 1024 || echo "")
      if [[ -n "$content_sample" ]]; then
        # Hash the content sample + URL for uniqueness
        sha=$(printf '%s\n%s' "$u" "$content_sample" | sha256sum | cut -c1-64)
      else
        # Fallback to URL hash if fetch fails
        sha=$(printf '%s' "$u" | sha256sum | cut -c1-64)
      fi
    else
      # Fallback to URL hash if curl not available
      sha=$(printf '%s' "$u" | sha256sum | cut -c1-64)
    fi
    
    # Check if this hash already exists
    if grep -q "^$sha " "$db" 2>/dev/null; then
      existing_url=$(grep "^$sha " "$db" | cut -d' ' -f2-)
      die $G_SHA "Duplicate content detected (URL: $u matches $existing_url)"
    fi
    
    # Store hash with URL for reference
    echo "$sha $u" >> "$db"
  done
fi

# ---------- step-plan comment ----------
if ! grep -q '# step-plan:' "$file"; then
  echo "Error: Missing '# step-plan:' comment in <act> section" >&2
  echo "The <act> section must contain a step-plan comment explaining the implementation approach" >&2
  die $G_PLAN "# step-plan: comment missing in <act>"
fi

# Define role variable
role=${TURN_ROLE:-dev}

echo "turn_guard: All checks passed ✓"
echo "  Phase: $phase"
echo "  Think tokens: $think_tokens"
if [[ -n "${CI:-}" ]]; then
  echo "  Added LOC: ${added:-0}"
  echo "  Modified files: ${files:-0}"
fi
echo "  Role: $role"

# ---------- WBS Guard cross-check ----------
# Check for WBS approval in the current workflow directory if in PLAN phase
if [[ "$phase" == "PLAN" ]] && [[ -n "${WORKFLOW_DIR:-}" ]]; then
  wbs_file="${WORKFLOW_DIR}/wbs-approval.json"
  if [[ -f "$wbs_file" ]]; then
    # Check if WBS is approved
    if ! grep -q '"approved":\s*true' "$wbs_file" 2>/dev/null; then
      die $G_WBS "G-WBS-OK: WBS not approved yet"
    fi
  fi
  # If no WBS file exists, that's okay - WBS is optional
fi

# ---------- Role × Path Control ----------
role=${TURN_ROLE:-dev}
if [[ "$role" == "review" ]]; then
  # More robust check for src/ changes with error handling
  if ! changed_files=$(git diff --name-only --cached 2>&1); then
    echo "Warning: Unable to check file changes (not in a git repository?)" >&2
  elif echo "$changed_files" | grep -q '^src/'; then
    echo "Error: Changes to src/ directory are not allowed for review role" >&2
    echo "Files changed in src/:" >&2
    echo "$changed_files" | grep '^src/' >&2
    die $G_ROLE "review role is not allowed to edit src/"
  fi
fi