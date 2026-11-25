const assert = require('node:assert/strict');
const { test } = require('node:test');

const { vscode, requireOut, until } = require('./helpers/extension.cjs');

const TestTreeView = requireOut('modules/testTreeView').default;

const TREE = { workspaces: { workspace: {
  id: 'workspace', path: '/project', nodes: {}, status: 'empty', isOpen: false, isWaiting: false, isRunning: false,
} } };

const COMMANDS = [
  'blaster-extension.refreshTestTree', 'blaster-extension.runAllTests', 'blaster-extension.stopAllTests',
  'blaster-extension.clearAllTests', 'blaster-extension.collapseAllTests', 'blaster-extension.showOutput',
];

/** A promise the test settles by hand. */
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
};

const setup = t => {
  const providers = new Map();
  const commands = new Map();
  const contexts = new Map();
  const executed = [];
  const notifications = [];
  const output = [];
  let notificationAction;
  t.mock.method(vscode.window, 'registerWebviewViewProvider', (id, provider) => {
    providers.set(id, provider);
    return { dispose() {} };
  });
  t.mock.method(vscode.commands, 'registerCommand', (name, handler) => {
    commands.set(name, handler);
    return { dispose() {} };
  });
  t.mock.method(vscode.commands, 'executeCommand', async (name, ...args) => {
    if (name === 'setContext') contexts.set(args[0], args[1]);
    else executed.push([name, ...args]);
  });
  t.mock.method(vscode.window, 'showErrorMessage', async (message, ...actions) => {
    notifications.push({ message, actions });
    return notificationAction;
  });
  const openExternal = t.mock.method(vscode.env, 'openExternal', async () => true);

  const treeUpdates = new vscode.EventEmitter();
  const actionStates = new vscode.EventEmitter();
  const store = {
    onTestTreeUpdate: treeUpdates.event,
    onActionStateUpdate: actionStates.event,
    getActionState: () => ({ isBusy: false }),
    getTestTree: t.mock.fn(async () => structuredClone(TREE)),
    fetchTestTree: t.mock.fn(async () => structuredClone(TREE)),
    getIsBlasterMissing: t.mock.fn(() => false),
    getDiscoveryError: t.mock.fn(() => undefined),
    getDiscoveryFileErrors: t.mock.fn(() => []),
    runTests: t.mock.fn(async () => {}),
    runAllTests: t.mock.fn(async () => {}),
    stopAll: t.mock.fn(),
    collapseTestTree: t.mock.fn(),
    clearTestResults: t.mock.fn(async () => {}),
    updateOpenTestTreeNode: t.mock.fn(),
  };
  const context = {
    extension: { subscriptions: [], extensionUri: {} },
    testStore: store,
    testResultView: { open: t.mock.fn() },
    outputChannel: { appendLine: line => output.push(line), show: t.mock.fn() },
    statusBarItem: { text: '', show: t.mock.fn(), hide: t.mock.fn() },
  };
  const view = new TestTreeView();
  view.activate(context);

  /** Resolves the registered view the way VS Code does, and records what it posts. */
  const open = () => {
    const messages = [];
    let receive;
    let dispose;
    providers.get('blaster-test-tree').onResolve({
      postMessage: async message => { messages.push(message); return true; },
      onDidReceiveMessage: callback => { receive = callback; },
    }, { onDidDispose: callback => { dispose = callback; } });
    return {
      messages,
      receive: message => receive(message),
      dispose: () => dispose(),
      sent: type => messages.filter(message => message.type === type),
    };
  };

  return {
    view, store, context, providers, commands, contexts, executed, notifications, output, openExternal,
    treeUpdates, actionStates, open, setNotificationAction: action => { notificationAction = action; },
  };
};

const settled = view => until(() => view.pendingFetch === null);

test('activation registers the view, its commands and its listeners, with nothing shown yet', t => {
  const { providers, commands, contexts, context } = setup(t);
  assert.deepEqual([...providers.keys()], ['blaster-test-tree']);
  assert.deepEqual([...commands.keys()].sort(), [...COMMANDS].sort());
  // The provider, six commands, three editor listeners and the action state listener
  assert.equal(context.extension.subscriptions.length, 11);
  assert.equal(contexts.get('blaster.testTreeBusy'), false);
});

test('webview-ready sends the action state, the cached tree and the editor files', async t => {
  const { view, store, open } = setup(t);
  const webview = open();
  webview.receive({ type: 'webview-ready' });
  await until(() => webview.sent('test-tree').length === 1);
  assert.deepEqual(webview.sent('test-tree-action-state').map(message => message.payload), [{ isBusy: false }]);
  assert.deepEqual(webview.sent('test-tree')[0].payload.testTree, TREE);
  assert.deepEqual(webview.sent('editor-files')[0].payload, { activeFile: undefined, openFiles: [] });
  assert.equal(store.fetchTestTree.mock.callCount(), 0);
  assert.equal(view.pendingFetch, null);
});

