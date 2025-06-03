#!/bin/bash
# create-task-backup.sh - Mandatory backup creation for task execution

set -euo pipefail

# Validate arguments
if [ $# -lt 1 ]; then
    echo "ERROR: Task ID required"
    echo "Usage: $0 <task-id> [files-to-backup...]"
    exit 1
fi

TASK_ID="$1"
shift
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=".claude/backups/task-${TASK_ID}-${TIMESTAMP}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Log backup start
echo "[$(date)] Starting backup for Task ${TASK_ID}" >> .claude/runtime/backup.log

# If specific files provided, backup those
if [ $# -gt 0 ]; then
    for file in "$@"; do
        if [ -e "$file" ]; then
            # Preserve directory structure
            DIR=$(dirname "$file")
            mkdir -p "$BACKUP_DIR/$DIR"
            cp -p "$file" "$BACKUP_DIR/$file"
            echo "Backed up: $file"
        else
            echo "WARNING: File not found: $file"
        fi
    done
else
    # Read backup list from task configuration
    BACKUP_LIST=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/backup-list.txt"
    if [ -f "$BACKUP_LIST" ]; then
        while IFS= read -r file; do
            if [ -e "$file" ]; then
                DIR=$(dirname "$file")
                mkdir -p "$BACKUP_DIR/$DIR"
                cp -p "$file" "$BACKUP_DIR/$file"
                echo "Backed up: $file"
            fi
        done < "$BACKUP_LIST"
    else
        echo "WARNING: No backup list found for task ${TASK_ID}"
    fi
fi

# Create backup manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "task_id": "${TASK_ID}",
  "timestamp": "${TIMESTAMP}",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "files_count": $(find "$BACKUP_DIR" -type f ! -name "manifest.json" | wc -l),
  "total_size": "$(du -sh "$BACKUP_DIR" | cut -f1)",
  "backup_location": "${BACKUP_DIR}"
}
EOF

# Calculate checksums
find "$BACKUP_DIR" -type f ! -name "checksums.md5" -exec md5sum {} \; > "$BACKUP_DIR/checksums.md5"

# Log completion
echo "[$(date)] Backup completed for Task ${TASK_ID} at ${BACKUP_DIR}" >> .claude/runtime/backup.log

# Return backup location for use in scripts
echo "$BACKUP_DIR"