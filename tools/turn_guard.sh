#!/usr/bin/env bash
# Claude Code turn-guard  :  fail-fast if a turn violates rules
#  - Checks: tag order, think token length, phase mismatch, net access,
#            diff size (LOC/files) when run inside CI.

set -euo pipefail

file="$1"                 # markdown turn file
phase_regex='^(FETCH|INV|ANA|PLAN|BUILD|VERIF|REL):'

# ---------- helper ----------
die() { echo "turn_guard: $*" >&2; exit 1; }
extract_tag() { grep -oP '^<\K[^>]+(?=>)' "$file"; }
extract_think() { awk '/<think>/{flag=1;next}/<\/think>/{flag=0}flag' "$file"; }

# ---------- tag order ----------
tags=$(extract_tag | tr '\n' ' ')
[[ "$tags" =~ ^think\ act\ verify\ next\  ]] \
  || die "Tag order invalid: $tags"

# ---------- phase label ----------
phase=$(grep -m1 -oP "$phase_regex" "$file" | sed 's/://')
[[ -n "$phase" ]] || die "Phase label missing"

# ---------- token length ----------
think_tokens=$(extract_think | wc -w)
(( think_tokens >= 20 && think_tokens <= 700 )) \
  || die "<think> tokens out of range ($think_tokens)"

# ---------- triage guard ----------
if grep -q '^FETCH' <<<"$phase"; then :; else
  if ! grep -q 'Assumed Goals:' "$file"; then
    die "G-TRIAGE: Assumed Goals section missing"
  fi
fi

# ---------- network access ----------
if grep -qP 'https?://' "$file"; then
  [[ "$phase" == "FETCH" ]] \
    || die "Network access only allowed in FETCH phase"
fi

# ---------- diff size (applies only when GIT_DIR present) ----------
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  read added files <<<"$(git diff --cached --numstat | awk '{a+=$1;f+=1}END{print a,f}')"
  if [[ -n "$added" && ( "$added" -gt 1000 || "$files" -gt 10 ) ]]; then
    die "Patch size exceeds limit (LOC $added, files $files)"
  fi
fi

# ---------- duplicate SHA256 check for FETCH files ----------
if [[ "$phase" == "FETCH" ]]; then
  db=".cache/sha256.db"
  sha=$(grep -oP '(?<=https://).*' "$file" | sha256sum | cut -c1-64)
  grep -q "$sha" "$db" 2>/dev/null && die "Duplicate download SHA detected"
  echo "$sha" >> "$db"
fi

# Duplicate SHA check (all URLs in turn)
if \[\[ "\$phase" == "FETCH" ]]; then
  db=".cache/sha256.db"
  grep -oP 'https?://\S+' "$file" | while read -r u; do
    sha=$(printf '%s' "$u" | sha256sum | cut -c1-64)
    grep -q "$sha" "$db" 2>/dev/null && die "Duplicate download SHA detected"
    echo "$sha" >> "$db"
  done
fi

# ---------- step-plan comment ----------
grep -q '# step-plan:' "$file" \
  || die "# step-plan: comment missing in <act>"

echo "turn_guard: OK"

# ---------- WBS Guard cross-check ----------
if [[ -f docs/spec/final_spec.md ]]; then
  missing=$(awk -F, 'NR>1 && $7!~"✅"{print $0}' docs/spec/final_spec.md | wc -l)
  (( missing==0 )) || die "G-WBS-OK: final_spec.md Unapproved $missing"
fi

# ---------- Role × Path Control ----------
role=${TURN_ROLE:-dev}
if [[ "$role" == "review" ]]; then
  git diff --name-only --cached | grep -q '^src/' && die "review role is not allowed to edit src/"
fi