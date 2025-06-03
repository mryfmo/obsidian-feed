#!/bin/bash
# update-progress.sh - Mandatory progress tracking update

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "ERROR: Task ID required"
    echo "Usage: $0 <task-id>"
    exit 1
fi

TASK_ID="$1"
PHASE_STATUS_FILE=".claude/workspace/projects/strict-rules-integration/PLAN/.phase-status.yml"
PROGRESS_LOG=".claude/runtime/progress.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Updating progress for Task ${TASK_ID}..."

# Get latest evaluation status
LATEST_EVAL=$(ls -t .claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/evaluation-report-*.json 2>/dev/null | head -1)
if [ -f "$LATEST_EVAL" ]; then
    TASK_STATUS=$(grep -o '"overall_status": "[^"]*"' "$LATEST_EVAL" | cut -d'"' -f4)
else
    TASK_STATUS="UNKNOWN"
fi

# Get latest verification report
LATEST_VERIFICATION=$(ls -t .claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/verification-report-*.json 2>/dev/null | head -1)

# Update phase status file (backup first)
if [ -f "$PHASE_STATUS_FILE" ]; then
    cp "$PHASE_STATUS_FILE" "${PHASE_STATUS_FILE}.backup.${TIMESTAMP}"
    
    # Extract current completed tasks count
    CURRENT_COMPLETED=$(grep "completed_tasks:" "$PHASE_STATUS_FILE" | awk '{print $2}')
    
    # Increment if task succeeded
    if [ "$TASK_STATUS" = "SUCCESS" ] || [ "$TASK_STATUS" = "PARTIAL" ]; then
        NEW_COMPLETED=$((CURRENT_COMPLETED + 1))
        
        # Update the YAML file
        sed -i.tmp "s/completed_tasks: ${CURRENT_COMPLETED}/completed_tasks: ${NEW_COMPLETED}/" "$PHASE_STATUS_FILE"
        sed -i.tmp "s/current_task: .*/current_task: ${TASK_ID}/" "$PHASE_STATUS_FILE"
        
        echo "✓ Progress updated: ${NEW_COMPLETED}/100 tasks completed"
    else
        echo "✗ Task failed - progress not incremented"
    fi
else
    echo "WARNING: Phase status file not found"
fi

# Create detailed progress entry
PROGRESS_ENTRY=".claude/workspace/projects/strict-rules-integration/progress/task-${TASK_ID}-progress.json"
mkdir -p "$(dirname "$PROGRESS_ENTRY")"

# Calculate task duration if execution log exists
START_TIME=""
END_TIME=""
DURATION="unknown"

if [ -f ".claude/runtime/task-execution.log" ]; then
    START_TIME=$(grep "START Task ${TASK_ID}" .claude/runtime/task-execution.log | tail -1 | cut -d']' -f1 | tr -d '[')
    END_TIME=$(grep "COMPLETE Task ${TASK_ID}" .claude/runtime/task-execution.log | tail -1 | cut -d']' -f1 | tr -d '[')
    
    if [ -n "$START_TIME" ] && [ -n "$END_TIME" ]; then
        START_EPOCH=$(date -d "$START_TIME" +%s 2>/dev/null || date -j -f "%a %b %d %H:%M:%S %Z %Y" "$START_TIME" +%s 2>/dev/null || echo "0")
        END_EPOCH=$(date -d "$END_TIME" +%s 2>/dev/null || date -j -f "%a %b %d %H:%M:%S %Z %Y" "$END_TIME" +%s 2>/dev/null || echo "0")
        
        if [ "$START_EPOCH" -ne 0 ] && [ "$END_EPOCH" -ne 0 ]; then
            DURATION=$((END_EPOCH - START_EPOCH))
        fi
    fi
fi

cat > "$PROGRESS_ENTRY" << EOF
{
  "task_id": "${TASK_ID}",
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "${TASK_STATUS}",
  "duration_seconds": "${DURATION}",
  "checkpoints": {
    "backup_completed": $([ -f ".claude/runtime/backup.log" ] && grep -q "Task ${TASK_ID}" .claude/runtime/backup.log && echo "true" || echo "false"),
    "confirmation_received": $([ -f ".claude/runtime/confirmations.log" ] && grep -q "Task ${TASK_ID} approved" .claude/runtime/confirmations.log && echo "true" || echo "false"),
    "execution_logged": $([ -f ".claude/runtime/task-execution.log" ] && grep -q "Task ${TASK_ID}" .claude/runtime/task-execution.log && echo "true" || echo "false"),
    "verification_completed": $([ -f "$LATEST_VERIFICATION" ] && echo "true" || echo "false"),
    "evaluation_completed": $([ -f "$LATEST_EVAL" ] && echo "true" || echo "false")
  }
}
EOF

# Update master progress log
echo "[$(date)] Task ${TASK_ID}: Status=${TASK_STATUS}, Duration=${DURATION}s" >> "$PROGRESS_LOG"

# Generate progress summary
TOTAL_TASKS=100
COMPLETED_TASKS=$(grep -c "Status=SUCCESS\|Status=PARTIAL" "$PROGRESS_LOG" 2>/dev/null || echo "0")
FAILED_TASKS=$(grep -c "Status=FAILED" "$PROGRESS_LOG" 2>/dev/null || echo "0")
PROGRESS_PERCENT=$((COMPLETED_TASKS * 100 / TOTAL_TASKS))

echo
echo "=================================================================================="
echo "PROGRESS UPDATE COMPLETE"
echo "=================================================================================="
echo "Task ${TASK_ID}: ${TASK_STATUS}"
echo "Overall Progress: ${COMPLETED_TASKS}/${TOTAL_TASKS} (${PROGRESS_PERCENT}%)"
echo "Failed Tasks: ${FAILED_TASKS}"
echo
echo "Progress entry saved to: $PROGRESS_ENTRY"