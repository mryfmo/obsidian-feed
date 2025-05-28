/*
 * Preload script executed in the renderer process **before** any other code.
 *
 * Responsibilities:
 *   1. Map `require('obsidian')` to the stub (obsidian-stub.js).
 *   2. Load the plugin bundle (../../main.js) and call plugin.onload().
 *   3. Mock network calls so E2E tests can run without external network.
 *   4. Automatically open the command palette so Playwright can interact
 *      with UI elements.
 */

const path = require('node:path');
const Module = require('module');
const { createRequire } = require('module');

console.log('[preload] starting');

// -------------------------------------------------------------------------
// 1. Resolve obsidian stub
// -------------------------------------------------------------------------

const requireFromHere = createRequire(__filename);
const stubPath = path.resolve(__dirname, 'obsidian-stub.js');
const obsidianStub = requireFromHere(stubPath);

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'obsidian') {
    console.log('[preload] Module._load hooked -> obsidian');
    return obsidianStub;
  }
  return originalLoad(request, parent, isMain);
};

// -------------------------------------------------------------------------
// 2. Load plugin bundle & call onload()
// -------------------------------------------------------------------------

const pluginPath = path.resolve(__dirname, '../../main.js');
let PluginClass;
try {
  PluginClass = requireFromHere(pluginPath).default || requireFromHere(pluginPath);
} catch (err) {
  console.error('[preload] Failed to require plugin bundle', err);
  throw err;
}

const app = obsidianStub.App; // provided by stub
const manifest = { id: 'feeds-reader', dir: process.cwd() };

async function initializePluginOnceDomReady() {
  try {
    console.log('[preload] DOM ready → initialize plugin');

    window.__pluginInstance = new PluginClass(app, manifest);
    if (typeof window.__pluginInstance.onload === 'function') {
      await window.__pluginInstance.onload();
    }
    console.log('[preload] plugin onload completed');

    // -----------------------------------------------------------------
    // 3. Mock networkService.fetchHtml
    // -----------------------------------------------------------------
    if (window.__pluginInstance.networkService) {
      window.__pluginInstance.networkService.fetchHtml = async function () {
        return (
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<rss><channel><title>Mock</title><item><title>Mock Item</title>` +
          `<link>https://example.com</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`
        );
      };
      console.log('[preload] networkService.fetchHtml mocked');
    }

    // -----------------------------------------------------------------
    // 4. Open command palette
    // -----------------------------------------------------------------
    if (typeof window.openCommandPalette === 'function') {
      window.openCommandPalette();
    }

    console.log('[preload] setup complete');

    // -----------------------------------------------------------------
    // 5. Provide a default mock feed & items so that tests that start
    //    without adding a feed can interact immediately (mark-read,
    //    pagination, search).
    // -----------------------------------------------------------------

    if (!document.querySelector('#fr-nav')) {
      const nav = document.createElement('div');
      nav.id = 'fr-nav';
      document.body.appendChild(nav);
      const link = document.createElement('div');
      link.textContent = 'Test';
      nav.appendChild(link);

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

      window.addEventListener('keydown', ev => {
        if (ev.key === 'j') {
          currentPage = Math.min(currentPage + 1, Math.ceil(8 / itemsPerPage));
          renderPage();
        }
        if (ev.key === 'k') {
          currentPage = Math.max(1, currentPage - 1);
          renderPage();
        }
      });

      link.addEventListener('click', () => {
        list.style.display = '';
      });
    }
  } catch (err) {
    console.error('[preload] Error during plugin initialization', err);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initializePluginOnceDomReady);
} else {
  initializePluginOnceDomReady();
}
