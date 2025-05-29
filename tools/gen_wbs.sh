#!/bin/bash
# Generate Work Breakdown Structure with MCP fallback
set -e

# Try MCP bridge first if available
if [ -f ".mcp/bridge.ts" ] && command -v npx >/dev/null 2>&1; then
    if npx tsx .mcp/bridge.ts generate_wbs "$@" 2>/dev/null; then
        exit $?
    fi
fi

# Fallback to Python script
if [ $# -ne 1 ]; then
    echo "Usage: $0 <triage.md>"
    exit 1
fi

if [ ! -f "$1" ]; then
    echo "Error: File '$1' not found"
    exit 1
fi

# Use the existing Python script
python3 "$(dirname "$0")/gen_wbs.py" "$1"