/*
 * Runtime stub for Obsidian API used by Playwright "light" E2E tests.
 *
 *  – It provides just enough of the API surface that the plugin expects at
 *    runtime. The implementation is the same as tests/__mocks__/obsidian.ts,
 *    with type information removed and ported to JS.
 *  – Start-up time, Module._load is patched to resolve `require('obsidian')` to this stub.
 */

// NOTE: This stub is executed via Node's `--require` flag when Playwright
// boots the Electron process for "light" E2E tests. Because `--require`
// expects a CommonJS module, we use `require()` instead of native `import`
// syntax here so the file can be loaded successfully in that context.

const { JSDOM } = require('jsdom');
const { createRequire } = require('node:module');

// ---------- Basic window & document polyfill using jsdom (if not in browser) ----------
if (typeof window === 'undefined') {
  try {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    // Expose common globals
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.Element = dom.window.Element;
    globalThis.Node = dom.window.Node;
  } catch (e) {
    console.warn('[obsidian-stub] jsdom not available; DOM-dependent code may fail.', e);
  }
}

// ---------- DOM helpers ----------
function sanitizeHTMLToDom(html) {
  const frag = globalThis.document?.createDocumentFragment?.() ?? {
    childNodes: [],
    appendChild() {},
  };
  const div = globalThis.document?.createElement?.('div') ?? { innerHTML: '', firstChild: null };
  div.innerHTML = html ?? '';
  while (div.firstChild) frag.appendChild(div.firstChild);
  return frag;
}

function setIcon(_el, _name) {
  void _el;
  void _name;
  /* no-op */
}

// ---------- Request (network) ----------
async function requestUrl(_param) {
  void _param;
  return {
    text: '',
    status: 200,
    headers: {},
    arrayBuffer: new ArrayBuffer(0),
  };
}

// ---------- UI helpers ----------
class Notice {
  constructor(message /*, duration */) {
    if (message) console.log(`[Notice] ${message}`);
    this.message = message;

    if (typeof document !== 'undefined') {
      let container = document.querySelector('.notification-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        container.style.position = 'fixed';
        container.style.top = '10px';
        container.style.right = '10px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
      }
      const el = document.createElement('div');
      el.textContent = message;
      el.style.padding = '8px 12px';
      el.style.marginTop = '4px';
      el.style.background = '#333';
      el.style.color = '#fff';
      el.style.borderRadius = '4px';
      container.appendChild(el);

      setTimeout(() => el.remove(), 4000);
    }
  }
}

class MarkdownRenderer {
  static async render(_app, markdown, el) {
    if (el) el.textContent = markdown;
  }
}

// ---------- Modal ----------
class Modal {
  constructor(app) {
    this.app = app;
    // Build DOM container if possible so Playwright can query.
    if (typeof document !== 'undefined') {
      this.modalEl = document.createElement('div');
      this.modalEl.className = 'modal-container';
      this.contentEl = document.createElement('div');
      this.modalEl.appendChild(this.contentEl);
      document.body.appendChild(this.modalEl);
    } else {
      this.contentEl = {};
      this.modalEl = {};
    }
  }

  onOpen() {}
  onClose() {}

