const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const childProcess = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { join } = require('node:path');

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
  commands: {
    registerCommand: () => ({ dispose() {} }),
    executeCommand: async () => {},
  },
  window: {
    showErrorMessage: async () => {},
    registerWebviewViewProvider: () => ({ dispose() {} }),
  },
  workspace: { workspaceFolders: [{ uri: { fsPath: process.cwd() } }] },
};
const load = Module._load;
Module._load = function (id, ...args) {
  return id === 'vscode' ? vscode : load.call(this, id, ...args);
};
const TestStore = require('../out/services/testStore').default;
const TestTreeView = require('../out/modules/testTreeView').default;
Module._load = load;

const until = async predicate => {
  const deadline = Date.now() + 3000;
  while (!await predicate()) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for test condition');
    await delay(10);
  }
};

const makeTree = () => {
  const tests = ['A.lean:1:1', 'A.lean:2:1', 'B.lean:1:1'].map(id => {
    const [file, line] = id.split(':');
    return {
      id, name: id, workspaceId: 'workspace', group: [file],
      status: 'empty', isWaiting: false, isRunning: false,
      location: {
        path: join(process.cwd(), file),
        range: { start: { line: Number(line) - 1, character: 0 }, end: { line: Number(line), character: 0 } },
      },
    };
  });
  const nodes = {};
  for (const item of tests) {
    (nodes[item.group[0]] ??= { type: 'file', name: item.group[0], tests: {}, isOpen: false }).tests[item.id] = item;
  }
  return {
    tests,
    tree: { workspaces: { workspace: {
      id: 'workspace', path: process.cwd(), nodes, status: 'empty',
      isRunning: false, isWaiting: false, isOpen: false,
    } } },
  };
};

const result = (file, line = 1) => ({
  event: 'result',
  result: {
    property: 'property', location: { file, line, column: 1 }, status: 'valid',
    expectedStatus: null, elapsedMs: 10, reason: null,
  },
});

const setup = async t => {
  const output = [];
  const errors = [];
  t.mock.method(vscode.window, 'showErrorMessage', async message => { errors.push(message); });
  const context = {
    extension: { subscriptions: [] },
    outputChannel: { appendLine: line => output.push(line), append() {}, show() {} },
    statusBarItem: { hide() {}, show() {} },
  };
  const store = new TestStore(context.extension);
  context.testStore = store;
  await store.initialize(context);
  t.after(async () => {
    store.stopAll();
    if (!store.actionQueue.idle()) await store.actionQueue.drain();
    await store.database.database.remove();
    for (const subscription of context.extension.subscriptions) subscription.dispose();
  });
  const { tree, tests } = makeTree();
  store.command.workspaces.set('workspace', { id: 'workspace', path: process.cwd() });
  store.command.tests.set('workspace', tests);
  t.mock.method(store.command, 'checkDependencies', async () => true);
  t.mock.method(store.command, 'discover', async () => ({ testTree: structuredClone(tree), fileErrors: [] }));
  await store.fetchTestTree();
  return { store, context, output, errors };
};