test('the first load discovers the tree when none is cached', async t => {
  const { view, store, open } = setup(t);
  store.getTestTree.mock.mockImplementation(async () => undefined);
  const webview = open();
  webview.receive({ type: 'webview-ready' });
  await until(() => store.fetchTestTree.mock.callCount() === 1);
  await settled(view);
  assert.deepEqual(webview.sent('test-tree').map(message => message.payload.testTree), [TREE]);
});

test('Refresh without an open view does nothing', t => {
  const { store, commands } = setup(t);
  commands.get('blaster-extension.refreshTestTree')();
  assert.equal(store.fetchTestTree.mock.callCount(), 0);
});

test('requests during a fetch share it, and the next request fetches again', async t => {
  const { view, store, commands, open } = setup(t);
  const discovery = deferred();
  store.fetchTestTree.mock.mockImplementation(() => discovery.promise);
  const webview = open();
  webview.receive({ type: 'test-tree-fetch' });
  webview.receive({ type: 'test-tree-fetch' });
  commands.get('blaster-extension.refreshTestTree')();
  // A pending fetch posts its own result, so loading the cache waits for it
  webview.receive({ type: 'webview-ready' });
  assert.equal(store.fetchTestTree.mock.callCount(), 1);
  assert.equal(store.getTestTree.mock.callCount(), 0);

  discovery.resolve(structuredClone(TREE));
  await settled(view);
  assert.equal(webview.sent('test-tree').length, 1);

  store.fetchTestTree.mock.mockImplementation(async () => structuredClone(TREE));
  webview.receive({ type: 'test-tree-fetch' });
  await settled(view);
  assert.equal(store.fetchTestTree.mock.callCount(), 2);
});

test('a discovery failure shows the error screen, and a retry recovers', async t => {
  const { view, store, notifications, output, open } = setup(t);
  store.fetchTestTree.mock.mockImplementation(async () => { throw new Error('lake failed'); });
  const webview = open();
  webview.receive({ type: 'test-tree-fetch' });
  await settled(view);
  assert.equal(webview.sent('test-tree-error').length, 1);
  assert.deepEqual(output, ['> ERROR: Property discovery failed: lake failed']);
  assert.deepEqual(notifications, []);

  store.fetchTestTree.mock.mockImplementation(async () => structuredClone(TREE));
  webview.receive({ type: 'test-tree-fetch' });
  await settled(view);
  assert.deepEqual(webview.messages.at(-1), { type: 'test-tree', payload: { testTree: TREE } });
});

test('a stored error is shown instead of the cached tree', async t => {
  const { store, context, open } = setup(t);
  store.getDiscoveryError.mock.mockImplementation(() => 'lake failed');
  const webview = open();
  webview.receive({ type: 'webview-ready' });
  assert.equal(webview.sent('test-tree-error').length, 1);
  assert.equal(store.getTestTree.mock.callCount(), 0);

  store.getIsBlasterMissing.mock.mockImplementation(() => true);
  webview.receive({ type: 'webview-ready' });
  assert.equal(webview.sent('test-tree-dependency-error').length, 1);
  assert.equal(context.statusBarItem.text, '$(error) Dependency Error');
  assert.equal(store.getTestTree.mock.callCount(), 0);
});

test('a missing lean-blaster shows the dependency screen, and a refresh clears its status bar item', async t => {
  const { view, store, context, output, open } = setup(t);
  store.fetchTestTree.mock.mockImplementation(async () => undefined);
  const webview = open();
  webview.receive({ type: 'test-tree-fetch' });
  await settled(view);
  assert.equal(webview.sent('test-tree-dependency-error').length, 1);
  assert.deepEqual(output, ['> ERROR: lean-blaster not found on PATH']);
  assert.equal(context.statusBarItem.show.mock.callCount(), 1);

  store.fetchTestTree.mock.mockImplementation(async () => structuredClone(TREE));
  webview.receive({ type: 'test-tree-fetch' });
  assert.equal(context.statusBarItem.hide.mock.callCount(), 1);
  await settled(view);
});

test('a cancelled fetch shows the cached tree again, without an error', async t => {
  const { view, store, notifications, output, open } = setup(t);
  store.fetchTestTree.mock.mockImplementation(async () => { throw new vscode.CancellationError(); });
  const webview = open();
  webview.receive({ type: 'test-tree-fetch' });
  await settled(view);
  assert.deepEqual(webview.messages.map(message => message.type), ['test-tree']);
  assert.deepEqual(output, []);
  assert.deepEqual(notifications, []);
});

