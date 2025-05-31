# Architecture - {{PROJECT_NAME}}

> **Template Version**: 1.0.0  
> **Project Type**: {{PROJECT_TYPE}}  
> **Last Updated**: {{LAST_UPDATED}}

## Quick Architecture Checklist

- [ ] Replace all {{VARIABLES}} with actual values
- [ ] Draw/update architecture diagram
- [ ] Document all external dependencies
- [ ] Define integration points
- [ ] Specify data flow patterns
- [ ] Review with team

## System Overview

{{PROJECT_NAME}} is a {{PROJECT_TYPE}} that {{PROJECT_DESCRIPTION}}.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    {{PROJECT_NAME}}                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Layer 1   │  │   Layer 2   │  │   Layer 3   │    │
│  │{{LAYER1_NAME}}│  │{{LAYER2_NAME}}│  │{{LAYER3_NAME}}│    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                 │                 │           │
│  ┌──────▼─────────────────▼─────────────────▼──────┐   │
│  │              Core Business Logic                │   │
│  │              {{CORE_DESCRIPTION}}              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
                   External Services
                   {{EXTERNAL_SERVICES}}
```

## Core Components

### 1. Entry Point
- **File**: `{{ENTRY_POINT_FILE}}`
- **Purpose**: {{ENTRY_POINT_PURPOSE}}
- **Key Responsibilities**:
  - {{RESPONSIBILITY_1}}
  - {{RESPONSIBILITY_2}}
  - {{RESPONSIBILITY_3}}

<details>
<summary><strong>Example Implementation</strong></summary>

```typescript
// Example for {{PROJECT_TYPE}}
{{ENTRY_POINT_EXAMPLE}}
```
</details>

### 2. Core Services

#### Service Layer Pattern
```typescript
interface ServicePattern {
  // All services follow this pattern
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): HealthStatus;
}
```

#### Key Services

| Service | File | Purpose | Dependencies |
|---------|------|---------|--------------|
| {{SERVICE_1_NAME}} | `{{SERVICE_1_FILE}}` | {{SERVICE_1_PURPOSE}} | {{SERVICE_1_DEPS}} |
| {{SERVICE_2_NAME}} | `{{SERVICE_2_FILE}}` | {{SERVICE_2_PURPOSE}} | {{SERVICE_2_DEPS}} |
| {{SERVICE_3_NAME}} | `{{SERVICE_3_FILE}}` | {{SERVICE_3_PURPOSE}} | {{SERVICE_3_DEPS}} |

### 3. Data Layer

#### Storage Strategy
- **Primary Storage**: {{PRIMARY_STORAGE}}
- **Cache Layer**: {{CACHE_LAYER}}
- **Backup Strategy**: {{BACKUP_STRATEGY}}

#### Data Flow
```
User Input → Validation → Processing → Storage → Response
     ↑                                    ↓
     └────────── Error Handling ──────────┘
