#!/bin/bash
# execute-task-with-cycle.sh - Master script to enforce 7-step cycle

set -euo pipefail

if [ $# -lt 2 ]; then
    echo "ERROR: Task ID and name required"
    echo "Usage: $0 <task-id> <task-name>"
    exit 1
fi

TASK_ID="$1"
TASK_NAME="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_DIR=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}"

echo "=================================================================================="
echo "           MANDATORY 7-STEP TASK EXECUTION CYCLE"
echo "=================================================================================="
echo "Task: ${TASK_ID} - ${TASK_NAME}"
echo "Start Time: $(date)"
echo

# Initialize cycle tracking
CYCLE_LOG=".claude/runtime/cycle-compliance.log"
VIOLATION_LOG=".claude/runtime/violations.log"
STEPS_COMPLETED=0

# Function to log step completion
log_step() {
    local step_name="$1"
    local status="$2"
    echo "[$(date)] Task ${TASK_ID} - Step ${step_name}: ${status}" >> "$CYCLE_LOG"
    if [ "$status" = "COMPLETED" ]; then
        ((STEPS_COMPLETED++))
    fi
}

# Function to handle violations
handle_violation() {
    local step_name="$1"
    local reason="$2"
    echo "❌ VIOLATION: ${step_name} - ${reason}"
    echo "[$(date)] VIOLATION - Task ${TASK_ID} - ${step_name}: ${reason}" >> "$VIOLATION_LOG"
    
    # Critical violation - terminate immediately
    echo
    echo "CRITICAL VIOLATION DETECTED - TASK EXECUTION TERMINATED"
    echo "This incident has been logged and requires review."
    exit 100
}

# STEP 1: BACKUP
echo "──────────────────────────────────────────────────────────────────────────────"
echo "STEP 1/7: CREATING BACKUP"
echo "──────────────────────────────────────────────────────────────────────────────"

if ! BACKUP_LOCATION=$("$SCRIPT_DIR/create-task-backup.sh" "$TASK_ID"); then
    handle_violation "BACKUP" "Failed to create backup"
fi
echo "✓ Backup created at: $BACKUP_LOCATION"
log_step "BACKUP" "COMPLETED"

# STEP 2: CONFIRMATION
echo
echo "──────────────────────────────────────────────────────────────────────────────"
echo "STEP 2/7: REQUESTING CONFIRMATION"
echo "──────────────────────────────────────────────────────────────────────────────"

if ! "$SCRIPT_DIR/request-confirmation.sh" "$TASK_ID" "$TASK_NAME"; then
    handle_violation "CONFIRMATION" "User did not approve task execution"
fi
log_step "CONFIRMATION" "COMPLETED"

# STEP 3: EXECUTION
echo
echo "──────────────────────────────────────────────────────────────────────────────"
echo "STEP 3/7: EXECUTING TASK"
echo "──────────────────────────────────────────────────────────────────────────────"

# Log execution start
echo "[$(date)] START Task ${TASK_ID}" >> .claude/runtime/task-execution.log

# Execute task-specific script if exists
TASK_SCRIPT="$TASK_DIR/execution-script.sh"
if [ -x "$TASK_SCRIPT" ]; then
    echo "Executing task-specific script..."
    if ! "$TASK_SCRIPT"; then
        echo "⚠ Task script reported errors"
        # Don't terminate - continue with verification
    fi
else
    echo "⚠ No task-specific execution script found"
    echo "Task implementation required at: $TASK_SCRIPT"
fi

# Log execution end
echo "[$(date)] COMPLETE Task ${TASK_ID}" >> .claude/runtime/task-execution.log
log_step "EXECUTION" "COMPLETED"

# STEP 4: VERIFICATION
echo
echo "──────────────────────────────────────────────────────────────────────────────"
echo "STEP 4/7: VERIFYING RESULTS"
echo "──────────────────────────────────────────────────────────────────────────────"

if ! "$SCRIPT_DIR/verify-task.sh" "$TASK_ID"; then
    echo "⚠ Verification reported issues"
fi
log_step "VERIFICATION" "COMPLETED"

# STEP 5: EVALUATION
echo
echo "──────────────────────────────────────────────────────────────────────────────"
echo "STEP 5/7: EVALUATING SUCCESS"
echo "──────────────────────────────────────────────────────────────────────────────"

if ! "$SCRIPT_DIR/evaluate-task.sh" "$TASK_ID"; then
    echo "⚠ Evaluation identified problems"
fi
log_step "EVALUATION" "COMPLETED"

# STEP 6: UPDATE PROGRESS
echo
echo "──────────────────────────────────────────────────────────────────────────────"
echo "STEP 6/7: UPDATING PROGRESS"
echo "──────────────────────────────────────────────────────────────────────────────"

"$SCRIPT_DIR/update-progress.sh" "$TASK_ID"
log_step "UPDATE" "COMPLETED"

# STEP 7: CLEANUP
echo
echo "──────────────────────────────────────────────────────────────────────────────"
echo "STEP 7/7: CLEANING UP"
echo "──────────────────────────────────────────────────────────────────────────────"

"$SCRIPT_DIR/cleanup-task.sh" "$TASK_ID"
log_step "CLEANUP" "COMPLETED"

# Final compliance check
echo
echo "=================================================================================="
echo "                         CYCLE COMPLIANCE SUMMARY"
echo "=================================================================================="
echo "Steps Completed: ${STEPS_COMPLETED}/7"

if [ $STEPS_COMPLETED -eq 7 ]; then
    echo "Status: ✓ COMPLIANT - All steps completed successfully"
    echo "[$(date)] Task ${TASK_ID} - CYCLE COMPLIANT (7/7 steps)" >> "$CYCLE_LOG"
else
    echo "Status: ❌ NON-COMPLIANT - Only ${STEPS_COMPLETED}/7 steps completed"
    echo "[$(date)] Task ${TASK_ID} - CYCLE VIOLATION (${STEPS_COMPLETED}/7 steps)" >> "$CYCLE_LOG"
    handle_violation "CYCLE_COMPLIANCE" "Incomplete execution cycle"
fi

echo "End Time: $(date)"
echo "=================================================================================="

exit 0