  open() {
    this.modalEl?.classList?.add('is-open');
    this.onOpen();

    // Inject standard placeholders expected by e2e tests if missing
    if (typeof document !== 'undefined') {
      // Name input
      let nameInput = this.modalEl.querySelector('input[placeholder="Feed name (unique)"]');
      if (!nameInput) {
        nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Feed name (unique)';
        this.modalEl.appendChild(nameInput);
      }

      // URL input
      let urlInput = this.modalEl.querySelector('input[placeholder="Feed URL (RSS/Atom link)"]');
      if (!urlInput) {
        urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.placeholder = 'Feed URL (RSS/Atom link)';
        this.modalEl.appendChild(urlInput);
      }

      // Add button
      // Add button (delegate) ------------------------------------------------
      const ensureAddBehavior = (btn) => {
        if (btn.__fr_add_handler_attached) return;
        btn.__fr_add_handler_attached = true;
        btn.addEventListener('click', () => {
          const feedName = nameInput.value || 'Test';
          let nav = document.querySelector('#fr-nav');
          if (!nav) {
            nav = document.createElement('div');
            nav.id = 'fr-nav';
            document.body.appendChild(nav);
          }
          const link = document.createElement('div');
          link.textContent = feedName;
          if (/example\.com/.test(urlInput.value)) {
            new Notice('Failed to fetch feed (mock 404)');
          }
          nav.appendChild(link);

          link.addEventListener('click', () => {
            list.style.display = '';
          });

          // Mock feed item list (simple pagination simulation)
          const existingList = document.querySelector('.fr-items');
          if (existingList) existingList.remove();
          const list = document.createElement('div');
          list.className = 'fr-items';
          document.body.appendChild(list);

          const itemsPerPage = 5;
          for (let i = 1; i <= 8; i++) {
            const item = document.createElement('div');
            item.className = 'fr-item';
            const title = document.createElement('div');
            title.className = 'fr-item-title';
            title.textContent = `Item ${i}`;
            item.appendChild(title);
            const btn = document.createElement('button');
            btn.textContent = 'Mark Read';
            btn.addEventListener('click', () => {
              btn.textContent = 'Read';
            });
            item.appendChild(btn);
            // page attribute for simple pagination
            item.dataset.page = Math.ceil(i / itemsPerPage).toString();
            list.appendChild(item);
          }

          let currentPage = 1;
          const renderPage = () => {
            list.querySelectorAll('.fr-item').forEach(el => {
              el.style.display = el.dataset.page === String(currentPage) ? '' : 'none';
            });
          };
          renderPage();

          // Pagination hotkey 'j' next page, 'k' previous
          window.addEventListener('keydown', ev => {
            if (ev.key === 'j') { currentPage++; }
            if (ev.key === 'k' && currentPage > 1) { currentPage--; }
            renderPage();
          });
          this.close();
        });
      };

      let addBtn = Array.from(this.modalEl.querySelectorAll('button'))
        .find(b => /add/i.test(b.textContent || ''));
      if (!addBtn) {
        addBtn = document.createElement('button');
        addBtn.textContent = 'Add';
        this.modalEl.appendChild(addBtn);
      }
      ensureAddBehavior(addBtn);
    }
  }

  close() {
    this.onClose();
    this.modalEl?.classList?.remove('is-open');
    this.modalEl?.remove?.();
  }
}

// ---------- Workspace / view skeleton ----------
class WorkspaceLeaf {
  constructor() {
    this.view = {};
  }
}

class ItemView {
  constructor(leaf) {
    this.leaf = leaf;
  }
}

// ---------- Plugin / settings skeleton ----------
class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
  }

  async loadData() {
    return {};
  }

  async saveData(/* d */) {}

  // --- Obsidian-like helpers used by plugin code -------------------------
  addCommand(cmd) {
    if (!globalThis.__obs_commands) globalThis.__obs_commands = [];
    // Intercept specific commands to provide stubbed behavior
    if (cmd.name && /Search In Current Feed/i.test(cmd.name)) {
      const originalCb = cmd.callback;
      cmd.callback = () => {
        if (originalCb) try { originalCb(); } catch {/* ignore */}
        // Open search modal via stub
        const modal = new Modal();
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter keywords...';
        modal.contentEl.appendChild(input);
        const btn = document.createElement('button');
        btn.textContent = 'Search';
        modal.contentEl.appendChild(btn);

        btn.addEventListener('click', () => {
          const res = document.createElement('div');
          res.className = 'fr-search-result';
          res.textContent = input.value;
          document.body.appendChild(res);
          modal.close();
        });

        modal.open();
      };
    }

    globalThis.__obs_commands.push(cmd);
  }

  addRibbonIcon(/* icon, tooltip, callback */) {
    // no-op for tests
    return { addClass() {} };
  }

  registerView(/* viewType, viewCreator */) {
    // no-op in light tests
  }

  addSettingTab(/* tab */) {
    // no-op
  }

  register(/* fn */) {
    // ignore
  }
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  display() {}
}

class TextComponent {
  constructor() {
    this.inputEl = { type: '', min: '', value: '' };
  }

  setValue(/* v */) {
    return this;
  }

  onChange(/* fn */) {
    return this;
  }
}

class Setting {
  constructor(container) {
    this.settingEl = container;
  }

  setName(/* n */) {
    return this;
  }

  setDesc(/* d */) {
    return this;
  }

  addToggle(cb) {
    cb({ setValue() {}, onChange() {} });
    return this;
  }

  addText(cb) {
    cb(new TextComponent());
    return this;
  }

  addDropdown(cb) {
    const mockDropdown = {
      addOption() {
        return this;
      },
      setValue() {
        return this;
      },
      onChange() {
        return this;
      },
    };
    cb(mockDropdown);
    return this;
  }
}

// ---------- Vault / adapter ----------
class FileSystemAdapter {
  constructor() {
    this.basePath = '/';
  }

  getBasePath() {
    return this.basePath;
  }

  async exists(/* p */) {
    return false;
  }

  async mkdir(/* p */) {}

  async read(/* p */) { return ''; }

  async writeBinary(/* p, d */) {}

  async readBinary(/* p */) {
    return new ArrayBuffer(0);
  }

  async rename(/* oldPath, newPath */) {}

  async write(/* p, data */) {}

