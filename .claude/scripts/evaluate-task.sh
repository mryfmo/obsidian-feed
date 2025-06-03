#!/bin/bash
# evaluate-task.sh - Mandatory evaluation of task success

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "ERROR: Task ID required"
    echo "Usage: $0 <task-id>"
    exit 1
fi

TASK_ID="$1"
CRITERIA_FILE=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/evaluation-criteria.yml"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=================================================================================="
echo "                           TASK EVALUATION PROCESS"
echo "=================================================================================="
echo "Task ID: ${TASK_ID}"
echo "Timestamp: $(date)"
echo

# Initialize evaluation metrics
COMPLETENESS=0
CORRECTNESS=0
COMPLIANCE=0
OVERALL_STATUS="UNKNOWN"

# Check if verification passed
LATEST_VERIFICATION=$(ls -t .claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/verification-report-*.json 2>/dev/null | head -1)
if [ -f "$LATEST_VERIFICATION" ]; then
    VERIFICATION_STATUS=$(grep -o '"verification_status": "[^"]*"' "$LATEST_VERIFICATION" | cut -d'"' -f4)
    if [ "$VERIFICATION_STATUS" = "PASSED" ]; then
        CORRECTNESS=100
        echo "✓ Verification Status: PASSED"
    else
        CORRECTNESS=0
        echo "✗ Verification Status: FAILED"
    fi
else
    echo "⚠ No verification report found"
fi

# Check task outputs
echo
echo "Evaluating Task Outputs:"
echo "------------------------"

# Check if expected outputs exist
OUTPUTS_DIR=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/outputs"
if [ -d "$OUTPUTS_DIR" ]; then
    OUTPUT_COUNT=$(find "$OUTPUTS_DIR" -type f | wc -l)
    if [ "$OUTPUT_COUNT" -gt 0 ]; then
        COMPLETENESS=100
        echo "✓ Found $OUTPUT_COUNT output files"
    else
        COMPLETENESS=50
        echo "⚠ No output files found"
    fi
else
    COMPLETENESS=0
    echo "✗ Output directory not found"
fi

# Check compliance with 7-step cycle
echo
echo "Checking Cycle Compliance:"
echo "--------------------------"

COMPLIANCE_SCORE=0
COMPLIANCE_CHECKS=0

# Check backup
if [ -f ".claude/runtime/backup.log" ] && grep -q "Task ${TASK_ID}" .claude/runtime/backup.log; then
    echo "✓ Backup created"
    ((COMPLIANCE_SCORE+=20))
else
    echo "✗ No backup record found"
fi

# Check confirmation
if [ -f ".claude/runtime/confirmations.log" ] && grep -q "Task ${TASK_ID} approved" .claude/runtime/confirmations.log; then
    echo "✓ User confirmation received"
    ((COMPLIANCE_SCORE+=20))
else
    echo "✗ No confirmation record found"
fi

# Check execution log
if [ -f ".claude/runtime/task-execution.log" ] && grep -q "Task ${TASK_ID}" .claude/runtime/task-execution.log; then
    echo "✓ Execution logged"
    ((COMPLIANCE_SCORE+=20))
else
    echo "✗ No execution log found"
fi

# Check verification
if [ -f "$LATEST_VERIFICATION" ]; then
    echo "✓ Verification completed"
    ((COMPLIANCE_SCORE+=20))
else
    echo "✗ Verification not completed"
fi

# Current evaluation counts as compliance
echo "✓ Evaluation in progress"
((COMPLIANCE_SCORE+=20))

COMPLIANCE=$COMPLIANCE_SCORE

# Calculate overall status
TOTAL_SCORE=$((COMPLETENESS + CORRECTNESS + COMPLIANCE))
AVERAGE_SCORE=$((TOTAL_SCORE / 3))

if [ $AVERAGE_SCORE -ge 90 ]; then
    OVERALL_STATUS="SUCCESS"
elif [ $AVERAGE_SCORE -ge 70 ]; then
    OVERALL_STATUS="PARTIAL"
else
    OVERALL_STATUS="FAILED"
fi

# Generate evaluation report
REPORT_FILE=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/evaluation-report-${TIMESTAMP}.json"
mkdir -p "$(dirname "$REPORT_FILE")"

cat > "$REPORT_FILE" << EOF
{
  "task_id": "${TASK_ID}",
  "timestamp": "${TIMESTAMP}",
  "evaluated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "metrics": {
    "completeness": ${COMPLETENESS},
    "correctness": ${CORRECTNESS},
    "compliance": ${COMPLIANCE}
  },
  "average_score": ${AVERAGE_SCORE},
  "overall_status": "${OVERALL_STATUS}",
  "details": {
    "verification_status": "${VERIFICATION_STATUS:-NOT_FOUND}",
    "output_count": ${OUTPUT_COUNT:-0},
    "compliance_checks_passed": $((COMPLIANCE_SCORE / 20))
  }
}
EOF

# Display summary
echo
echo "=================================================================================="
echo "EVALUATION SUMMARY"
echo "=================================================================================="
echo "Completeness: ${COMPLETENESS}%"
echo "Correctness:  ${CORRECTNESS}%"
echo "Compliance:   ${COMPLIANCE}%"
echo "Average:      ${AVERAGE_SCORE}%"
echo "Status:       ${OVERALL_STATUS}"
echo
echo "Report saved to: $REPORT_FILE"

# Log evaluation
echo "[$(date)] Task ${TASK_ID} evaluated as ${OVERALL_STATUS} (Score: ${AVERAGE_SCORE}%)" >> .claude/runtime/evaluation.log

# Exit based on status
[ "$OVERALL_STATUS" != "FAILED" ] && exit 0 || exit 1