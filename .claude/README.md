# Claude Integration System

## 🎯 Quick Navigation

### Working on an Issue or Feature?
→ You need the **[7-Phase Development Lifecycle](docs/guides/development-lifecycle.md)**
- Manages work from start to finish (FETCH → REL)
- Used for: issues, features, bugs, enhancements

### Performing File Operations?
→ You need the **[7-Step Execution Cycle](docs/guides/execution-cycle.md)**
- Ensures safety for each operation (BACKUP → CLEANUP)
- Used for: creating, editing, deleting files

### New to the System?
→ Start with **[Understanding the Two Processes](docs/concepts/dual-process-model.md)**

## 🔄 How They Work Together

```
Development Lifecycle (Strategic Level)
└── FETCH → INV → ANA → PLAN → BUILD → VERIF → REL
                                  │
                                  └── Each file operation triggers
                                      └── Execution Cycle (Tactical Level)
                                          └── BACKUP → CONFIRM → EXECUTE → VERIFY → EVALUATE → UPDATE → CLEANUP
```

During the BUILD phase (or any phase requiring file changes), each operation automatically follows the execution cycle for safety.

## 🛡️ Safety Levels

| Level | Type | Operations | Cycle Requirements |
|-------|------|------------|-------------------|
| 0 | Read-only | View files, git status | Steps 3-4 only |
| 1 | Safe writes | Create/edit files | Steps 1,3-6 |
| 2 | Destructive | Delete files, git reset | All 7 steps |
| 3 | System | Modify configs | All 7 steps + review |

## 📚 Documentation Structure

```
.claude/
├── README.md (you are here)
├── docs/
│   ├── concepts/          # Core concepts and philosophy
│   ├── guides/            # Step-by-step guides
│   ├── workflows/         # Detailed workflows
│   └── reference/         # Complete reference
├── config/                # Active configuration
├── scripts/               # Automation scripts
└── workspace/             # Your work area
```

## 🚀 Common Tasks

### Start a New Issue
```bash
# Begin at FETCH phase
.claude/scripts/start-issue.sh issue-123
```

### Check Current Status
```bash
# See your current phase and pending operations
.claude/scripts/status.sh
```

### Validate Compliance
```bash
# Ensure all safety measures are in place
.claude/scripts/validate-cycle-compliance.sh
```

## ❓ Need Help?

- **Conceptual Questions**: See [concepts/](docs/concepts/)
- **How-to Guides**: See [guides/](docs/guides/)
- **Troubleshooting**: See [docs/troubleshooting.md](docs/troubleshooting.md)
- **Contributing**: See [CONTRIBUTING.md](docs/CONTRIBUTING.md)

---

*This system prioritizes safety and auditability while enabling efficient development.*