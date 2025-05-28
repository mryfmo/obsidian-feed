#!/usr/bin/env bash
# Enhanced fetch_doc.sh with security validation
# This is a reference implementation showing security enhancements

set -euo pipefail

# Configuration
MAX_SIZE=10485760  # 10MB
TIMEOUT=30
USER_AGENT="Claude-Code-Fetcher/1.0"
CACHE_DIR=".cache"

# Blocklisted domains (example)
BLOCKLIST=(
  "malicious.com"
  "phishing.site"
  "spam.domain"
)

# Helper functions
die() {
  echo "fetch_doc: ERROR: $*" >&2
  exit 1
}

log() {
  echo "fetch_doc: $*" >&2
}

# URL validation
validate_url() {
  local url="$1"
  
  # Protocol check
  if ! [[ "$url" =~ ^https?:// ]]; then
    die "Only HTTP(S) protocols allowed: $url"
  fi
  
  # Extract domain
  local domain=$(echo "$url" | sed -E 's|https?://([^/]+).*|\1|')
  
  # Blocklist check
  for blocked in "${BLOCKLIST[@]}"; do
    if [[ "$domain" == *"$blocked"* ]]; then
      die "URL blocked - suspicious domain: $domain"
    fi
  done
  
  # Basic URL format validation
  if ! curl --head --silent --fail --location --max-time 5 "$url" >/dev/null 2>&1; then
    die "URL validation failed - cannot reach: $url"
  fi
  
  log "URL validated: $url"
}

# Content validation
validate_content() {
  local url="$1"
  
  # Get headers
  local headers=$(curl -sI -L --max-time 10 "$url")
  
  # Size check
  local size=$(echo "$headers" | grep -i "content-length:" | tail -1 | awk '{print $2}' | tr -d '\r')
  if [[ -n "$size" && "$size" -gt "$MAX_SIZE" ]]; then
    die "File too large: $size bytes (max: $MAX_SIZE)"
  fi
  
  # Content-Type check
  local content_type=$(echo "$headers" | grep -i "content-type:" | tail -1)
  
  # Block dangerous content types
  if echo "$content_type" | grep -qiE "(application/x-executable|application/x-mach-binary|application/x-msdownload)"; then
    die "Blocked content type: $content_type"
  fi
  
  # Warn about binary content
  if echo "$content_type" | grep -qiE "(application/octet-stream|application/zip|application/x-tar)"; then
    log "WARNING: Binary content detected: $content_type"
  fi
  
  log "Content validated: ${content_type:-unknown}"
}

# SHA256 duplicate check
check_duplicate() {
  local url="$1"
  local sha_db="$CACHE_DIR/sha256.db"
  
  # Create cache directory if needed
  mkdir -p "$CACHE_DIR"
  
  # Calculate SHA256 of URL
  local sha=$(echo -n "$url" | sha256sum | cut -d' ' -f1)
  
  # Check for duplicate
  if [[ -f "$sha_db" ]] && grep -q "^$sha " "$sha_db"; then
    local cached_file=$(grep "^$sha " "$sha_db" | cut -d' ' -f2-)
    log "Duplicate detected - using cached: $cached_file"
    echo "$cached_file"
    return 0
  fi
  
  return 1
}

# Save SHA256 record
save_sha_record() {
  local url="$1"
  local file="$2"
  local sha_db="$CACHE_DIR/sha256.db"
  
  local sha=$(echo -n "$url" | sha256sum | cut -d' ' -f1)
  echo "$sha $file" >> "$sha_db"
}

# Main fetch function
fetch_doc() {
  local url="$1"
  local output_file="${2:-}"
  
  # Validation
  validate_url "$url"
  validate_content "$url"
  
  # Check for cached version
  if cached_file=$(check_duplicate "$url"); then
    if [[ -n "$output_file" ]]; then
      cp "$cached_file" "$output_file"
    fi
    echo "$cached_file"
    return 0
  fi
  
  # Determine output filename
  if [[ -z "$output_file" ]]; then
    # Extract filename from URL or generate one
    local filename=$(basename "$url" | sed 's/[?#].*//')
    if [[ -z "$filename" || "$filename" == "/" ]]; then
      filename="download_$(date +%s)"
    fi
    output_file="$CACHE_DIR/$filename"
  fi
  
  # Create cache directory
  mkdir -p "$(dirname "$output_file")"
  
  # Download with security constraints
  log "Downloading: $url -> $output_file"
  
  if ! curl -L \
    --silent \
    --show-error \
    --fail \
    --max-time "$TIMEOUT" \
    --max-filesize "$MAX_SIZE" \
    --user-agent "$USER_AGENT" \
    --output "$output_file" \
    "$url"; then
    rm -f "$output_file"
    die "Download failed: $url"
  fi
  
  # Verify downloaded file
  if [[ ! -f "$output_file" ]]; then
    die "Download produced no file: $url"
  fi
  
  # Check file size
  local file_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)
  if [[ "$file_size" -gt "$MAX_SIZE" ]]; then
    rm -f "$output_file"
    die "Downloaded file exceeds size limit: $file_size bytes"
  fi
  
  # Save SHA record
  save_sha_record "$url" "$output_file"
  
  log "Download complete: $output_file ($file_size bytes)"
  echo "$output_file"
}

# Main entry point
main() {
  if [[ $# -eq 0 ]]; then
    cat <<EOF
Usage: $0 <url> [output_file]

Enhanced document fetcher with security validation.

Features:
  - URL validation and blocklist checking
  - Content-type filtering
  - Size limits (max ${MAX_SIZE} bytes)
  - SHA256 duplicate detection
  - Timeout protection (${TIMEOUT}s)

Examples:
  $0 https://example.com/doc.pdf
  $0 https://example.com/data.json output.json

EOF
    exit 1
  fi
  
  fetch_doc "$@"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi