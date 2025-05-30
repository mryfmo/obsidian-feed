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

// ---------- DOM helpers ----------
export function sanitizeHTMLToDom(html: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const div = document.createElement('div');
  div.innerHTML = html ?? '';
  while (div.firstChild) frag.appendChild(div.firstChild);
  return frag;
}

export function setIcon(_el: HTMLElement, _name: string): void {
  /* no-op in unit tests */
}

// ---------- Request (network) ----------
export interface RequestUrlParam {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer | FormData;
  timeout?: number;
}

export async function requestUrl(_param: RequestUrlParam): Promise<{
  text: string;
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
}> {
  return {
    text: '',
    status: 200,
    headers: {},
    arrayBuffer: new ArrayBuffer(0),
  };
}

// ---------- UI helpers ----------
export class Notice {
  constructor(
    public message?: string,
    _duration?: number
  ) {
    if (message) console.log(`[Notice] ${message}`);
  }
}

// Minimal App type placeholder for a more specific type if available from Obsidian API
export type App = Record<string, unknown>;

export class MarkdownRenderer {
  static async render(_app: App, markdown: string, el: HTMLElement): Promise<void> {
    el.textContent = markdown; // simplistic – strips formatting
  }
}

// ---------- Workspace / view skeleton ----------
// Minimal View type placeholder
export type View = Record<string, unknown>;

export class WorkspaceLeaf {
  view: View;
}

export class ItemView {
  constructor(public leaf: WorkspaceLeaf) {}
}

// ---------- Plugin / settings skeleton ----------
export interface PluginManifest {
  id: string;
  dir: string;
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

  async saveData(_d: unknown) {}
}

export class PluginSettingTab {
  constructor(
    public app: App,
    public plugin: Plugin
  ) {}

  display() {}
}

export class TextComponent {
  inputEl = { type: '', min: '', value: '' };

  setValue(_v: string): TextComponent {
    return this;
  }

  onChange(_fn: (v: string) => void): TextComponent {
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

  setName(_n: string) {
    return this;
  }

  setDesc(_d: string) {
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
      addOption(_value: string, _display: string): DropdownComponent {
        return this;
      },
      setValue(_value: string): DropdownComponent {
        return this;
      },
      onChange(_callback: (value: string) => void): DropdownComponent {
        return this;
      },
    };
    cb(mockDropdown);
    return this;
  }
}

// ---------- Vault / adapter ----------
export type TAbstractFile = Record<string, unknown>; // Placeholder type

export class FileSystemAdapter {
  basePath = '/';

  getBasePath() {
    return this.basePath;
  }

  async exists(_p: string) {
    return false;
  }

  async mkdir(_p: string) {}

  async writeBinary(_p: string, _d: ArrayBuffer) {}

  async readBinary(_p: string) {
    return new ArrayBuffer(0);
  }

  async rename(_oldPath: string, _newPath: string) {}

  async write(_p: string, _data: string) {}

  async append(_p: string, _d: string) {}
}

export class Vault {
  adapter = new FileSystemAdapter();

  async delete(_file: TAbstractFile, _force?: boolean) {}

  getAbstractFileByPath(_p: string) {
    return undefined;
  }
}

// Export types used only for typing in tests so that `import { Vault, TFolder, PluginManifest } from 'obsidian'` succeeds.
// They don't require runtime behavior.
export type TFolder = Record<string, unknown>;

// Default export (some code uses `import obsidian from 'obsidian'`)
export default {};
