# Security Guide for Obsidian Feed Plugin

This guide provides comprehensive security guidelines for contributors and reviewers of the Obsidian Feed plugin.

## Security Philosophy

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Only request permissions actually needed
3. **Fail Secure**: When in doubt, deny access
4. **Zero Trust**: Validate all inputs, even from "trusted" sources

## Threat Model

### Primary Threats
- **Malicious Feed Content**: XSS, script injection via RSS/Atom feeds
- **Path Traversal**: Accessing files outside the vault
- **API Key Exposure**: Leaking user credentials
- **CORS Bypass**: Unauthorized network access
- **Resource Exhaustion**: DoS via large feeds or infinite loops

### Trust Boundaries
- User vault boundary (must not escape)
- Network abstraction layer
- Plugin settings storage
- External feed content

## Security Controls by Component

### 1. Network Layer (`/src/network/`)

#### Allowed Operations
- HTTP(S) requests via Obsidian's `requestUrl` API
- Optional CORS proxy usage (must be user-configurable)

#### Security Requirements
```typescript
// Always validate URLs before fetching
const allowedProtocols = ['http:', 'https:'];
const url = new URL(feedUrl); // Throws on invalid URL
if (!allowedProtocols.includes(url.protocol)) {
  throw new Error('Invalid protocol');
}

// Set reasonable timeouts
const response = await requestUrl({
  url: feedUrl,
  timeout: 30000, // 30 seconds max
  headers: {
    'User-Agent': 'Obsidian-Feed-Reader/1.0',
  }
});

// Validate response size
if (response.arrayBuffer.byteLength > 10 * 1024 * 1024) { // 10MB
  throw new Error('Feed too large');
}
```

### 2. Content Parsing (`/src/contentParserService.ts`)

#### HTML Sanitization
```typescript
// REQUIRED: Sanitize all external HTML
import { sanitizeHTMLToDom } from 'obsidian';
import DOMPurify from 'dompurify';

// Option 1: Obsidian's built-in (recommended)
const safe = sanitizeHTMLToDom(untrustedHtml);

// Option 2: DOMPurify with strict config
const clean = DOMPurify.sanitize(untrustedHtml, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style', 'onclick', 'onload']
});
```

#### URL Validation in Content
```typescript
// Validate all URLs in feed content
function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow safe protocols
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return null;
    }
    // Block known tracking domains (optional)
    const blocklist = ['doubleclick.net', 'googleadservices.com'];
    if (blocklist.some(domain => parsed.hostname.includes(domain))) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}
```

### 3. File System Operations

#### Path Validation
```typescript
import { normalizePath } from 'obsidian';
import { normalize, resolve } from 'path';

function ensureInVault(vaultPath: string, requestedPath: string): string {
  // Normalize both paths
  const normalizedVault = normalize(vaultPath);
  const resolved = resolve(normalizedVault, requestedPath);
  
  // Ensure resolved path is within vault
  if (!resolved.startsWith(normalizedVault)) {
    throw new Error('Path traversal attempt blocked');
  }
  
  // Additional Obsidian normalization
  return normalizePath(resolved);
}
```

#### Safe File Operations
```typescript
// Use Obsidian's safe file APIs
async function safeWriteFile(
  vault: Vault,
  path: string,
  content: string
): Promise<void> {
  // Validate path
  const safePath = ensureInVault(vault.adapter.basePath, path);
  
  // Use Obsidian's API, not direct fs access
  await vault.adapter.write(safePath, content);
}
```

### 4. Settings and Secrets

#### Storage Guidelines
```typescript
interface SecureSettings {
  // NEVER store secrets in code
  apiKey?: string; // User-provided, encrypted by Obsidian
  
  // Document security implications
  corsProxy?: string; // WARNING: This sends URLs to third party
  
  // Provide secure defaults
  allowExternalImages: boolean; // Default: false
  maxFeedSize: number; // Default: 5MB
}
```

#### Handling Secrets
```typescript
// NEVER log secrets
function debugLog(message: string, settings: SecureSettings) {
  const sanitized = {
    ...settings,
    apiKey: settings.apiKey ? '[REDACTED]' : undefined
  };
  console.log(message, sanitized);
}

// Validate before use
function validateApiKey(key: string | undefined): boolean {
  if (!key || key.trim().length === 0) {
    new Notice('API key not configured');
    return false;
  }
  // Basic format validation (adjust per API)
  if (!key.match(/^[a-zA-Z0-9_-]{20,}$/)) {
    new Notice('Invalid API key format');
    return false;
  }
  return true;
}
```

### 5. User Interface Security

#### Event Handler Safety
```typescript
// Sanitize user inputs in event handlers
inputEl.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  const sanitized = target.value
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML
    .substring(0, 1000); // Limit length
  
  // Process sanitized value
  processUserInput(sanitized);
});
```

#### Dynamic Content Rendering
```typescript
// Safe dynamic content rendering
function renderFeedItem(container: HTMLElement, item: FeedItem) {
  // Create elements programmatically, not via innerHTML
  const titleEl = container.createEl('h3');
  titleEl.textContent = item.title; // Safe text content
  
  const contentEl = container.createEl('div');
  // Sanitize HTML content before appending
  const sanitized = sanitizeHTMLToDom(item.content);
  contentEl.appendChild(sanitized);
  
  // Safe link creation
  if (item.link && isValidUrl(item.link)) {
    const linkEl = container.createEl('a', {
      href: item.link,
      attr: {
        target: '_blank',
        rel: 'noopener noreferrer' // Prevent window.opener access
      }
    });
    linkEl.textContent = 'Read more';
  }
}
```

## Security Testing

### Manual Testing Checklist
- [ ] Test with malicious feed content (XSS payloads)
- [ ] Attempt path traversal (../../etc/passwd)
- [ ] Submit oversized feeds (>10MB)
- [ ] Use invalid URL protocols (javascript:, file:, data:)
- [ ] Check error messages for information leakage
- [ ] Verify API keys are never logged
- [ ] Test with malformed XML/JSON
- [ ] Check for resource exhaustion (infinite loops)

### Automated Security Checks
```typescript
// Example security test
describe('Security', () => {
  it('should sanitize malicious HTML', () => {
    const malicious = '<script>alert("XSS")</script><p>Safe content</p>';
    const sanitized = sanitizeContent(malicious);
    
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('Safe content');
  });
  
  it('should prevent path traversal', () => {
    const vaultPath = '/vault';
    const maliciousPath = '../../../etc/passwd';
    
    expect(() => {
      ensureInVault(vaultPath, maliciousPath);
    }).toThrow('Path traversal attempt blocked');
  });
});
```

## Incident Response

### If a Security Issue is Found
1. **Do NOT** create a public issue
2. Contact the maintainers privately
3. Provide detailed reproduction steps
4. Allow time for a fix before disclosure

### Security Update Process
1. Fix developed in private branch
2. Security advisory drafted
3. Patch released with minimal details
4. Full disclosure after users have time to update

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Obsidian Plugin Security](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)