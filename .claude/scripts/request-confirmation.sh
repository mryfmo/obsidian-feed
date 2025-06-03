#!/bin/bash
# request-confirmation.sh - Mandatory confirmation before task execution

set -euo pipefail

if [ $# -lt 2 ]; then
    echo "ERROR: Task ID and name required"
    echo "Usage: $0 <task-id> <task-name>"
    exit 1
fi

TASK_ID="$1"
TASK_NAME="$2"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Load task configuration if exists
CONFIG_FILE=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/cycle-config.yml"
TEMPLATE_FILE=".claude/workspace/projects/strict-rules-integration/tasks/task-${TASK_ID}/confirmation-template.md"

# Determine confirmation level
LEVEL=2  # Default to Level 2 (requires confirmation)
if [ -f "$CONFIG_FILE" ]; then
    # Extract level from YAML (simple grep for now)
    LEVEL=$(grep -A2 "confirmation:" "$CONFIG_FILE" | grep "level:" | awk '{print $2}' || echo "2")
fi

# Generate confirmation request
cat << EOF

================================================================================
                        TASK EXECUTION CONFIRMATION REQUEST
================================================================================

Task ID: ${TASK_ID}
Task Name: ${TASK_NAME}
Timestamp: $(date)
Confirmation Level: ${LEVEL}

EOF

# Include custom template if exists
if [ -f "$TEMPLATE_FILE" ]; then
    cat "$TEMPLATE_FILE"
else
    # Default template
    cat << EOF
PLANNED ACTIONS:
- Execute task as defined in master plan
- Follow 7-step execution cycle
- Create all required outputs

POTENTIAL IMPACTS:
- File system modifications
- Configuration changes
- Documentation updates

ROLLBACK CAPABILITY:
- Backup location will be provided
- All changes reversible
- Recovery procedures documented

EOF
fi

cat << EOF

CONFIRMATION REQUIRED:
This is a Level ${LEVEL} operation requiring explicit approval.

Do you approve execution of this task? (Type 'yes' to proceed, anything else to abort)
EOF

# Log confirmation request
echo "[$(date)] Confirmation requested for Task ${TASK_ID}" >> .claude/runtime/confirmations.log

# Read user input
read -r RESPONSE

# Validate response
if [ "$RESPONSE" = "yes" ]; then
    echo "✓ Confirmation received. Proceeding with task execution."
    echo "[$(date)] Task ${TASK_ID} approved by user" >> .claude/runtime/confirmations.log
    exit 0
else
    echo "✗ Confirmation not received. Task execution aborted."
    echo "[$(date)] Task ${TASK_ID} rejected by user" >> .claude/runtime/confirmations.log
    exit 1
fi