/*
 * Runtime stub for the Obsidian API used in **unit-test** context.
 *
 *  • Provides only the classes / functions that are actually referenced by the
 *    plugin source or the vitest suites so the bundler can resolve imports.
 *  • Behavior is intentionally minimal – business logic should be validated
 *    at a higher layer (integration / e2e tests running against real
 *    Obsidian).
 *
 * Reference: https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
 */

// ---------- HTMLElement extensions ----------
// Extend HTMLElement prototype with Obsidian-specific methods
declare global {
  interface HTMLElement {
    empty(): this;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      options?: { text?: string; cls?: string; attr?: Record<string, string> }
    ): HTMLElementTagNameMap[K];
    createDiv(options?: { cls?: string; text?: string }): HTMLDivElement;
    appendText(text: string): this;
  }
}

// Add the methods to HTMLElement prototype
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.empty = function() {
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
    return this;
  };

  HTMLElement.prototype.createEl = function<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: { text?: string; cls?: string; attr?: Record<string, string> }
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (options?.text) el.textContent = options.text;
    if (options?.cls) el.className = options.cls;
    if (options?.attr) {
      Object.entries(options.attr).forEach(([key, value]) => {
        el.setAttribute(key, value);
      });
    }
    this.appendChild(el);
    return el;
  };

  HTMLElement.prototype.createDiv = function(options?: { cls?: string; text?: string }): HTMLDivElement {
    return this.createEl('div', options);
  };

  HTMLElement.prototype.appendText = function(text: string): HTMLElement {
    this.appendChild(document.createTextNode(text));
    return this;
  };
}

// ---------- DOM helpers ----------
export function sanitizeHTMLToDom(html: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const div = document.createElement('div');
  div.innerHTML = html ?? '';
  while (div.firstChild) frag.appendChild(div.firstChild);
  return frag;
}

export function setIcon(element: HTMLElement, iconName: string): void {
  // In a real implementation, this would add an icon to the element
  element.setAttribute('data-icon', iconName);
}

// ---------- Request (network) ----------
export interface RequestUrlParam {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer | FormData;
  timeout?: number;
}

export async function requestUrl(param: RequestUrlParam): Promise<{
  text: string;
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
}> {
  // Mock implementation returns successful response
  return {
    text: `Response for ${param.url}`,
    status: 200,
    headers: { 'content-type': 'text/plain' },
    arrayBuffer: new ArrayBuffer(0),
  };
}

// ---------- UI helpers ----------

// Extend HTMLElement with Obsidian's custom methods
interface ObsidianHTMLElement extends HTMLElement {
  empty(): ObsidianHTMLElement;
  createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: {
      text?: string;
      cls?: string;
      attr?: Record<string, string>;
      type?: string;
    }
  ): HTMLElementTagNameMap[K];
  createDiv(options?: { text?: string; cls?: string }): HTMLDivElement;
}

function createObsidianElement(): ObsidianHTMLElement {
  const el = document.createElement('div');

  // Type-safe extension of HTMLElement
  const obsidianEl = el as HTMLDivElement & ObsidianHTMLElement;

  obsidianEl.empty = function () {
    this.innerHTML = '';
    return this;
  };

  obsidianEl.createEl = function <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: {
      text?: string;
      cls?: string;
      attr?: Record<string, string>;
      type?: string;
    }
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (options?.text) element.textContent = options.text;
    if (options?.cls) element.className = options.cls;
    if (options?.attr) {
      Object.entries(options.attr).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
    if (options?.type && 'type' in element) {
      (element as HTMLInputElement).type = options.type;
    }

    // Add Obsidian methods to created elements
    const extendedElement = element as typeof element & ObsidianHTMLElement;
    extendedElement.empty = this.empty;
    extendedElement.createEl = this.createEl;
    extendedElement.createDiv = this.createDiv;

    this.appendChild(element);
    return element as HTMLElementTagNameMap[K];
  };

  obsidianEl.createDiv = function (options?: { text?: string; cls?: string }): HTMLDivElement {
    return this.createEl('div', options);
  };

  return obsidianEl;
}

// ---------- Scope for keymaps ----------
export interface KeymapEventHandler {
  modifiers: string[] | null;
  key: string;
  func: () => void;
}

export class Scope {
  constructor(public parent?: Scope) {}

  register(modifiers: string[] | null, key: string, func: () => void): void {
    // Store the key binding for potential verification in tests
    console.log('Registering key binding:', { modifiers, key, func });
    // In real implementation, this would register the keyboard shortcut
  }

  unregister(handler: unknown): void {
    // In real implementation, this would remove the registered handler
    if (handler) {
      // Placeholder for unregistration logic
    }
  }
}

// ---------- Keymap ----------
export class Keymap {
  private scopes: Scope[] = [];

  pushScope(scope: Scope): void {
    this.scopes.push(scope);
  }

  popScope(scope: Scope): void {
    const index = this.scopes.indexOf(scope);
    if (index >= 0) {
      this.scopes.splice(index, 1);
    }
  }
}

// ---------- Classes without dependencies ----------

export class Notice {
  constructor(
    public message?: string,
    duration?: number
  ) {
    if (message) {
      console.log(`[Notice] ${message}`);
      // In real implementation, duration controls how long the notice is shown
      if (duration) {
        setTimeout(() => {}, duration);
      }
    }
  }
}

export class TextComponent {
  inputEl: HTMLInputElement;

  constructor() {
    this.inputEl = document.createElement('input');
  }

  setValue(value: string): TextComponent {
    this.inputEl.value = value;
    return this;
  }

  onChange(callback: (value: string) => void): TextComponent {
    // Store callback for input changes
    const input = this.inputEl;
    input.addEventListener?.('change', () => callback(input.value));
    return this;
  }
}

