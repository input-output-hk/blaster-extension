import { vi } from 'vitest';

import type { WebviewApi } from 'vscode-webview';

/** Builds a test at a 0-based source line, named after its id. */
export const makeTest = (id: string, group: Array<string>, line: number, overrides: Partial<Test> = {}): Test => ({
  id,
  name: id,
  group,
  workspaceId: 'workspace',
  status: 'empty',
  isWaiting: false,
  isRunning: false,
  location: { path: `/project/${group.join('/')}`, range: { start: { line, character: 0 }, end: { line: line + 1, character: 0 } } },
  ...overrides,
});

export const makeFile = (name: string, tests: Array<Test>, overrides: Partial<TestTreeFileNode> = {}): TestTreeFileNode => ({
  type: 'file',
  name,
  isOpen: false,
  tests: Object.fromEntries(tests.map(test => [test.id, test])),
  ...overrides,
});

export const makeFolder = (name: string, nodes: Array<TestTreeGroupNode>): TestTreeFolderNode => ({
  type: 'folder',
  name,
  isOpen: false,
  nodes: Object.fromEntries(nodes.map(node => [node.name, node])),
});

export const makeWorkspace = (nodes: Array<TestTreeGroupNode>, overrides: Partial<TestTreeWorkspaceNode> = {}): TestTreeWorkspaceNode => ({
  id: 'workspace',
  path: '/home/user/project',
  status: 'empty',
  isWaiting: false,
  isRunning: false,
  isOpen: false,
  nodes: Object.fromEntries(nodes.map(node => [node.name, node])),
  ...overrides,
});

/**
 * A two-level tree: `Ledger/Types.lean` with tests `a` and `b`, and `Main.lean` with test `c`.
 * Rebuilt on every call, so tests can compare against an untouched copy.
 */
export const makeTree = () => {
  const a = makeTest('a', ['Ledger', 'Types.lean'], 2);
  const b = makeTest('b', ['Ledger', 'Types.lean'], 9);
  const c = makeTest('c', ['Main.lean'], 4);
  const types = makeFile('Types.lean', [a, b]);
  const ledger = makeFolder('Ledger', [types]);
  const main = makeFile('Main.lean', [c]);
  const workspace = makeWorkspace([ledger, main]);
  const tree: TestTree = { workspaces: { workspace } };
  return { tree, workspace, ledger, types, main, a, b, c };
};

/** Returns every workspace, group and test in the tree, as the unfiltered tree shows them. */
export const allItems = (tree: TestTree): Set<VisibleItem> => {
  const items = new Set<VisibleItem>();
  const addGroup = (node: TestTreeGroupNode) => {
    items.add(node);
    if (node.type === 'folder') Object.values((node as TestTreeFolderNode).nodes).forEach(addGroup);
    else Object.values((node as TestTreeFileNode).tests).forEach(test => items.add(test));
  };
  for (const workspace of Object.values(tree.workspaces)) {
    items.add(workspace);
    Object.values(workspace.nodes).forEach(addGroup);
  }
  return items;
};

/** A webview bridge that records the messages the view sends to the extension. */
export const makeWebviewApi = () => {
  const postMessage = vi.fn<(message: WebviewToExtensionMessage) => void>();
  const api = { postMessage, getState: vi.fn(), setState: vi.fn() } as unknown as WebviewApi<unknown>;
  return { api, postMessage };
};

/** Returns the tree row that shows this text. */
export const getRow = (container: HTMLElement, text: string): HTMLElement => {
  const label = Array.from(container.querySelectorAll<HTMLElement>('[data-node-name]'))
    .find(element => element.firstChild?.textContent === text);
  if (!label) throw new Error(`No tree row named ${text}`);
  return label.closest('vscode-tree-item') as HTMLElement;
};

/** Returns the row's own action button with this tooltip, or null; nested rows are not searched. */
export const getAction = (row: HTMLElement, tooltip: string): HTMLButtonElement | null =>
  row.querySelector<HTMLButtonElement>(`:scope > span > button[data-tooltip-content="${tooltip}"]`);

// MutationObserver reports in a microtask, so a macrotask has seen every report
export const flush = () => new Promise(resolve => setTimeout(resolve, 0));