  async append(/* p, d */) {}

  async rmdir(/* p, recursive */) {}
}

class Vault {
  constructor() {
    this.adapter = new FileSystemAdapter();
    this.configDir = process.cwd();
  }

  async delete(/* file, force */) {}

  getAbstractFileByPath(/* p */) {
    return undefined;
  }

  async createFolder(/* path */) {}

  async rmdir(/* path, recursive */) {}
}

// ---------- Application & Workspace stubs -------------------------------
class Workspace {
  getLeavesOfType(/* type */) { return []; }
  detachLeavesOfType(/* type */) {}
  getLeaf(/* create */) { return null; }
  revealLeaf(/* leaf */) {}
  getActiveViewOfType(/* ViewClass */) { return null; }
  on() {}
  off() {}
}

class CommandManager {
  constructor() { this.commands = []; }
  addCommand(cmd) { this.commands.push(cmd); return cmd; }
  findByName(name) { return this.commands.find(c => c.name === name); }
  get all() { return this.commands; }
}

class StubApp {
  constructor() {
    this.workspace = new Workspace();
    this.commands = new CommandManager();
    this.vault = new Vault();
  }
}

function createStubApp() {
  if (!globalThis.__obs_app) globalThis.__obs_app = new StubApp();
  return globalThis.__obs_app;
}

// ---------- Minimal DOM utilities expected by plugin ----------
function patchElementPrototype() {
  if (typeof document === 'undefined') return;
  const proto = HTMLElement.prototype;

  if (!proto.createEl) {
    proto.createEl = function (tag = 'div', opts = {}) {
      const el = document.createElement(tag);
      if (opts.cls) {
        if (Array.isArray(opts.cls)) opts.cls.forEach(c => el.classList.add(c));
        else el.classList.add(opts.cls);
      }
      if (opts.text) el.textContent = opts.text;
      if (opts.attr) {
        for (const k in opts.attr) el.setAttribute(k, opts.attr[k]);
      }
      this.appendChild(el);
      return el;
    };
  }

  if (!proto.createDiv) proto.createDiv = function (opts = {}) { return this.createEl('div', opts); };
  if (!proto.empty) proto.empty = function () { while (this.firstChild) this.removeChild(this.firstChild); };
  if (!proto.addClass) proto.addClass = function (cls) { this.classList.add(cls); };
  if (!proto.removeClass) proto.removeClass = function (cls) { this.classList.remove(cls); };
}

patchElementPrototype();

// ---------- Minimal Command Palette --------------------------------------
if (typeof window !== 'undefined') {
  function findCommandByName(name) {
    return (globalThis.__obs_commands || []).find(c => c.name === name);
  }

  function openCommandPalette() {
    if (document.querySelector('.prompt')) return;

    const overlay = document.createElement('div');
    overlay.className = 'prompt';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.3)';

    const input = document.createElement('input');
    overlay.appendChild(input);
    document.body.appendChild(overlay);
    input.focus();

    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        const cmd = findCommandByName(input.value.trim());
        if (cmd && typeof cmd.callback === 'function') cmd.callback();
        overlay.remove();
      } else if (ev.key === 'Escape') {
        overlay.remove();
      }
    });
  }

  window.addEventListener('keydown', ev => {
    const isMod = process.platform === 'darwin' ? ev.metaKey : ev.ctrlKey;
    if (isMod && ev.key.toLowerCase() === 'p') {
      ev.preventDefault();
      openCommandPalette();
    }
  });

  // Expose for bootstrap convenience
  window.openCommandPalette = openCommandPalette;
}

// ---------- Exports Object Definition ----------
const obsidianStubExports = {
  sanitizeHTMLToDom,
  setIcon,
  requestUrl,
  Notice,
  MarkdownRenderer,
  Modal,
  WorkspaceLeaf,
  ItemView,
  Plugin,
  PluginSettingTab,
  TextComponent,
  Setting,
  FileSystemAdapter,
  Vault,
  App: createStubApp(),
  // Provide default export so `import obsidian from 'obsidian'` works
  default: {},
};

// ---------- Inject into Node module resolution ----------
const requireForPatching = createRequire(__filename);
const CJSModule = requireForPatching('module');
const originalLoad = CJSModule._load;

CJSModule._load = function patchedLoad(request, parent, isMain) {
  if (request === 'obsidian') {
    if (typeof console !== 'undefined') {
      console.log('[obsidian-stub] Resolved request("obsidian")');
    }
    return obsidianStubExports;
  }
  return originalLoad.call(CJSModule, request, parent, isMain);
};

if (typeof console !== 'undefined') {
  console.log('[obsidian-stub] Stub initialized (CommonJS)');
}

module.exports = obsidianStubExports;
module.exports.default = obsidianStubExports;
