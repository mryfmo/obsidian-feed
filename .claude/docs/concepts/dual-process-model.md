# Understanding the Dual Process Model

## 🎭 Two Processes, One Goal: Safe and Structured Development

The Claude Integration System uses two complementary processes that work at different levels:

## 📊 The Relationship

```
┌─────────────────────────────────────────────────────────────────┐
│              7-PHASE DEVELOPMENT LIFECYCLE                       │
│                   (Strategic Level)                              │
│                                                                  │
│  Purpose: Manage complete work items from start to finish        │
│  Duration: Hours to days                                         │
│  Scope: Entire feature, bug fix, or enhancement                 │
│                                                                  │
│    FETCH ──→ INV ──→ ANA ──→ PLAN ──→ BUILD ──→ VERIF ──→ REL  │
│                                         │                        │
│                                         ▼                        │
│                          ┌──────────────────────────────┐       │
│                          │   7-STEP EXECUTION CYCLE     │       │
│                          │      (Tactical Level)        │       │
│                          │                              │       │
│                          │  Purpose: Safe operations    │       │
│                          │  Duration: Seconds to minutes│       │
│                          │  Scope: Individual file ops  │       │
│                          │                              │       │
│                          │  1. BACKUP                   │       │
│                          │  2. CONFIRM                  │       │
│                          │  3. EXECUTE                  │       │
│                          │  4. VERIFY                   │       │
│                          │  5. EVALUATE                 │       │
│                          │  6. UPDATE                   │       │
│                          │  7. CLEANUP                  │       │
│                          └──────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## 🔍 Key Distinctions

### Development Lifecycle (Phases)
- **What**: Strategic management of work items
- **When**: Starting any issue, feature, or bug
- **Notation**: UPPERCASE (FETCH, BUILD, etc.)
- **Example**: "I'm in the BUILD phase of issue #42"

### Execution Cycle (Steps)
- **What**: Tactical safety for operations
- **When**: Any file operation
- **Notation**: Numbered steps (Step 1: Backup)
- **Example**: "Deleting file.ts requires all 7 steps"

## 🎯 When to Use Which?

### Use Development Lifecycle When:
- Starting work on a GitHub issue
- Planning a new feature
- Investigating a bug
- Preparing a release

### Use Execution Cycle When:
- Creating a new file
- Editing existing files
- Deleting files
- Running potentially destructive commands

## 💡 Real-World Example

Let's say you're fixing bug #42: "Feed items disappear on refresh"

```
1. FETCH phase: Download relevant docs, read API specs
2. INV phase: Reproduce the bug locally
3. ANA phase: Find root cause in feedStore.ts
4. PLAN phase: Write RFC for the fix
5. BUILD phase: Implement the solution
   ├── Edit feedStore.ts (triggers 7-step cycle)
   ├── Create feedStore.test.ts (triggers 7-step cycle)
   └── Delete old-cache.ts (triggers 7-step cycle)
6. VERIF phase: Run all tests
7. REL phase: Create PR and release notes
```

## 🔗 Integration Points

### During BUILD Phase
Every file operation automatically triggers the execution cycle:
- Level 0 (read): Minimal cycle (steps 3-4)
- Level 1 (safe write): Standard cycle (steps 1,3-6)
- Level 2 (destructive): Full cycle (all 7 steps)
- Level 3 (system): Full cycle + review

### Phase Transitions
Moving between phases (e.g., PLAN → BUILD) requires:
- Completion of phase deliverables
- Update of phase status
- Workspace organization

## ❓ Common Questions

### Q: Do I always need both processes?
**A**: The development lifecycle is for managing work items. If you're just making a quick fix, you might skip it. However, the execution cycle is MANDATORY for all operations.

### Q: What if I'm just reading files?
**A**: Reading is Level 0, which only requires steps 3-4 of the execution cycle (Execute and Verify).

### Q: Can I skip steps in the execution cycle?
**A**: No. The number of required steps depends on the operation level, but you cannot skip required steps.

### Q: How do I know which phase I'm in?
**A**: Check `.claude/workspace/projects/{project-name}/.phase-status.yml` or run `.claude/scripts/status.sh`

## 📚 Learn More

- **Development Lifecycle Details**: [Development Lifecycle Guide](../guides/development-lifecycle.md)
- **Execution Cycle Details**: [Execution Cycle Guide](../guides/execution-cycle.md)
- **Safety Philosophy**: [Safety Model](safety-model.md)
- **Workspace Organization**: [Workspace Hierarchy](../standards/WORKSPACE-HIERARCHY.md)