for (const diagnosticsFirst of [false, true]) {
  test(`incomplete proofs become invalid with diagnostics ${diagnosticsFirst ? 'before' : 'after'} results`, async t => {
    const { store, errors } = await setup(t);
    store.command.discover.mock.restore();
    const file = 'A.lean';
    const location = (line, column = 1) => ({ file, line, column });
    const sites = [
      { name: 'incomplete', start: 1, stop: 5, line: 3, status: 'undetermined' },
      { name: 'valid', start: 5, stop: 9, line: 7, status: 'valid' },
      { name: 'unknown', start: 9, stop: 13, line: 11, status: 'undetermined' },
      { name: 'firstTactic', start: 13, stop: 19, line: 15, status: 'valid' },
      { name: 'lastTactic', start: 13, stop: 19, line: 17, status: 'undetermined' },
      { name: 'unreported', start: 19, stop: 23, line: 21 },
    ];
    const discoveries = sites.map(site => ({ event: 'discovery', item: {
      kind: 'tactic', name: site.name,
      invocationRange: { start: location(site.line), stop: location(site.line, 8) },
      bodyRange: { start: location(site.start), stop: location(site.stop) },
    } }));
    const results = sites.filter(site => site.status).map(site => ({
      ...result(file, site.line),
      result: { ...result(file, site.line).result, status: site.status },
    }));
    results.push(result(file, 3));
    const diagnostic = (position, severity = 'error', message = 'unsolved goals\nremaining goal') => ({
      event: 'diagnostic', diagnostic: { severity, message, location: position },
    });
    const diagnostics = [
      diagnostic(location(2)),
      diagnostic(location(14)),
      diagnostic(location(20)),
      diagnostic(location(6), 'warning'),
      diagnostic({ ...location(6), file: 'Other.lean' }),
      diagnostic(location(10), 'error', 'unknown identifier'),
      diagnostic(location(23)),
      diagnostic(null),
    ];
    const spawn = childProcess.spawn;
    t.mock.method(childProcess, 'spawn', (command, args, options) => {
      assert.equal(command, 'lean-blaster');
      const discovering = args[0] === 'discover';
      const code = discovering ? 0 : 4;
      const events = discovering ? discoveries
        : diagnosticsFirst ? [...diagnostics, ...results] : [...results, ...diagnostics];
      const script = `
        for (const event of ${JSON.stringify([...events, { event: 'complete', exitCode: code }])})
          console.log(JSON.stringify({ schemaVersion: 1, ...event }));
        process.exitCode = ${code};
      `;
      return spawn(process.execPath, ['-e', script], options);
    });

    const discovered = await store.fetchTestTree();
    const workspaceId = Object.keys(discovered.workspaces)[0];
    await store.runAllTests();
    const tree = await store.getTestTree();
    const workspace = tree.workspaces[workspaceId];
    const tests = Object.values(workspace.nodes[file].tests);
    assert.deepEqual(Object.fromEntries(tests.map(item => [item.name, item.status])), {
      incomplete: 'invalid', valid: 'valid', unknown: 'undetermined',
      firstTactic: 'invalid', lastTactic: 'invalid', unreported: 'invalid',
    });
    assert.equal(tests.find(item => item.name === 'incomplete').time, 20);
    assert.equal(workspace.status, 'invalid');
    assert.ok(tests.every(item => !item.isRunning && !item.isWaiting));
    assert.match(errors[0], /Proof Execution Failed: A\.lean: unsolved goals/);
  });
}

test('runs, discovery and clearing are FIFO and wait for result persistence', async t => {
  const { store } = await setup(t);
  const gate = Promise.withResolvers();
  const actions = [];
  store.onActionStateUpdate(state => {
    if (state.currentAction) actions.push(state.currentAction.type);
  });
  const update = store.database.handleTestUpdateEvent.bind(store.database);
  let persisting = false;
  t.mock.method(store.database, 'handleTestUpdateEvent', async event => {
    if (event.payload.status === 'valid') {
      persisting = true;
      await gate.promise;
    }
    return update(event);
  });
  t.mock.method(store.command, 'exec', async (args, cwd, emit) => {
    emit(result(args[1]));
    if (args[1].endsWith('A.lean')) emit(result(args[1], 2));
    return 0;
  });

  const run = store.runAllTests();
  const refresh = store.fetchTestTree();
  const clear = store.clearTestResults();
  try {
    await until(() => persisting);
    assert.equal(store.getActionState().currentAction.type, 'run');
    assert.equal(store.command.discover.mock.callCount(), 1);
    assert.equal(store.actionQueue.length(), 2);
  } finally {
    gate.resolve();
  }
  await Promise.all([run, refresh, clear]);
  assert.deepEqual([...new Set(actions)], ['run', 'fetch', 'clear']);
  assert.equal(store.getActionState().isBusy, false);
  assert.equal(store.getActionState().run, undefined);
  assert.equal((await store.getTestResult('workspace', 'A.lean:1:1')).test.status, 'empty');
});

