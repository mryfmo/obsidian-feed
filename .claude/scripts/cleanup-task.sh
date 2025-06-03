#!/bin/bash
# cleanup-task.sh - Mandatory cleanup after task completion

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "ERROR: Task ID required"
    echo "Usage: $0 <task-id>"
    exit 1
fi

TASK_ID="$1"
CLEANUP_LIST=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/cleanup-list.txt"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CLEANUP_LOG=".claude/runtime/cleanup.log"

echo "=================================================================================="
echo "                           TASK CLEANUP PROCESS"
echo "=================================================================================="
echo "Task ID: ${TASK_ID}"
echo "Timestamp: $(date)"
echo

# Track cleanup statistics
FILES_REMOVED=0
DIRS_REMOVED=0
SPACE_FREED=0

# Clean up temporary files
echo "Cleaning temporary files..."

# Standard temporary file patterns
TEMP_PATTERNS=(
    "/tmp/task-${TASK_ID}-*"
    "/var/tmp/task-${TASK_ID}-*"
    ".claude/workspace/tmp/task-${TASK_ID}*"
)

for pattern in "${TEMP_PATTERNS[@]}"; do
    for file in $pattern; do
        if [ -e "$file" ]; then
            SIZE=$(du -sh "$file" 2>/dev/null | cut -f1 || echo "0")
            rm -rf "$file"
            echo "✓ Removed: $file (${SIZE})"
            ((FILES_REMOVED++))
        fi
    done
done

# Process cleanup list if exists
if [ -f "$CLEANUP_LIST" ]; then
    echo
    echo "Processing cleanup list..."
    while IFS= read -r target; do
        # Skip empty lines and comments
        [[ -z "$target" || "$target" =~ ^# ]] && continue
        
        if [ -e "$target" ]; then
            SIZE=$(du -sh "$target" 2>/dev/null | cut -f1 || echo "0")
            
            # Safety check - don't delete critical files
            if [[ "$target" =~ \.(md|json|yml|yaml|ts|js|sh)$ ]] && [[ ! "$target" =~ /tmp/ ]]; then
                echo "⚠ Skipping protected file: $target"
                continue
            fi
            
            if [ -d "$target" ]; then
                rm -rf "$target"
                echo "✓ Removed directory: $target (${SIZE})"
                ((DIRS_REMOVED++))
            else
                rm -f "$target"
                echo "✓ Removed file: $target (${SIZE})"
                ((FILES_REMOVED++))
            fi
        fi
    done < "$CLEANUP_LIST"
else
    echo "No cleanup list found for task ${TASK_ID}"
fi

# Archive task workspace if needed
TASK_WORKSPACE=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/workspace"
if [ -d "$TASK_WORKSPACE" ]; then
    echo
    echo "Archiving task workspace..."
    ARCHIVE_DIR=".claude/workspace/projects/strict-rules-integration/archive"
    mkdir -p "$ARCHIVE_DIR"
    
    ARCHIVE_FILE="$ARCHIVE_DIR/task-${TASK_ID}-${TIMESTAMP}.tar.gz"
    tar -czf "$ARCHIVE_FILE" -C "$(dirname "$TASK_WORKSPACE")" "$(basename "$TASK_WORKSPACE")"
    
    if [ -f "$ARCHIVE_FILE" ]; then
        ARCHIVE_SIZE=$(du -sh "$ARCHIVE_FILE" | cut -f1)
        rm -rf "$TASK_WORKSPACE"
        echo "✓ Workspace archived: $ARCHIVE_FILE (${ARCHIVE_SIZE})"
        ((DIRS_REMOVED++))
    fi
fi

# Clean up old reports (keep only latest 3)
echo
echo "Cleaning old reports..."
for report_type in "verification" "evaluation"; do
    REPORT_DIR=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}"
    if [ -d "$REPORT_DIR" ]; then
        # List all reports, sorted by time, skip the 3 most recent
        ls -t "$REPORT_DIR"/${report_type}-report-*.json 2>/dev/null | tail -n +4 | while read -r old_report; do
            rm -f "$old_report"
            echo "✓ Removed old report: $(basename "$old_report")"
            ((FILES_REMOVED++))
        done
    fi
done

# Generate cleanup report
CLEANUP_REPORT=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/cleanup-report-${TIMESTAMP}.json"
mkdir -p "$(dirname "$CLEANUP_REPORT")"

cat > "$CLEANUP_REPORT" << EOF
{
  "task_id": "${TASK_ID}",
  "timestamp": "${TIMESTAMP}",
  "cleaned_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "statistics": {
    "files_removed": ${FILES_REMOVED},
    "directories_removed": ${DIRS_REMOVED},
    "total_items_removed": $((FILES_REMOVED + DIRS_REMOVED))
  },
  "cleanup_complete": true
}
EOF

# Log cleanup completion
echo "[$(date)] Cleanup completed for Task ${TASK_ID}: ${FILES_REMOVED} files, ${DIRS_REMOVED} dirs removed" >> "$CLEANUP_LOG"

# Display summary
echo
echo "=================================================================================="
echo "CLEANUP SUMMARY"
echo "=================================================================================="
echo "Files removed:       ${FILES_REMOVED}"
echo "Directories removed: ${DIRS_REMOVED}"
echo "Total items:         $((FILES_REMOVED + DIRS_REMOVED))"
echo
echo "Cleanup report saved to: $CLEANUP_REPORT"

# Always exit successfully unless critical error
exit 0