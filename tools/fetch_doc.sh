#!/usr/bin/env bash
# Safe fetch helper: caches every remote file inside repo history.
# Usage: tools/fetch_doc.sh <url> [output-name]

set -euo pipefail
url="$1"; shift
name="${1:-$(basename "$url")}"
mkdir -p .cache/fetch
hash=$(printf '%s' "$url" | sha256sum | cut -c1-8)
dest=".cache/fetch/${hash}_${name}"

if [[ -f "$dest" ]]; then
  echo "fetch_doc: cache hit -> $dest"
else
  echo "fetch_doc: downloading $url"
  curl -sSL "$url" -o "$dest"
  echo "fetch_doc: saved to $dest (remember to git add)"
fi

echo "$dest"