test('Stop All kills the process tree, drops pending actions, keeps received results and allows another run',
  { skip: process.platform === 'win32' }, async t => {
    const { store, context, output, errors } = await setup(t);
    const processes = [];
    const spawn = childProcess.spawn;
    t.mock.method(childProcess, 'spawn', (command, args, options) => {
      assert.equal(command, 'lean-blaster');
      const script = `
        const { spawn } = require('node:child_process');
        const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
        const send = event => console.log(JSON.stringify({ schemaVersion: 1, ...event }));
        send(${JSON.stringify(result(args[1]))});
        send({ event: 'diagnostic', diagnostic: {
          severity: 'info', message: 'descendant:' + descendant.pid, location: null
        } });
        setTimeout(() => send(${JSON.stringify(result(args[1], 2))}), 1000);
        setInterval(() => {}, 1000);
      `;
      const child = spawn(process.execPath, ['-e', script], options);
      processes.push(child);
      return child;
    });
    const commands = new Map();
    const contexts = new Map();
    t.mock.method(vscode.commands, 'registerCommand', (name, handler) => {
      commands.set(name, handler);
      return { dispose() {} };
    });
    t.mock.method(vscode.commands, 'executeCommand', async (name, key, value) => {
      if (name === 'setContext') contexts.set(key, value);
    });
    const view = new TestTreeView();
    view.activate(context);

    const run = store.runAllTests();
    await until(async () => output.some(line => line.includes('descendant:'))
      && (await store.getTestResult('workspace', 'A.lean:1:1')).test.status === 'valid');
    const descendant = Number(output.find(line => line.includes('descendant:')).split('descendant:')[1]);
    t.after(() => {
      try { process.kill(descendant, 'SIGKILL'); } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    });
    assert.equal(contexts.get('blaster.testTreeBusy'), true);
    const startedAt = store.getActionState().run.startedAt;

    const messages = [];
    let receive;
    view.onWebviewResolved({
      postMessage: message => { messages.push(message); return Promise.resolve(true); },
      onDidReceiveMessage: callback => { receive = callback; },
    }, { onDidDispose() {} });
    receive({ type: 'webview-ready' });
    assert.equal(messages.find(message => message.type === 'test-tree-action-state').payload.run.startedAt, startedAt);

    const pending = [store.runAllTests(), store.fetchTestTree(), store.clearTestResults()];
    const settled = Promise.allSettled([run, ...pending]);
    commands.get('blaster-extension.stopAllTests')();
    assert.equal(store.actionQueue.length(), 0);
    assert.equal(store.getActionState().currentAction.isCancelling, true);
    const outcomes = await settled;
    assert.ok(outcomes.every(outcome => outcome.status === 'rejected' && outcome.reason instanceof vscode.CancellationError));
    assert.equal(processes.length, 1);
    assert.notEqual(processes[0].signalCode, null);
    await until(() => {
      try { process.kill(descendant, 0); return false; } catch (error) {
        if (error.code === 'ESRCH') return true;
        throw error;
      }
    });
    assert.equal(store.command.discover.mock.callCount(), 1);
    assert.equal(contexts.get('blaster.testTreeBusy'), false);
    assert.ok(store.getActionState().run.finishedAt >= startedAt);
    assert.deepEqual(errors, []);
    const tree = await store.getTestTree();
    const tests = Object.values(tree.workspaces.workspace.nodes).flatMap(node => Object.values(node.tests));
    assert.deepEqual(tests.map(item => item.status), ['valid', 'empty', 'empty']);
    assert.ok(tests.every(item => !item.isRunning && !item.isWaiting));
    assert.equal(tree.workspaces.workspace.isRunning, false);
    assert.equal(tree.workspaces.workspace.isWaiting, false);

    t.mock.method(store.command, 'exec', async (args, cwd, emit) => {
      emit(result(args[1]));
      if (args[1].endsWith('A.lean')) emit(result(args[1], 2));
      return 0;
    });
    await store.runAllTests();
    assert.equal((await store.getTestResult('workspace', 'B.lean:1:1')).test.status, 'valid');
    await store.clearTestResults();
    assert.equal(store.getActionState().run, undefined);
  });

