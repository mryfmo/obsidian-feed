#!/bin/bash
# verify-task.sh - Mandatory verification after task execution

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "ERROR: Task ID required"
    echo "Usage: $0 <task-id>"
    exit 1
fi

TASK_ID="$1"
CHECKLIST_FILE=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/verification-checklist.md"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=================================================================================="
echo "                           TASK VERIFICATION PROCESS"
echo "=================================================================================="
echo "Task ID: ${TASK_ID}"
echo "Timestamp: $(date)"
echo

# Initialize verification results
VERIFICATION_PASSED=true
CHECKS_TOTAL=0
CHECKS_PASSED=0

# Run automated checks if verification script exists
VERIFY_SCRIPT=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/verify.sh"
if [ -x "$VERIFY_SCRIPT" ]; then
    echo "Running automated verification..."
    if "$VERIFY_SCRIPT"; then
        echo "✓ Automated checks passed"
        ((CHECKS_PASSED++))
    else
        echo "✗ Automated checks failed"
        VERIFICATION_PASSED=false
    fi
    ((CHECKS_TOTAL++))
fi

# Process checklist if exists
if [ -f "$CHECKLIST_FILE" ]; then
    echo
    echo "Manual Verification Checklist:"
    echo "------------------------------"
    
    # Extract checklist items (lines starting with - [ ])
    while IFS= read -r line; do
        if [[ "$line" =~ ^-\ \[\ \]\ (.+) ]]; then
            CHECK_ITEM="${BASH_REMATCH[1]}"
            ((CHECKS_TOTAL++))
            
            echo -n "Checking: $CHECK_ITEM ... "
            
            # Here we would normally do automated checks
            # For now, we'll mark as requiring manual verification
            echo "[MANUAL CHECK REQUIRED]"
        fi
    done < "$CHECKLIST_FILE"
else
    echo "WARNING: No verification checklist found for task ${TASK_ID}"
fi

# Generate verification report
REPORT_FILE=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/verification-report-${TIMESTAMP}.json"
mkdir -p "$(dirname "$REPORT_FILE")"

cat > "$REPORT_FILE" << EOF
{
  "task_id": "${TASK_ID}",
  "timestamp": "${TIMESTAMP}",
  "verified_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "checks_total": ${CHECKS_TOTAL},
  "checks_passed": ${CHECKS_PASSED},
  "verification_status": "$([ "$VERIFICATION_PASSED" = true ] && echo "PASSED" || echo "FAILED")",
  "requires_manual_review": true
}
EOF

# Log verification
echo "[$(date)] Verification ${VERIFICATION_PASSED} for Task ${TASK_ID}" >> .claude/runtime/verification.log

echo
echo "Verification Report saved to: $REPORT_FILE"
echo "Status: $([ "$VERIFICATION_PASSED" = true ] && echo "PASSED" || echo "FAILED")"

# Exit with appropriate code
[ "$VERIFICATION_PASSED" = true ] && exit 0 || exit 1