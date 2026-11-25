const assert = require('node:assert/strict');
const Module = require('node:module');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

// The VS Code API the extension modules use. Tests replace its methods with t.mock.method.
const vscode = {
  CancellationError: class CancellationError extends Error {},
  EventEmitter: class {
    listeners = new Set();
    event = callback => {
      this.listeners.add(callback);
      return { dispose: () => this.listeners.delete(callback) };
    };
    fire(value) { for (const callback of this.listeners) callback(value); }
    dispose() { this.listeners.clear(); }
  },
  ThemeColor: class {},
  Uri: { parse: value => ({ toString: () => value }) },
  commands: {
    registerCommand: () => ({ dispose() {} }),
    executeCommand: async () => {},
  },
  env: { openExternal: async () => true },
  window: {
    showErrorMessage: async () => {},
    registerWebviewViewProvider: () => ({ dispose() {} }),
    onDidChangeActiveTextEditor: () => ({ dispose() {} }),
    onDidChangeVisibleTextEditors: () => ({ dispose() {} }),
    visibleTextEditors: [],
    tabGroups: { all: [], onDidChangeTabs: () => ({ dispose() {} }) },
  },
  TabInputText: class {},
  workspace: { workspaceFolders: [{ uri: { fsPath: process.cwd() } }] },
};

/** Loads a compiled module from out/ with `vscode` resolved to the stub. Run `npm run compile:extension` first. */
const requireOut = path => {
  const load = Module._load;
  Module._load = function (id, ...args) {
    return id === 'vscode' ? vscode : load.call(this, id, ...args);
  };
  try {
    return require(join(__dirname, '../../out', path));
  } finally {
    Module._load = load;
  }
};

/** Waits for a condition, failing after 3 seconds. */
const until = async predicate => {
  const deadline = Date.now() + 3000;
  while (!await predicate()) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for test condition');
    await delay(10);
  }
};

module.exports = { vscode, requireOut, until };
