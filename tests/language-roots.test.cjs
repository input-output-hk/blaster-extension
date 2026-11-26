const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const childProcess = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const vscode = { workspace: { workspaceFolders: [] } };
const load = Module._load;
Module._load = function (id, ...args) {
  return id === 'vscode' ? vscode : load.call(this, id, ...args);
};
const Command = require('../out/services/command').default;
const { detectLanguages } = require('../out/services/generators/project');
Module._load = load;

/**
 * Creates a temporary workspace root containing the given (empty) files.
 */
const makeRoot = (t, files) => {
  const root = mkdtempSync(join(tmpdir(), 'blaster-root-'));
  for (const file of files) writeFileSync(join(root, file), '');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
};

/**
 * Builds a Command whose workspace folders are the given roots, and records every process it starts.
 */
const setup = (t, roots) => {
  t.mock.property(vscode.workspace, 'workspaceFolders', roots.map(fsPath => ({ uri: { fsPath } })));
  const started = [];
  const spawn = childProcess.spawn;
  t.mock.method(childProcess, 'execFile', (command, args, options, callback) => {
    started.push([command, ...args]);
    queueMicrotask(() => callback(null));
    return { kill() {} };
  });
  t.mock.method(childProcess, 'spawn', (command, args, options) => {
    started.push([command, ...args]);
    const script = `console.log(JSON.stringify({ schemaVersion: 1, event: 'complete', exitCode: 0 }));`;
    return spawn(process.execPath, ['-e', script], options);
  });
  const command = new Command();
  command.initialize({ outputChannel: { appendLine() {}, append() {} } });
  return { command, started };
};

test('detectLanguages reads top-level markers only', t => {
  assert.deepEqual(detectLanguages(makeRoot(t, ['lean-toolchain'])), { lean: true, haskell: false });
  assert.deepEqual(detectLanguages(makeRoot(t, ['lakefile.toml'])), { lean: true, haskell: false });
  assert.deepEqual(detectLanguages(makeRoot(t, ['cabal.project'])), { lean: false, haskell: true });
  assert.deepEqual(detectLanguages(makeRoot(t, ['my-pkg.cabal'])), { lean: false, haskell: true });
  assert.deepEqual(detectLanguages(makeRoot(t, ['cabal.project', 'lakefile.lean'])), { lean: true, haskell: true });
  assert.deepEqual(detectLanguages(makeRoot(t, ['README.md'])), { lean: true, haskell: false });
  assert.deepEqual(detectLanguages(join(tmpdir(), 'blaster-missing-root')), { lean: true, haskell: false });
});

test('a Haskell-only workspace needs no lean-blaster', async t => {
  const { command, started } = setup(t, [makeRoot(t, ['cabal.project'])]);
  assert.equal(await command.checkDependencies(new AbortController().signal), true);
  const { testTree, fileErrors } = await command.discover(new AbortController().signal);
  const [workspace] = Object.values(testTree.workspaces);
  assert.deepEqual(workspace.nodes, {});
  assert.deepEqual(fileErrors, []);
  assert.deepEqual(started, []);
});

test('a multi-root workspace runs lean-blaster for Lean roots only', async t => {
  const lean = makeRoot(t, ['lean-toolchain']);
  const haskell = makeRoot(t, ['cabal.project']);
  const { command, started } = setup(t, [lean, haskell]);
  assert.equal(await command.checkDependencies(new AbortController().signal), true);
  const { testTree } = await command.discover(new AbortController().signal);
  assert.equal(Object.keys(testTree.workspaces).length, 2);
  assert.deepEqual(started, [['lean-blaster', '--version'], ['lean-blaster', 'discover', lean, '--json']]);
});

test('a root without markers keeps Lean discovery', async t => {
  const root = makeRoot(t, ['README.md']);
  const { command, started } = setup(t, [root]);
  await command.checkDependencies(new AbortController().signal);
  await command.discover(new AbortController().signal);
  assert.deepEqual(started, [['lean-blaster', '--version'], ['lean-blaster', 'discover', root, '--json']]);
});