test('cancelling discovery preserves the cached tree without a discovery error', async t => {
  const { store } = await setup(t);
  const original = await store.getTestTree();
  t.mock.method(store.command, 'discover', signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const discovery = store.fetchTestTree();
  const rejected = assert.rejects(discovery, vscode.CancellationError);
  await until(() => store.getActionState().currentAction?.type === 'fetch');
  store.stopAll();
  await rejected;
  assert.equal(store.getDiscoveryError(), undefined);
  assert.deepEqual(await store.getTestTree(), original);
  assert.equal(store.getActionState().isBusy, false);
});

test('Stop All before a worker starts settles discarded promises without running them', async t => {
  const { store } = await setup(t);
  const runs = t.mock.method(store.command, 'runTests', async () => assert.fail('Cancelled run started'));
  const pending = [store.runAllTests(), store.fetchTestTree(), store.clearTestResults()];
  const settled = Promise.allSettled(pending);
  store.stopAll();
  assert.equal(store.actionQueue.length(), 0);
  assert.ok((await settled).every(outcome => outcome.status === 'rejected'));
  assert.equal(runs.mock.callCount(), 0);
  assert.equal(store.getActionState().isBusy, false);
});

test('persistence errors reject the run and release the queue with no stuck busy flags', async t => {
  const { store } = await setup(t);
  t.mock.method(store.command, 'exec', async () => 0);
  t.mock.method(store.database, 'handleTestUpdateEvent', async () => {
    throw new Error('Result write failed');
  });
  const run = assert.rejects(store.runAllTests(), /Result write failed/);
  const clear = store.clearTestResults();
  await Promise.all([run, clear]);
  assert.equal(store.getActionState().isBusy, false);
  const tree = await store.getTestTree();
  assert.equal(tree.workspaces.workspace.isWaiting, false);
  assert.equal(tree.workspaces.workspace.isRunning, false);
});

test('a missing lean-blaster skips discovery and keeps the cached tree', async t => {
  const { store } = await setup(t);
  const original = await store.getTestTree();
  store.command.checkDependencies.mock.mockImplementation(async () => false);
  assert.equal(await store.fetchTestTree(), undefined);
  assert.equal(store.getIsBlasterMissing(), true);
  assert.equal(store.getDiscoveryError(), undefined);
  assert.equal(store.command.discover.mock.callCount(), 1);
  assert.deepEqual(await store.getTestTree(), original);
});

test('the dependency check runs inside the queued fetch, before later actions', async t => {
  const { store } = await setup(t);
  const gate = Promise.withResolvers();
  store.command.checkDependencies.mock.mockImplementation(() => gate.promise);
  const runs = t.mock.method(store.command, 'runTests', async () => {});
  const refresh = store.fetchTestTree();
  const run = store.runAllTests();
  try {
    await until(() => store.command.checkDependencies.mock.callCount() === 2);
    assert.equal(store.getActionState().isBusy, true);
    assert.equal(store.getActionState().currentAction.type, 'fetch');
    assert.equal(store.actionQueue.length(), 1);
    assert.equal(runs.mock.callCount(), 0);
  } finally {
    gate.resolve(true);
  }
  await Promise.all([refresh, run]);
  assert.equal(store.command.discover.mock.callCount(), 2);
  assert.equal(runs.mock.callCount(), 1);
});

test('Stop All during the dependency check kills it without a discovery error',
  { skip: process.platform === 'win32' }, async t => {
    const { store } = await setup(t);
    store.command.checkDependencies.mock.restore();
    const execFile = childProcess.execFile;
    let child;
    t.mock.method(childProcess, 'execFile', (command, args, options, callback) => {
      assert.equal(command, 'lean-blaster');
      child = execFile(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], options, callback);
      return child;
    });
    let settled = false;
    const refresh = assert.rejects(store.fetchTestTree(), vscode.CancellationError).finally(() => { settled = true; });
    await until(() => child !== undefined && child.pid !== undefined);
    store.stopAll();
    // Settles well before the probe's own 10 s timeout
    await until(() => settled);
    await refresh;
    await until(() => child.exitCode !== null || child.signalCode !== null);
    assert.equal(child.signalCode, 'SIGKILL');
    assert.equal(store.command.discover.mock.callCount(), 1);
    assert.equal(store.getDiscoveryError(), undefined);
    assert.equal(store.getIsBlasterMissing(), false);
    assert.equal(store.getActionState().isBusy, false);
  });

test('cancelling a retry from the missing screen restores the screen and status bar', async t => {
  const { store, context } = await setup(t);
  Object.assign(context.statusBarItem, {
    text: '',
    visible: false,
    show() { this.visible = true; },
    hide() { this.visible = false; },
  });
  const view = new TestTreeView();
  view.activate(context);
  const messages = [];
  let receive;
  view.onWebviewResolved({
    postMessage: message => { messages.push(message); return Promise.resolve(true); },
    onDidReceiveMessage: callback => { receive = callback; },
  }, { onDidDispose() {} });

  store.command.checkDependencies.mock.mockImplementation(async () => false);
  receive({ type: 'test-tree-fetch' });
  await until(() => messages.some(message => message.type === 'test-tree-dependency-error') && view.pendingFetch === null);
  assert.equal(context.statusBarItem.visible, true);

  store.command.checkDependencies.mock.mockImplementation(signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  messages.length = 0;
  receive({ type: 'test-tree-fetch' });
  assert.equal(context.statusBarItem.visible, false);
  await until(() => store.getActionState().currentAction?.type === 'fetch');
  store.stopAll();
  await until(() => messages.some(message => message.type === 'test-tree-dependency-error') && view.pendingFetch === null);
  assert.equal(context.statusBarItem.visible, true);
  assert.equal(context.statusBarItem.text, '$(error) Dependency Error');
  assert.ok(!messages.some(message => message.type === 'test-tree' || message.type === 'test-tree-error'));
});
