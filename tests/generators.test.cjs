const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
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
  workspace: { workspaceFolders: [] },
};
const load = Module._load;
Module._load = function (id, ...args) {
  return id === 'vscode' ? vscode : load.call(this, id, ...args);
};
const Generators = require('../out/services/generators').default;
const TestStore = require('../out/services/testStore').default;
const { parseGenerators, makeHaskellTestId } = require('../out/services/generators/discover');
Module._load = load;

const FIXTURE = join(__dirname, 'fixtures/plutus-generators/list-generators.json');
const AUCTION = 'docusaurus-examples:exe:example-ual-auction';

/**
 * Creates a Haskell root whose list-generators.js runs the given script body. `fixture` holds the
 * fixture text with `${ROOT}` already replaced by the root.
 */
const makeRoot = (t, body) => {
  const root = mkdtempSync(join(tmpdir(), 'blaster-haskell-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'cabal.project'), '');
  mkdirSync(join(root, 'scripts/blueprints'), { recursive: true });
  writeFileSync(join(root, 'scripts/blueprints/list-generators.js'), `
    const fixture = require('node:fs').readFileSync(${JSON.stringify(FIXTURE)}, 'utf8').replaceAll('\${ROOT}', process.argv[2]);
    ${body}
  `);
  return root;
};

const printFixture = 'process.stdout.write(fixture);';

/**
 * Builds a Generators service with a recording output channel.
 */
const makeGenerators = () => {
  const output = [];
  const generators = new Generators();
  generators.initialize({ outputChannel: { appendLine: line => output.push(line), append: text => output.push(text) } });
  return { generators, output };
};

/**
 * Builds a one-workspace tree for a root, as Command.discover returns it for a Haskell-only root.
 */
const makeTree = root => ({ workspaces: { workspace: {
  id: 'workspace', path: root, nodes: {}, status: 'empty', isRunning: false, isWaiting: false, isOpen: false,
} } });

test('the Plutus fixture lists 7 generators and 58 properties in assurance order', async t => {
  const root = makeRoot(t, printFixture);
  const { generators } = makeGenerators();
  const tree = makeTree(root);
  const errors = await generators.discover(tree, new AbortController().signal);
  assert.deepEqual(errors, []);

  const nodes = tree.workspaces.workspace.nodes;
  assert.equal(Object.keys(nodes).length, 7);
  assert.ok(Object.values(nodes).every(node => node.type === 'generator'));
  assert.equal(Object.values(nodes).reduce((sum, node) => sum + Object.keys(node.tests).length, 0), 58);

  const auction = Object.values(nodes[AUCTION].tests);
  assert.equal(auction.length, 31);
  assert.deepEqual(auction.slice(0, 3).map(item => item.name), ['outbids_exact', 'first_bid_exact', 'existing_bid_exact']);
  assert.deepEqual(auction.map(item => item.haskell.index), auction.map((_, index) => index));
  const [first] = auction;
  assert.equal(first.id, `ual:${AUCTION}:outbids_exact`);
  assert.deepEqual(first.group, [AUCTION]);
  assert.equal(first.location.path, join(root, 'doc/docusaurus/static/code/Example/Ual/Auction/FormalSpec.hs'));
  assert.deepEqual(first.location.range, { start: { line: 152, character: 0 }, end: { line: 155, character: 3 } });
  assert.equal(first.haskell.kind, 'explicit');
  assert.match(first.haskell.title, /separately compiled helper/);
});

test('template properties have no title or content before generation', async t => {
  const root = makeRoot(t, printFixture);
  const { generators } = makeGenerators();
  const tree = makeTree(root);
  await generators.discover(tree, new AbortController().signal);
  const template = tree.workspaces.workspace.nodes['docusaurus-examples:exe:example-ual-purpose-isolation']
    .tests[makeHaskellTestId('docusaurus-examples:exe:example-ual-purpose-isolation', 'spendingOnly_purpose_isolation')];
  assert.equal(template.haskell.kind, 'template');
  assert.equal(template.haskell.title, undefined);
  assert.equal(template.haskell.content, undefined);
});

test('a generator without properties becomes an error row', async t => {
  const root = makeRoot(t, `
    const entries = JSON.parse(fixture);
    entries[0].properties = null;
    entries[0].propertyDiscoveryError = 'Cannot resolve the annotation-module list in main';
    process.stdout.write(JSON.stringify(entries));
  `);
  const { generators } = makeGenerators();
  const tree = makeTree(root);
  const errors = await generators.discover(tree, new AbortController().signal);
  assert.deepEqual(errors, [{
    workspaceId: 'workspace', group: ['docusaurus-examples:exe:example-ual-blueprint'],
    message: 'Cannot resolve the annotation-module list in main', type: 'generator',
  }]);
  assert.equal(Object.keys(tree.workspaces.workspace.nodes).length, 6);
});

for (const [name, body, message] of [
  ['exits non-zero', `process.stderr.write('Missing package name in x.cabal\\n'); process.exitCode = 1;`, /failed: Missing package name in x\.cabal/],
  ['prints invalid JSON', `process.stdout.write('not json');`, /Unable to read .* output/],
  ['prints an invalid entry', `process.stdout.write(JSON.stringify([{ target: 'a' }]));`, /invalid generator at index 0/],
]) {
  test(`a script that ${name} becomes a root error row`, async t => {
    const root = makeRoot(t, body);
    const { generators, output } = makeGenerators();
    const tree = makeTree(root);
    const errors = await generators.discover(tree, new AbortController().signal);
    assert.equal(errors.length, 1);
    assert.deepEqual(errors[0].group, ['scripts/blueprints/list-generators.js']);
    assert.match(errors[0].message, message);
    assert.ok(output.some(line => line.startsWith('> ERROR')));
    assert.deepEqual(tree.workspaces.workspace.nodes, {});
  });
}

test('a Haskell root without the script gets an explained error row', async t => {
  const root = mkdtempSync(join(tmpdir(), 'blaster-haskell-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'my-pkg.cabal'), '');
  const { generators } = makeGenerators();
  const errors = await generators.discover(makeTree(root), new AbortController().signal);
  assert.match(errors[0].message, /list-generators\.js not found/);
});

test('Lean roots are skipped', async t => {
  const root = mkdtempSync(join(tmpdir(), 'blaster-lean-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'lean-toolchain'), '');
  const { generators, output } = makeGenerators();
  assert.deepEqual(await generators.discover(makeTree(root), new AbortController().signal), []);
  assert.deepEqual(output, []);
});

test('aborting discovery rejects with the abort reason', async t => {
  const root = makeRoot(t, 'setTimeout(() => {}, 10_000);');
  const { generators } = makeGenerators();
  const controller = new AbortController();
  const reason = new vscode.CancellationError();
  const pending = generators.discover(makeTree(root), controller.signal);
  setTimeout(() => controller.abort(reason), 50);
  await assert.rejects(pending, error => error === reason);
});

test('parseGenerators accepts the fixture and rejects bad ranges', () => {
  const text = readFileSync(FIXTURE, 'utf8');
  assert.equal(parseGenerators(text).length, 7);
  const entries = JSON.parse(text);
  entries[0].properties[0].range.start.line = -1;
  assert.throws(() => parseGenerators(JSON.stringify(entries)), /invalid generator at index 0/);
});

/**
 * Builds a TestStore whose Lean discovery returns an empty workspace for the root.
 */
const setupStore = async (t, root) => {
  const context = {
    extension: { subscriptions: [] },
    outputChannel: { appendLine() {}, append() {}, show() {} },
    statusBarItem: { hide() {}, show() {} },
  };
  const store = new TestStore(context.extension);
  await store.initialize(context);
  t.after(async () => {
    store.stopAll();
    if (!store.actionQueue.idle()) await store.actionQueue.drain();
    await store.database.database.remove();
  });
  t.mock.method(store.command, 'checkDependencies', async () => true);
  t.mock.method(store.command, 'discover', async () => ({ testTree: makeTree(root), fileErrors: [] }));
  return store;
};

test('the store keeps generator nodes, property order and Haskell fields', async t => {
  const store = await setupStore(t, makeRoot(t, printFixture));
  const tree = await store.fetchTestTree();
  const auction = tree.workspaces.workspace.nodes[AUCTION];
  assert.equal(auction.type, 'generator');
  const tests = Object.values(auction.tests);
  assert.deepEqual(tests.map(item => item.haskell.index), tests.map((_, index) => index));
  assert.equal(tests[0].haskell.title, 'The separately compiled helper returns the native comparison result.');
  assert.deepEqual(await store.getTestTree(), tree);
});

test('a generator error row is a generator node', async t => {
  const root = makeRoot(t, `
    const entries = JSON.parse(fixture);
    entries[0].properties = null;
    entries[0].propertyDiscoveryError = 'Cannot resolve annotation binding x';
    process.stdout.write(JSON.stringify(entries));
  `);
  const store = await setupStore(t, root);
  const tree = await store.fetchTestTree();
  const node = tree.workspaces.workspace.nodes['docusaurus-examples:exe:example-ual-blueprint'];
  assert.equal(node.type, 'generator');
  assert.equal(node.error, 'Cannot resolve annotation binding x');
});

test('running a Haskell generator is rejected without queueing anything', async t => {
  const store = await setupStore(t, makeRoot(t, printFixture));
  await store.fetchTestTree();
  t.mock.method(store.command, 'runTests', async () => {});
  await assert.rejects(
    store.runTests([{ workspaceId: 'workspace', tests: [{ uri: AUCTION }] }]),
    /Running Haskell properties is not available yet/
  );
  assert.equal(store.getActionState().isBusy, false);
  assert.equal(store.command.runTests.mock.callCount(), 0);
});