```

### 4. External Integrations

#### Claude Integration Points
1. **Operation Guard**: Validates all file operations
2. **Audit Trail**: Logs all significant operations
3. **MCP Servers**: Enhanced capabilities via:
   - Filesystem access
   - GitHub integration
   - Memory persistence
   - {{PROJECT_MCP_SERVERS}}

#### Third-Party Services
| Service | Purpose | Authentication | Rate Limits |
|---------|---------|----------------|-------------|
| {{SERVICE_NAME}} | {{SERVICE_PURPOSE}} | {{AUTH_METHOD}} | {{RATE_LIMIT}} |

## Design Patterns

### Patterns Used

1. **{{PATTERN_1}}**
   - Usage: {{PATTERN_1_USAGE}}
   - Benefits: {{PATTERN_1_BENEFITS}}

2. **{{PATTERN_2}}**
   - Usage: {{PATTERN_2_USAGE}}
   - Benefits: {{PATTERN_2_BENEFITS}}

3. **{{PATTERN_3}}**
   - Usage: {{PATTERN_3_USAGE}}
   - Benefits: {{PATTERN_3_BENEFITS}}

### Project Type Specific Patterns

<details>
<summary><strong>Web Application</strong></summary>

- **MVC/MVP/MVVM**: Separation of concerns
- **Repository Pattern**: Data access abstraction
- **Middleware Pipeline**: Request processing
- **Dependency Injection**: Loose coupling
</details>

<details>
<summary><strong>CLI Tool</strong></summary>

- **Command Pattern**: Encapsulate operations
- **Strategy Pattern**: Multiple algorithms
- **Chain of Responsibility**: Command processing
- **Builder Pattern**: Complex object construction
</details>

<details>
<summary><strong>Plugin/Extension</strong></summary>

- **Observer Pattern**: Event handling
- **Adapter Pattern**: Host API integration
- **Singleton Pattern**: Single instance
- **Factory Pattern**: Dynamic component creation
</details>

## Technical Stack

### Core Technologies
- **Language**: {{PRIMARY_LANGUAGE}} {{LANGUAGE_VERSION}}
- **Runtime**: {{RUNTIME}} {{RUNTIME_VERSION}}
- **Build Tool**: {{BUILD_TOOL}}
- **Package Manager**: {{PACKAGE_MANAGER}}

### Key Dependencies
```json
{
  "{{DEP_1}}": "{{DEP_1_VERSION}}",
  "{{DEP_2}}": "{{DEP_2_VERSION}}",
  "{{DEP_3}}": "{{DEP_3_VERSION}}"
}
```

### Development Tools
- **IDE**: {{RECOMMENDED_IDE}}
- **Linter**: {{LINTER}}
- **Formatter**: {{FORMATTER}}
- **Test Runner**: {{TEST_RUNNER}}

## Performance Considerations

### Optimization Strategies
1. **{{OPTIMIZATION_1}}**: {{OPTIMIZATION_1_DESC}}
2. **{{OPTIMIZATION_2}}**: {{OPTIMIZATION_2_DESC}}
3. **{{OPTIMIZATION_3}}**: {{OPTIMIZATION_3_DESC}}

### Benchmarks
| Operation | Target | Current | Status |
|-----------|--------|---------|---------|
| {{OP_1}} | {{TARGET_1}} | {{CURRENT_1}} | {{STATUS_1}} |
| {{OP_2}} | {{TARGET_2}} | {{CURRENT_2}} | {{STATUS_2}} |

## Security Architecture

### Security Layers
1. **Input Validation**: {{VALIDATION_STRATEGY}}
2. **Authentication**: {{AUTH_STRATEGY}}
3. **Authorization**: {{AUTHZ_STRATEGY}}
4. **Data Protection**: {{DATA_PROTECTION}}

### Claude Safety Integration
- All file operations go through OperationGuard
- Audit trail for operations level 2+
- Forbidden patterns enforced
- Rollback capability for destructive operations

## Deployment Architecture

### Environments
- **Development**: {{DEV_ENV}}
- **Staging**: {{STAGING_ENV}}
- **Production**: {{PROD_ENV}}

### CI/CD Pipeline
```
Code → Build → Test → Security Scan → Deploy → Monitor
         ↓       ↓          ↓           ↓        ↓
      {{BUILD}} {{TEST}} {{SCAN}}   {{DEPLOY}} {{MONITOR}}
```

## Monitoring & Observability

### Key Metrics
- {{METRIC_1}}: {{METRIC_1_DESC}}
- {{METRIC_2}}: {{METRIC_2_DESC}}
- {{METRIC_3}}: {{METRIC_3_DESC}}

### Logging Strategy
- **Log Level**: {{LOG_LEVEL}}
- **Log Storage**: {{LOG_STORAGE}}
- **Log Retention**: {{LOG_RETENTION}}

## Future Considerations

### Scalability Plan
- {{SCALE_CONSIDERATION_1}}
- {{SCALE_CONSIDERATION_2}}
- {{SCALE_CONSIDERATION_3}}

### Technical Debt
- [ ] {{TECH_DEBT_1}}
- [ ] {{TECH_DEBT_2}}
- [ ] {{TECH_DEBT_3}}

## Validation Script

Save as `.claude/test-architecture.ts`:

```typescript
import { validateArchitecture } from '.claude/scripts/validate-architecture';

async function test() {
  const checks = [
    'Entry point exists',
    'All services initialized',
    'External integrations configured',
    'Security layers implemented',
    'Performance targets met'
  ];
  
  const results = await validateArchitecture(checks);
  console.log(`Architecture validation: ${results.passed}/${results.total}`);
}

test();
```

---

## Template Instructions

1. **Variables to Replace**: ~40 variables
2. **Required Sections**: All sections marked with variables
3. **Optional Sections**: Details within <details> tags
4. **Customization Time**: ~45 minutes
5. **Validation**: Run test script after completion