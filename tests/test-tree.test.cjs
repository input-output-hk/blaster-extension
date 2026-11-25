const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const toggles = [];
const load = Module._load;
const extensions = { '.ts': require.extensions['.ts'], '.tsx': require.extensions['.tsx'] };
let TreeViewWorkspace, updateOpenTestTreeNode, getVisibleItems;
try {
  Module._load = function (id, ...args) {
    if (id === '@vscode-elements/react-elements') return { VscodeTreeItem: 'vscode-tree-item' };
    if (id.endsWith('/hooks/useTreeItemState')) return ({ onToggleCollapsed }) => {
      toggles.push(onToggleCollapsed);
      return { current: null };
    };
    return load.call(this, id, ...args);
  };
  for (const extension of Object.keys(extensions)) {
    require.extensions[extension] = (module, filename) => {
      const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      });
      module._compile(outputText, filename);
    };
  }
  TreeViewWorkspace = require('../webview-ui/src/webview/testTree/components/TreeView/TreeViewWorkspace.tsx').default;
  ({ updateOpenTestTreeNode } = require('../webview-ui/src/webview/testTree/utils/treeUpdateUtils.ts'));
  ({ getVisibleItems } = require('../webview-ui/src/webview/testTree/utils/treeUtils.ts'));
} finally {
  Module._load = load;
  for (const [extension, handler] of Object.entries(extensions)) {
    if (handler) require.extensions[extension] = handler;
    else delete require.extensions[extension];
  }
}

for (const hasTests of [false, true]) {
  test(`${hasTests ? 'discovered' : 'error-only'} groups retain expansion in their owning workspace`, () => {
    const group = ['CardanoLedgerApi', 'Ledger', 'Types.lean'];
    const property = {
      id: 'property', workspaceId: 'workspace', name: 'property', group, status: 'empty',
      isRunning: false, isWaiting: false,
      location: { path: group.join('/'), range: { start: { line: 0, character: 0 } } },
    };
    let node = {
      type: 'file', name: group[2], isOpen: false,
      tests: hasTests ? { property } : {}, error: hasTests ? undefined : 'Discovery failed',
    };
    for (const name of group.slice(0, -1).reverse()) {
      node = { type: 'folder', name, isOpen: false, nodes: { [node.name]: node } };
    }
    const workspace = {
      id: 'workspace', path: '/project', isOpen: false, status: 'empty',
      isWaiting: false, isRunning: false, nodes: { [node.name]: node },
    };
    let tree = { workspaces: { workspace } };
    const updates = [];
    toggles.length = 0;
    renderToStaticMarkup(React.createElement(TreeViewWorkspace, {
      workspace, visible: getVisibleItems(tree, {}, { openFiles: new Set() }),
      onRunTest() {}, onFetchTestTree() {}, onOpenTestResult() {}, onContextMenu() {},
      onUpdateOpenTestTreeNode(isOpen, workspaceId, path) {
        updates.push({ isOpen, workspaceId, path });
        tree = updateOpenTestTreeNode(tree, isOpen, workspaceId, path);
      },
    }));

    assert.equal(toggles.length, group.length + 1);
    for (const isOpen of [true, false]) {
      toggles.forEach((toggle, index) => {
        toggle(!isOpen);
        const path = index === 0 ? undefined : group.slice(0, index);
        assert.deepEqual(updates.at(-1), { isOpen, workspaceId: workspace.id, path });
        let updated = tree.workspaces[workspace.id];
        for (const name of path ?? []) updated = updated.nodes[name];
        assert.equal(updated.isOpen, isOpen);
      });
    }
    assert.equal(workspace.isOpen, false);
    assert.equal(workspace.nodes.CardanoLedgerApi.isOpen, false);
  });
}
