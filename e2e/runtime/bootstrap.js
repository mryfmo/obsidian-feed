/*
 * Electron "main" script used by Playwright light-E2E.
 *
 * What it does:
 *   1. Creates a BrowserWindow with nodeIntegration **enabled** and loads an
 *      empty HTML document.
 *   2. Specifies a preload script (renderer-preload.js) which is executed in
 *      the renderer process **before** any web content runs. The preload
 *      script replaces `require('obsidian')` with a stub and loads the plugin
 *      bundle (../../main.js) and calls plugin.onload().
 *   3. Does nothing else.
 */

const path = require('node:path');
const { app, BrowserWindow } = require('electron');

// Set absolute path
const PRELOAD_SCRIPT = path.resolve(__dirname, 'renderer-preload.js');

let mainWindow;

/**
 *  Launch a BrowserWindow for the renderer process.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: PRELOAD_SCRIPT,
    },
  });

  // Load an empty HTML document.
  mainWindow.loadURL('data:text/html,<html><head><title>Test</title></head><body></body></html>');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