// Placeholder for DropdownComponent type
export interface DropdownComponent {
  addOption(value: string, display: string): this;
  setValue(value: string): this;
  onChange(callback: (value: string) => void): this;
}

export class Setting {
  settingEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.settingEl = container;
  }

  setName(name: string) {
    this.settingEl.setAttribute('data-name', name);
    return this;
  }

  setDesc(description: string) {
    this.settingEl.setAttribute('data-desc', description);
    return this;
  }

  addToggle(
    cb: (t: {
      setValue: (v: boolean) => void;
      onChange: (fn: (v: boolean) => void) => void;
    }) => void
  ) {
    cb({ setValue() {}, onChange() {} });
    return this;
  }

  addText(cb: (t: TextComponent) => void) {
    cb(new TextComponent());
    return this;
  }

  addDropdown(cb: (component: DropdownComponent) => void) {
    const mockDropdown: DropdownComponent = {
      addOption(value: string, display: string): DropdownComponent {
        // Store option for potential test verification
        console.log('Adding option:', { value, display });
        return this;
      },
      setValue(value: string): DropdownComponent {
        // Store current value
        console.log('Setting dropdown value:', value);
        return this;
      },
      onChange(callback: (value: string) => void): DropdownComponent {
        // Store callback for dropdown changes
        const currentValue = '';
        setTimeout(() => callback(currentValue), 0);
        return this;
      },
    };
    cb(mockDropdown);
    return this;
  }
}

// ---------- Workspace / view skeleton ----------
// Minimal View type placeholder
export type View = Record<string, unknown>;

export class WorkspaceLeaf {
  view: View;

  constructor() {
    this.view = {};
  }
}

export class ItemView {
  constructor(public leaf: WorkspaceLeaf) {}
}

// ---------- Plugin / settings skeleton ----------
export interface PluginManifest {
  id: string;
  dir: string;
}

// Workspace type for proper typing
export class Workspace {
  activeLeaf: WorkspaceLeaf | null = null;
}

// ---------- Vault / adapter ----------
// Type definitions first
export class FileSystemAdapter {
  basePath = '/';

  getBasePath() {
    return this.basePath;
  }

  async exists(path: string) {
    // Mock implementation: check if path is in a predefined list
    return path === this.basePath || false;
  }

  async mkdir(path: string) {
    // Mock implementation: log directory creation
    console.log(`Creating directory: ${path}`);
  }

  async writeBinary(path: string, data: ArrayBuffer) {
    // Mock implementation: log binary write
    console.log(`Writing ${data.byteLength} bytes to ${path}`);
  }

  async readBinary(path: string) {
    // Mock implementation: return empty buffer for any path
    console.log(`Reading binary from ${path}`);
    return new ArrayBuffer(0);
  }

  async rename(oldPath: string, newPath: string) {
    // Mock implementation: log rename operation
    console.log(`Renaming ${oldPath} to ${newPath}`);
  }

  async write(path: string, data: string) {
    // Mock implementation: log write operation
    console.log(`Writing ${data.length} characters to ${path}`);
  }

  async append(path: string, data: string) {
    // Mock implementation: log append operation
    console.log(`Appending ${data.length} characters to ${path}`);
  }
}

export class Vault {
  adapter = new FileSystemAdapter();

  async delete(file: TAbstractFile, force?: boolean): Promise<void> {
    console.log(`Deleting file ${force ? 'forcefully' : 'normally'}`, file);
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    console.log(`Looking for file at ${path}`);
    return null;
  }
}

export abstract class TAbstractFile {
  path: string = '';

  name: string = '';

  parent: TFolder | null = null;

  declare vault: Vault;
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];

  isRoot(): boolean {
    return this.parent === null;
  }
}

// ---------- App and dependent classes ----------
export class App {
  keymap: Keymap = new Keymap();

  scope: Scope = new Scope();

  workspace: Workspace = new Workspace();

  vault: Vault = new Vault();
}

export class Modal {
  app: App;

  scope: Scope;

  containerEl: HTMLElement;

  modalEl: HTMLElement;

  titleEl: HTMLElement;

  contentEl: ObsidianHTMLElement;

  shouldRestoreSelection = false;

  constructor(app: App) {
    this.app = app;
    this.scope = new Scope();

    // Create DOM structure
    this.modalEl = document.createElement('div');
    this.containerEl = document.createElement('div');
    this.titleEl = document.createElement('div');
    this.contentEl = createObsidianElement();

    this.modalEl.appendChild(this.containerEl);
    this.containerEl.appendChild(this.titleEl);
    this.containerEl.appendChild(this.contentEl);
  }

  open(): void {
    this.onOpen();
  }

  close(): void {
    this.onClose();
  }

  onOpen(): void {
    // Override in subclass
  }

  onClose(): void {
    // Override in subclass
  }
}

export class MarkdownRenderer {
  static async render(app: App, markdown: string, el: HTMLElement): Promise<void> {
    // Use app context for rendering (in real implementation)
    if (app.workspace) {
      el.textContent = markdown; // simplistic – strips formatting
    }
  }
}

export class Plugin {
  public app: App;

  public manifest: PluginManifest;

  constructor(app: App, manifest: PluginManifest) {
    this.app = app;
    this.manifest = manifest;
  }

  async loadData() {
    return {};
  }

  async saveData<T extends Record<string, unknown>>(data: T) {
    // In real implementation, this would persist data
    console.log('Saving data:', data);
  }
}

export class PluginSettingTab {
  containerEl: HTMLElement;

  constructor(
    public app: App,
    public plugin: Plugin
  ) {
    this.containerEl = document.createElement('div');
  }

  display() {}
}

// Default export (some code uses `import obsidian from 'obsidian'`)
export default {};