for (const action of ['Show Output', undefined]) {
  test(`file errors name each file once, and ${action ? 'Show Output opens' : 'dismissing leaves'} the output`, async t => {
    const { view, store, context, notifications, open, setNotificationAction } = setup(t);
    setNotificationAction(action);
    store.getDiscoveryFileErrors.mock.mockImplementation(() => [
      { workspaceId: 'workspace', group: ['Ledger', 'Types.lean'], message: 'first' },
      { workspaceId: 'workspace', group: ['Ledger', 'Types.lean'], message: 'second' },
      { workspaceId: 'workspace', group: ['Main.lean'], message: 'third' },
    ]);
    const webview = open();
    webview.receive({ type: 'test-tree-fetch' });
    await settled(view);
    assert.equal(webview.sent('test-tree').length, 1);
    assert.deepEqual(notifications, [{
      message: 'Property Discovery Error: An error occurred in Types.lean, Main.lean. View output for more details.',
      actions: ['Show Output'],
    }]);
    await new Promise(setImmediate);
    assert.deepEqual(context.outputChannel.show.mock.calls.map(call => call.arguments), action ? [[true]] : []);
  });
}

test('incoming messages reach the store, the result view and VS Code with their payloads', async t => {
  const { store, context, executed, openExternal, open } = setup(t);
  const webview = open();
  const testRuns = [{ workspaceId: 'workspace', tests: [{ uri: 'Main.lean', ids: ['5:1'] }] }];
  webview.receive({ type: 'test-tree-run', payload: { testRuns } });
  webview.receive({ type: 'test-tree-open-result', payload: { workspaceId: 'workspace', testId: 'c' } });
  webview.receive({ type: 'test-tree-update-open-state', payload: { isOpen: true, workspaceId: 'workspace', group: ['Ledger'] } });
  webview.receive({ type: 'test-tree-open-folder' });
  webview.receive({ type: 'test-tree-open-install-guide' });

  assert.deepEqual(store.runTests.mock.calls.map(call => call.arguments), [[testRuns]]);
  assert.deepEqual(context.testResultView.open.mock.calls.map(call => call.arguments), [['workspace', 'c']]);
  assert.deepEqual(store.updateOpenTestTreeNode.mock.calls.map(call => call.arguments), [[true, 'workspace', ['Ledger']]]);
  assert.deepEqual(executed, [['vscode.openFolder']]);
  assert.equal(openExternal.mock.calls[0].arguments[0].toString(),
    'https://github.com/input-output-hk/Lean-blaster/blob/997d25b4b3d91b39213992275ccec7a45af780ae/docs/cli.md');
});

test('commands reach the store, and Clear and Collapse send the updated tree', async t => {
  const { store, context, commands, open } = setup(t);
  const webview = open();
  commands.get('blaster-extension.runAllTests')();
  commands.get('blaster-extension.stopAllTests')();
  commands.get('blaster-extension.showOutput')();
  assert.equal(store.runAllTests.mock.callCount(), 1);
  assert.equal(store.stopAll.mock.callCount(), 1);
  assert.deepEqual(context.outputChannel.show.mock.calls.map(call => call.arguments), [[true]]);

  commands.get('blaster-extension.collapseAllTests')();
  assert.equal(store.collapseTestTree.mock.callCount(), 1);
  await until(() => webview.sent('test-tree').length === 1);

  commands.get('blaster-extension.clearAllTests')();
  await until(() => webview.sent('test-tree').length === 2);
  assert.equal(store.clearTestResults.mock.callCount(), 1);
});

test('failed actions report the error without leaving the tree, and cancelled ones stay silent', async t => {
  const { store, commands, notifications, output, open } = setup(t);
  const webview = open();
  store.runTests.mock.mockImplementation(async () => { throw new Error('run failed'); });
  store.clearTestResults.mock.mockImplementation(async () => { throw new Error('clear failed'); });
  store.runAllTests.mock.mockImplementation(async () => { throw new vscode.CancellationError(); });
  webview.receive({ type: 'test-tree-run', payload: { testRuns: [] } });
  commands.get('blaster-extension.clearAllTests')();
  commands.get('blaster-extension.runAllTests')();
  await until(() => notifications.length === 2);
  await new Promise(setImmediate);

  assert.deepEqual(output, ['> ERROR: run failed', '> ERROR: clear failed']);
  assert.deepEqual(notifications.map(notification => notification.message), ['run failed', 'clear failed']);
  assert.deepEqual(webview.sent('test-tree-error'), []);
});

test('Clear and Collapse wait for a pending fetch, and show a stored error instead of the tree', async t => {
  const { view, store, commands, open } = setup(t);
  const discovery = deferred();
  store.fetchTestTree.mock.mockImplementation(() => discovery.promise);
  const webview = open();
  webview.receive({ type: 'test-tree-fetch' });
  commands.get('blaster-extension.collapseAllTests')();
  assert.equal(store.getTestTree.mock.callCount(), 0);
  discovery.resolve(structuredClone(TREE));
  await settled(view);
  assert.equal(webview.sent('test-tree').length, 1);

  store.getDiscoveryError.mock.mockImplementation(() => 'lake failed');
  commands.get('blaster-extension.clearAllTests')();
  await until(() => webview.sent('test-tree-error').length === 1);
  assert.equal(store.getTestTree.mock.callCount(), 0);
});

