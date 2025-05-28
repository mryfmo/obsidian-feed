# Claude Code Action Integration Guide

This guide explains how Claude Code Action integrates with the strict workflow system.

## Core Principles

1. **Phase Adherence**: All work must follow the 7-phase lifecycle
2. **Guard Rails**: Every output validated by `turn_guard.sh`
3. **Artifact Creation**: Required deliverables for each phase
4. **Audit Trail**: All state transitions recorded

## Integration Architecture

### 1. Workflow Triggers
Claude Code Action activates when:
- `@claude` mentioned in issues/PRs/comments
- PR opened/synchronized (for auto-review)

### 2. Context Detection
The action automatically detects:
- Current phase from PR title/labels
- Required artifacts for the phase
- Valid next transitions

### 3. Response Format
All Claude responses must follow:
```markdown
<think>
[Analysis of request and current state]
[20-700 words]
</think>

<act>
PHASE: Specific task description
[Actual work - commands, patches, analysis]
</act>

<verify>
[Verification of work completed]
[Test results, checks performed]
</verify>

<next>
[Next steps or state transition]
State-Transition: CURRENT→NEXT
</next>
```

### 4. Phase-Specific Requirements

#### FETCH Phase
- **Purpose**: Retrieve external documents/resources
- **Allowed**: Network operations via `fetch_doc.sh`
- **Artifacts**: Downloaded files in `.cache/`
- **Restrictions**: No code changes

#### INV Phase
- **Purpose**: Investigate and reproduce issues
- **Allowed**: Run tests, create reproduction cases
- **Artifacts**: Failing test, investigation notes in `docs/qa/`
- **Restrictions**: No fixes, only diagnosis

#### ANA Phase
- **Purpose**: Root cause analysis
- **Allowed**: Code analysis, impact assessment
- **Artifacts**: Analysis document in `docs/qa/`
- **Restrictions**: No implementation

#### PLAN Phase
- **Purpose**: Design solution
- **Allowed**: Create RFC, define scope
- **Artifacts**: RFC in `docs/rfcs/`
- **Restrictions**: Requires review approval to proceed

#### BUILD Phase
- **Purpose**: Implement solution
- **Allowed**: Code changes, test updates
- **Artifacts**: Patches via `apply_patch`
- **Restrictions**: ≤1000 LOC, ≤10 files

#### VERIF Phase
- **Purpose**: Verify implementation
- **Allowed**: Run tests, check coverage
- **Artifacts**: Test results, CHANGELOG update
- **Restrictions**: No new features

#### REL Phase
- **Purpose**: Release preparation
- **Allowed**: Version bump, release notes
- **Artifacts**: Release commit, GitHub release
- **Restrictions**: Only after VERIF complete

## GitHub Action Configuration

### Required Secrets
```yaml
CLAUDE_ACCESS_TOKEN: OAuth access token
CLAUDE_REFRESH_TOKEN: OAuth refresh token
CLAUDE_EXPIRES_AT: Token expiration timestamp
```

### Workflow Integration
The main workflow (`claude.yml`) should:
1. Detect current phase from context
2. Run Claude with phase-aware prompt
3. Validate output with turn_guard.sh
4. Update PR labels/state
5. Trigger dependent workflows

### Example PR Flow
1. User creates PR with title "INV: Fix feed parsing error"
2. User comments "@claude investigate this issue"
3. Claude Code Action:
   - Detects INV phase
   - Reproduces issue
   - Creates failing test
   - Updates PR with findings
   - Suggests transition to ANA
4. Guard validation ensures compliance
5. PR label updated automatically

## Best Practices

1. **Always validate phase context** before responding
2. **Create artifacts incrementally** as work progresses
3. **Use explicit state transitions** in every response
4. **Follow existing patterns** in the codebase
5. **Respect role boundaries** defined in agent docs
6. **Run local validation** before submitting

## Error Recovery

If validation fails:
1. Error logged to PR comment
2. Phase label remains unchanged
3. User must correct and retry
4. No state transition occurs

## Monitoring

Track success via:
- Guard validation pass rate
- Phase transition accuracy
- Artifact completeness
- CI/CD pipeline status