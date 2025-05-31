# Obsidian Plugin Patterns

## Common Patterns

### Plugin Lifecycle
```typescript
export default class MyPlugin extends Plugin {
    async onload() {
        // Initialize plugin
    }
    
    async onunload() {
        // Cleanup
    }
}
```

### Settings Management
```typescript
interface MyPluginSettings {
    setting1: string;
    setting2: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    setting1: 'default',
    setting2: false
}
```

### Custom Views
```typescript
class MyView extends ItemView {
    getViewType() { return "my-view"; }
    getDisplayText() { return "My View"; }
    async onOpen() { /* render */ }
    async onClose() { /* cleanup */ }
}
```
