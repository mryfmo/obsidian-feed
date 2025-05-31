# Claude Documentation Template Standards

## Quality Criteria for High-Precision Templates

### 1. Structure Requirements

Every template MUST include:

```markdown
# [Document Title] - {{PROJECT_NAME}}

> **Template Version**: X.Y.Z
> **Last Updated**: YYYY-MM-DD
> **Compatibility**: Claude Code vX.Y+

## Quick Start Checklist
- [ ] Clear action items
- [ ] Variable replacements
- [ ] Test commands

## Main Content (80% reusable)
[Content that works for any project]

## Project-Specific Sections (20% customizable)
[Clearly marked customization points]

## Validation
[Test scripts and verification methods]
```

### 2. Content Distribution

- **80% Generic**: Works for any project without modification
- **20% Custom**: Clearly marked project-specific sections
- **0% Ambiguous**: No vague instructions or unclear placeholders

### 3. Placeholder Standards

```markdown
GOOD:
{{PROJECT_NAME}}           - Simple replacement
{{PROJECT_DESCRIPTION}}    - One-line description

BAD:
[PROJECT-SPECIFIC]         - Too vague
[DESCRIBE YOUR NEEDS]      - No guidance
[ADD CONTENT HERE]         - Lazy placeholder
```

### 4. Example Requirements

Each template must include:
- **Minimum 3 project type examples** (Web, CLI, Plugin)
- **Real code snippets** that compile/run
- **Actual configuration** files
- **Working test commands**

### 5. Self-Validation

Templates must be self-validating:
- Completion checklist
- Test commands
- Validation scripts
- Success criteria

### 6. Error Prevention

Include:
- Common pitfalls section
- Anti-patterns with explanations
- Troubleshooting guide
- FAQ based on real issues

## Template Quality Checklist

Before considering a template complete:

- [ ] Can be used within 30 minutes
- [ ] Less than 10 variables to replace
- [ ] Includes 3+ project type examples
- [ ] Has executable code samples
- [ ] Contains validation methods
- [ ] Documents common mistakes
- [ ] Follows consistent formatting
- [ ] Tested on real project

## Example: High-Quality Section

```markdown
### Build Configuration

#### Standard Setup (works for 80% of projects)
```json
{
  "build": {
    "input": "src/index.ts",
    "output": "dist/bundle.js",
    "minify": true,
    "sourcemap": true
  }
}
```

#### Project Type Variations

<details>
<summary><strong>React Application</strong></summary>

```json
{
  "build": {
    "input": "src/App.tsx",
    "output": "build/static/js/",
    "minify": true,
    "sourcemap": false,
    "jsx": "react",
    "splitting": true
  }
}
```
</details>

<details>
<summary><strong>Node.js CLI</strong></summary>

```json
{
  "build": {
    "input": "src/cli.ts",
    "output": "bin/cli.js",
    "minify": false,
    "sourcemap": false,
    "platform": "node",
    "banner": "#!/usr/bin/env node"
  }
}
```
</details>

<details>
<summary><strong>Browser Extension</strong></summary>

```json
{
  "build": {
    "input": ["src/content.ts", "src/background.ts"],
    "output": "extension/js/",
    "minify": true,
    "sourcemap": false,
    "format": "iife"
  }
}
```
</details>

**Your Configuration**: {{BUILD_CONFIG}}
```

This example shows:
- Default configuration that works for most
- Hidden variations for specific needs
- Clear placeholder for customization
- Real, working examples

## Maintenance

Templates should be:
- **Versioned**: Track changes over time
- **Tested**: Validate with real projects
- **Updated**: Incorporate lessons learned
- **Documented**: Explain design decisions