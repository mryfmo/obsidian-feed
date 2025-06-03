#!/usr/bin/env bash
# List all guards defined in the guard system

set -euo pipefail

# Check for MCP bridge availability
if [ -f ".claude/mcp-integration/bridge.ts" ] && command -v npx >/dev/null 2>&1; then
    # Try to use MCP bridge for enhanced guard listing
    if npx tsx .claude/mcp-integration/bridge.ts list_guards "$@" 2>/dev/null; then
        exit $?
    fi
    # Fall back to shell implementation if MCP fails
fi

echo "Guard System Overview"
echo "===================="
echo

# Extract guards from turn_guard.sh comments
echo "Guards implemented in turn_guard.sh:"
echo "-----------------------------------"
grep -o '^# ---------- [^(]*' tools/turn_guard.sh | sed 's/^# ---------- //' | tr ' ' '-' | sed 's/-$//' | grep -v '^$'

echo

# Extract G- prefixed guards from documentation
echo "Guards documented (G- prefix):"
echo "-----------------------------"
find docs/agents -name "*.md" -exec grep -hoE "G-[A-Z0-9-]+" {} \; | sort -u

echo

# Extract guards from test fixtures
echo "Guards in test fixtures:"
echo "-----------------------"
if [[ -f tests/spec.yml ]]; then
  awk -F, 'NR>1 {print $1}' tests/spec.yml | grep -E "^[A-Z]+-[0-9]+" | cut -d- -f1 | sort -u
fi

echo

# Summary
echo "Guard Exit Code Ranges:"
echo "----------------------"
echo "10-19: Structure Guards (tag order, tokens, phase, etc.)"
echo "20-29: Quality Guards (RFC, tests, lint, coverage, etc.)"
echo "30-39: Process Guards (approvals, WBS, risks, etc.)"
echo "40-49: Access Control Guards (roles, states, artifacts)"
echo "50+:   Reserved for future use"
echo

echo "Usage:"
echo "------"
echo "./tools/turn_guard.sh <file>     - Test individual file against guards"
echo "pnpm test tests/guard.spec.ts    - Run guard test suite"
echo "See docs/agents/02_claude-code.md for guard definitions"