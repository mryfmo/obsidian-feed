#!/usr/bin/env bash
# Claude Code turn-guard  :  fail-fast if a turn violates rules
#  - Checks: tag order, think token length, phase mismatch, net access,
#            diff size (LOC/files) when run inside CI.

set -euo pipefail

# Check if MCP integration is available
if [ -f ".mcp/bridge.ts" ] && command -v npx >/dev/null 2>&1; then
  # Try to use MCP integration
  if npx tsx .mcp/bridge.ts turn_guard "$@" 2>/dev/null; then
    exit $?
  fi
  # Fall back to shell implementation if MCP fails
fi

file="$1"                 # markdown turn file
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
  # Extract all URLs and check for duplicates
  grep -oE 'https?://[^[:space:]]+' "$file" 2>/dev/null | while read -r u; do
    sha=$(printf '%s' "$u" | sha256sum | cut -c1-64)
    grep -q "$sha" "$db" 2>/dev/null && die $G_SHA "Duplicate download SHA detected"
    echo "$sha" >> "$db"
  done || true  # Don't fail if no URLs found
fi

# ---------- step-plan comment ----------
grep -q '# step-plan:' "$file" \
  || die $G_PLAN "# step-plan: comment missing in <act>"

echo "turn_guard: OK"

# ---------- WBS Guard cross-check ----------
if [[ -f docs/spec/final_spec.md ]]; then
  missing=$(awk -F, 'NR>1 && $7!~"✅"{print $0}' docs/spec/final_spec.md | wc -l)
  (( missing==0 )) || die $G_WBS "G-WBS-OK: final_spec.md Unapproved $missing"
fi

# ---------- Role × Path Control ----------
role=${TURN_ROLE:-dev}
if [[ "$role" == "review" ]]; then
  # More robust check for src/ changes with error handling
  if git diff --name-only --cached 2>/dev/null | grep -q '^src/'; then
    echo "Error: Changes to src/ directory are not allowed for review role" >&2
    echo "Files changed in src/:" >&2
    git diff --name-only --cached | grep '^src/' >&2 || true
    die $G_ROLE "review role is not allowed to edit src/"
  fi
fi