test('a failed tree read after Clear shows the error screen', async t => {
  const { store, commands, notifications, output, open } = setup(t);
  store.getTestTree.mock.mockImplementation(async () => { throw new Error('database closed'); });
  const webview = open();
  commands.get('blaster-extension.clearAllTests')();
  await until(() => webview.sent('test-tree-error').length === 1);
  assert.deepEqual(output, ['> ERROR: database closed']);
  assert.deepEqual(notifications.map(notification => notification.message), ['database closed']);
});

test('a failed Open Folder is reported', async t => {
  const { notifications, output, open } = setup(t);
  vscode.commands.executeCommand.mock.mockImplementation(async name => {
    if (name === 'vscode.openFolder') throw new Error('no folder picker');
  });
  open().receive({ type: 'test-tree-open-folder' });
  await until(() => notifications.length === 1);
  assert.deepEqual(output, ['> ERROR: no folder picker']);
});

test('a cancelled first load shows an empty tree', async t => {
  const { view, store, open } = setup(t);
  store.getTestTree.mock.mockImplementation(async () => undefined);
  store.fetchTestTree.mock.mockImplementation(async () => { throw new vscode.CancellationError(); });
  const webview = open();
  webview.receive({ type: 'test-tree-fetch' });
  await settled(view);
  assert.deepEqual(webview.messages, [{ type: 'test-tree', payload: { testTree: { workspaces: {} } } }]);
});

test('a discovery error after the view closes is only logged', async t => {
  const { view, store, output, open } = setup(t);
  const discovery = deferred();
  store.fetchTestTree.mock.mockImplementation(() => discovery.promise);
  const webview = open();
  webview.receive({ type: 'test-tree-fetch' });
  webview.dispose();
  discovery.reject(new Error('lake failed'));
  await settled(view);
  assert.deepEqual(output, ['> ERROR: Property discovery failed: lake failed']);
  assert.deepEqual(webview.messages, []);
});

test('a failed tree read shows the error screen', async t => {
  const { store, notifications, output, open } = setup(t);
  store.getTestTree.mock.mockImplementation(async () => { throw new Error('database closed'); });
  const webview = open();
  webview.receive({ type: 'webview-ready' });
  await until(() => webview.sent('test-tree-error').length === 1);
  assert.deepEqual(output, ['> ERROR: database closed']);
  assert.deepEqual(notifications.map(notification => notification.message), ['database closed']);
});

test('updates reach only an open view, and stop when it closes', async t => {
  const { store, treeUpdates, actionStates, commands, open } = setup(t);
  const update = { type: 'test', test: { id: 'a' } };
  treeUpdates.fire(update);
  actionStates.fire({ isBusy: true });
  commands.get('blaster-extension.collapseAllTests')();
  await new Promise(setImmediate);
  assert.equal(store.getTestTree.mock.callCount(), 1);

  const webview = open();
  treeUpdates.fire(update);
  actionStates.fire({ isBusy: true });
  assert.deepEqual(webview.messages, [
    { type: 'test-tree-update', payload: update },
    { type: 'test-tree-action-state', payload: { isBusy: true } },
  ]);

  webview.dispose();
  treeUpdates.fire(update);
  actionStates.fire({ isBusy: false });
  commands.get('blaster-extension.refreshTestTree')();
  assert.equal(webview.messages.length, 2);
  assert.equal(store.fetchTestTree.mock.callCount(), 0);
});

test('editor files list the open text tabs and the active file', async t => {
  const { open } = setup(t);
  const textTab = path => {
    const input = new vscode.TabInputText();
    input.uri = { fsPath: path };
    return { input };
  };
  const original = { active: vscode.window.activeTextEditor, groups: vscode.window.tabGroups.all };
  t.after(() => {
    vscode.window.activeTextEditor = original.active;
    vscode.window.tabGroups.all = original.groups;
  });
  vscode.window.activeTextEditor = { document: { uri: { fsPath: '/project/Main.lean' } } };
  vscode.window.tabGroups.all = [
    { tabs: [textTab('/project/Main.lean'), { input: { notText: true } }] },
    { tabs: [textTab('/project/Ledger/Types.lean')] },
  ];
  const webview = open();
  webview.receive({ type: 'webview-ready' });
  assert.deepEqual(webview.sent('editor-files')[0].payload, {
    activeFile: '/project/Main.lean', openFiles: ['/project/Main.lean', '/project/Ledger/Types.lean'],
  });
});
