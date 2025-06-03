#!/usr/bin/env bash
# Safe fetch helper: caches every remote file inside repo history.
# Usage: tools/fetch_doc.sh <url_or_path> [output-name]

set -euo pipefail

# Check if MCP integration is available
if [ -f ".claude/mcp-integration/bridge.ts" ] && command -v npx >/dev/null 2>&1; then
  # Try to use MCP integration
  if npx tsx .claude/mcp-integration/bridge.ts fetch_doc "$@" 2>/dev/null; then
    exit $?
  fi
  # Fall back to shell implementation if MCP fails
fi

source="$1"; shift
name="${1:-$(basename "$source")}"

# Check if source is a local file or URL
if [[ "$source" =~ ^https?:// ]]; then
  # Handle URL
  mkdir -p .cache/fetch
  hash=$(printf '%s' "$source" | sha256sum | cut -c1-8)
  dest=".cache/fetch/${hash}_${name}"
  
  if [[ -f "$dest" ]]; then
    echo "fetch_doc: cache hit -> $dest"
  else
    echo "fetch_doc: downloading $source"
    curl -sSL "$source" -o "$dest"
    echo "fetch_doc: saved to $dest (remember to git add)"
  fi
else
  # Handle local file
  if [[ ! -f "$source" ]]; then
    echo "fetch_doc: error - file not found: $source" >&2
    exit 1
  fi
  
  # If output name is different from source, copy the file
  if [[ "$name" != "$source" ]]; then
    dest="$name"
    cp "$source" "$dest"
    echo "fetch_doc: copied $source to $dest"
  else
    # Just return the source path
    dest="$source"
    echo "fetch_doc: using local file $dest"
  fi
fi

echo "$dest"