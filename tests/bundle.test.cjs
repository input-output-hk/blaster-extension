const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } = require('node:fs');
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
const TestStore = require('../out/services/testStore').default;
const {
  parseBundleLine, getRecordBytes, getAssuranceProperties, generateBundle, withDevShell, getCheckingContextPath, findRecord,
} = require('../out/services/generators/bundle');
Module._load = load;

const FIXTURES = join(__dirname, 'fixtures/plutus-generators');
const LIST_FIXTURE = join(FIXTURES, 'list-generators.json');
const AUCTION_NDJSON = join(FIXTURES, 'auction.ndjson');
const PURPOSE = 'docusaurus-examples:exe:example-ual-purpose-isolation';

/** Reads the captured Auction bundle as records. */
const readAuction = () => readFileSync(AUCTION_NDJSON, 'utf8').trim().split('\n').map(line => JSON.parse(line));

/** Records every line written to a fake output channel. */
const makeLog = () => {
  const lines = [];
  return { lines, appendLine: line => lines.push(line), append: text => lines.push(text) };
};

/**
 * Writes a fake generator to `dir`: it prints a Nix-like noise line, then a bundle whose assurance.json
 * lists the properties list-generators found for `target`, with "T <id>" titles and "S <id>" contents.
 * `drop` leaves one property out; `fail` exits non-zero after printing.
 */
const writeFakeGenerator = dir => {
  const file = join(dir, 'fake-generator.js');
  writeFileSync(file, `
    const [target, mode] = process.argv.slice(2);
    const entry = JSON.parse(require('node:fs').readFileSync(${JSON.stringify(LIST_FIXTURE)}, 'utf8')).find(item => item.target === target);
    let ids = entry.properties.map(property => property.id);
    if (mode === 'drop') ids = ids.slice(1);
    if (mode === 'hang') setInterval(() => {}, 1000);
    else {
      console.log("Submodule 'lib/QuickChick' unregistered for path 'lib/QuickChick'");
      const assurance = { properties: ids.map(id => ({ id, scope: { validators: [id.split('_')[0]] }, statement: { text: 'T ' + id, formal: { source: 'S ' + id } } })) };
      console.log(JSON.stringify({ path: 'plutus.json', encoding: 'utf8', content: '{}\\n' }));
      console.log(JSON.stringify({ path: 'applied-x.cbor', encoding: 'base16', content: '4a01' }));
      console.log(JSON.stringify({ path: 'assurance.json', encoding: 'utf8', content: JSON.stringify(assurance) + '\\n' }));
      if (mode === 'fail') { console.error('ghc: build failed'); process.exitCode = 1; }
    }
  `);
  return file;
};

/**
 * Creates a Haskell root whose list-generators.js prints the fixture with every generator's argv
 * pointing at the fake generator. `modes` maps a target to a fake-generator mode; generators not in
 * `modes` run normally.
 */
const makeRoot = (t, modes = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'blaster-bundle-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'cabal.project'), '');
  const fake = writeFakeGenerator(root);
  const entries = JSON.parse(readFileSync(LIST_FIXTURE, 'utf8')).map(entry => {
    const mode = modes[entry.target];
    return { ...entry, cwd: root, argv: [process.execPath, fake, entry.target, ...(mode ? [mode] : [])] };
  });
  mkdirSync(join(root, 'scripts/blueprints'), { recursive: true });
  writeFileSync(join(root, 'scripts/blueprints/list-generators.js'), `process.stdout.write(${JSON.stringify(JSON.stringify(entries))});`);
  return root;
};

/** Builds a TestStore whose Lean discovery returns an empty workspace for the root. */
const setupStore = async (t, root) => {
  const output = makeLog();
  const context = {
    extension: { subscriptions: [] },
    outputChannel: { ...output, show() {} },
    statusBarItem: { hide() {}, show() {} },
  };
  const store = new TestStore(context.extension);
  await store.initialize(context);
  t.after(async () => {
    store.stopAll();
    await store.generators.whenGenerated();
    if (!store.actionQueue.idle()) await store.actionQueue.drain();
    await store.database.database.remove();
  });
  t.mock.method(store.command, 'checkDependencies', async () => true);
  t.mock.method(store.command, 'discover', async () => ({ testTree: { workspaces: { workspace: {
    id: 'workspace', path: root, nodes: {}, status: 'empty', isRunning: false, isWaiting: false, isOpen: false,
  } } }, fileErrors: [] }));
  return { store, output };
};

test('bundle lines: records are kept, anything else is not', () => {
  assert.deepEqual(parseBundleLine('{"path":"plutus.json","encoding":"utf8","content":"{}"}'),
    { path: 'plutus.json', encoding: 'utf8', content: '{}' });
  assert.equal(parseBundleLine("Cleared directory 'lib/QuickChick'"), undefined);
  assert.equal(parseBundleLine('{"path":"a","encoding":"gzip","content":""}'), undefined);
  assert.equal(parseBundleLine('{"path":"","encoding":"utf8","content":""}'), undefined);
  assert.equal(parseBundleLine('[1]'), undefined);
});

test('the captured Auction bundle keeps exact bytes: every assurance hash matches', () => {
  const records = readAuction();
  assert.equal(records.length, 35);
  assert.equal(records[0].path, 'environment.json');
  const files = new Map(records.map(record => [record.path, getRecordBytes(record)]));
  const assurance = JSON.parse(files.get('assurance.json').toString('utf8'));
  const contexts = Object.values(assurance.checkingContexts).map(reference => JSON.parse(files.get(reference.uri).toString('utf8')));
  const references = [assurance.blueprint, ...Object.values(assurance.checkingContexts), ...contexts.map(context => context.environment)];
  assert.equal(references.length, 63);
  for (const { uri, hash } of references) {
    assert.equal(createHash('sha256').update(files.get(uri)).digest('hex'), hash.digest, uri);
  }
  assert.deepEqual(getRecordBytes({ path: 'x', encoding: 'base16', content: '4a01' }), Buffer.from([0x4a, 0x01]));
});

test('assurance properties come from statement.text and statement.formal.source', () => {
  const properties = getAssuranceProperties(readAuction());
  assert.equal(properties.length, 31);
  assert.deepEqual(properties[0], {
    id: 'outbids_exact',
    title: 'The separately compiled helper returns the native comparison result.',
    content: '∀ (old proposed : Integer), outbids_returns old proposed (decide (old <= proposed))',
    checkingContext: 'outbids_exact',
    scope: 'outbids',
  });
  assert.throws(() => getAssuranceProperties([]), /no assurance\.json/);
});

test('the checking context of a property is named by assurance.json', () => {
  const records = readAuction();
  assert.equal(getCheckingContextPath(records, 'outbids_exact'), 'checking-outbids_exact.json');
  assert.equal(findRecord(records, 'checking-outbids_exact.json').encoding, 'utf8');
  assert.throws(() => getCheckingContextPath(records, 'no_such_property'), /no checking context for no_such_property/);
  const withoutFile = records.filter(record => record.path !== 'checking-outbids_exact.json');
  assert.throws(() => getCheckingContextPath(withoutFile, 'outbids_exact'), /has no checking-outbids_exact\.json/);
});

test('generateBundle collects records and logs noise and stderr', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'blaster-gen-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const fake = writeFakeGenerator(dir);
  const log = makeLog();
  const bundle = await generateBundle([process.execPath, fake, PURPOSE], dir, log, new AbortController().signal);
  assert.deepEqual(bundle.records.map(record => record.path), ['plutus.json', 'applied-x.cbor', 'assurance.json']);
  assert.ok(log.lines.some(line => line.includes('Submodule')));

  const failing = generateBundle([process.execPath, fake, PURPOSE, 'fail'], dir, log, new AbortController().signal);
  await assert.rejects(failing, /Generator failed \(exit 1\)/);
  assert.ok(log.lines.some(line => line.includes('ghc: build failed')));
});

test('a missing command without a Nix flake explains what to install', async () => {
  await assert.rejects(
    generateBundle(['blaster-no-such-cabal', 'run'], tmpdir(), makeLog(), new AbortController().signal),
    /blaster-no-such-cabal not found on PATH, and the project has no Nix flake/
  );
});

test('a command missing from PATH runs in the Nix dev shell when the root has a flake', t => {
  const root = mkdtempSync(join(tmpdir(), 'blaster-nix-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const nixBin = join(root, 'nix-bin');
  const cabalBin = join(root, 'cabal-bin');
  mkdirSync(nixBin);
  mkdirSync(cabalBin);
  writeFileSync(join(nixBin, 'nix'), '');
  writeFileSync(join(cabalBin, 'cabal'), '');
  const argv = ['cabal', 'run', '-v0', 'target', '--', '--ndjson'];

  assert.deepEqual(withDevShell(argv, root, nixBin), argv);
  writeFileSync(join(root, 'flake.nix'), '');
  assert.deepEqual(withDevShell(argv, root, nixBin), ['nix', 'develop', '.', '--accept-flake-config', '-c', ...argv]);
  assert.deepEqual(withDevShell(argv, root, [cabalBin, nixBin].join(require('node:path').delimiter)), argv);
  assert.deepEqual(withDevShell(argv, root, ''), argv);
});

test('aborting kills the generator and rejects with the abort reason', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'blaster-gen-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const controller = new AbortController();
  const reason = new Error('stopped');
  const pending = generateBundle([process.execPath, writeFakeGenerator(dir), PURPOSE, 'hang'], dir, makeLog(), controller.signal);
  setTimeout(() => controller.abort(reason), 100);
  await assert.rejects(pending, error => error === reason);
});

test('refresh generates bundles in the background and fills template details', async t => {
  const { store } = await setupStore(t, makeRoot(t));
  const tree = await store.fetchTestTree();
  assert.equal(store.getActionState().isBusy, false);
  assert.equal(tree.workspaces.workspace.nodes[PURPOSE].tests[`ual:${PURPOSE}:spendingOnly_purpose_isolation`].haskell.title, undefined);

  await store.generators.whenGenerated();
  const generated = await store.getTestTree();
  const purpose = generated.workspaces.workspace.nodes[PURPOSE];
  assert.deepEqual(purpose.state, { kind: 'ready' });
  const template = purpose.tests[`ual:${PURPOSE}:spendingOnly_purpose_isolation`];
  assert.equal(template.haskell.title, 'T spendingOnly_purpose_isolation');
  assert.equal(template.haskell.content, 'S spendingOnly_purpose_isolation');
  assert.equal(template.haskell.scope, 'spendingOnly');
  const explicit = Object.values(generated.workspaces.workspace.nodes['docusaurus-examples:exe:example-ual-auction'].tests)
    .find(test => test.haskell.propertyId === 'outbids_exact');
  assert.equal(explicit.haskell.scope, 'outbids');
  assert.notEqual(explicit.haskell.title, 'T outbids_exact');
  assert.equal(store.generators.getBundle('workspace', PURPOSE).records.length, 3);
  for (const node of Object.values(generated.workspaces.workspace.nodes)) assert.deepEqual(node.state, { kind: 'ready' });
});

test('one failing generator does not stop the others', async t => {
  const AUCTION = 'docusaurus-examples:exe:example-ual-auction';
  const RECURSIVE = 'docusaurus-examples:exe:example-ual-recursive';
  const { store, output } = await setupStore(t, makeRoot(t, { [AUCTION]: 'fail', [RECURSIVE]: 'drop' }));
  await store.fetchTestTree();
  await store.generators.whenGenerated();
  const nodes = (await store.getTestTree()).workspaces.workspace.nodes;
  assert.equal(nodes[AUCTION].state.kind, 'error');
  assert.match(nodes[AUCTION].state.message, /Generator failed \(exit 1\)/);
  assert.equal(nodes[RECURSIVE].state.kind, 'error');
  assert.match(nodes[RECURSIVE].state.message, /doesn't match the source annotations \(not generated: /);
  assert.deepEqual(nodes[PURPOSE].state, { kind: 'ready' });
  assert.equal(store.generators.getBundle('workspace', AUCTION), undefined);
  assert.ok(output.lines.some(line => line.startsWith(`> ERROR ${AUCTION}`)));
});

test('a finished pass reports its failed generators once', async t => {
  const AUCTION = 'docusaurus-examples:exe:example-ual-auction';
  const { store } = await setupStore(t, makeRoot(t, { [AUCTION]: 'fail' }));
  const reports = [];
  store.onGenerationComplete(failedTargets => reports.push(failedTargets));
  await store.fetchTestTree();
  await store.generators.whenGenerated();
  assert.deepEqual(reports, [[AUCTION]]);
});

test('a pass with no failures reports an empty list', async t => {
  const { store } = await setupStore(t, makeRoot(t));
  const reports = [];
  store.onGenerationComplete(failedTargets => reports.push(failedTargets));
  await store.fetchTestTree();
  await store.generators.whenGenerated();
  assert.deepEqual(reports, [[]]);
});

test('a cancelled pass reports nothing', async t => {
  const BLUEPRINT = 'docusaurus-examples:exe:example-ual-blueprint';
  const { store } = await setupStore(t, makeRoot(t, { [BLUEPRINT]: 'hang' }));
  const reports = [];
  store.onGenerationComplete(failedTargets => reports.push(failedTargets));
  await store.fetchTestTree();
  while (store.generators.getState('workspace', BLUEPRINT)?.kind !== 'generating') await new Promise(resolve => setTimeout(resolve, 10));
  store.stopAll();
  await store.generators.whenGenerated();
  assert.deepEqual(reports, []);
});

test('Stop All and a new refresh cancel the generation pass', async t => {
  const BLUEPRINT = 'docusaurus-examples:exe:example-ual-blueprint';
  const { store } = await setupStore(t, makeRoot(t, { [BLUEPRINT]: 'hang' }));
  await store.fetchTestTree();
  const generating = () => store.generators.getState('workspace', BLUEPRINT)?.kind === 'generating';
  while (!generating()) await new Promise(resolve => setTimeout(resolve, 10));
  store.stopAll();
  await store.generators.whenGenerated();
  assert.deepEqual(store.generators.getState('workspace', BLUEPRINT), { kind: 'pending' });

  await store.fetchTestTree();
  while (!generating()) await new Promise(resolve => setTimeout(resolve, 10));
  const firstPass = store.generators.whenGenerated();
  await store.fetchTestTree();
  await firstPass;
  assert.equal(store.generators.getState('workspace', BLUEPRINT).kind, 'generating');
});

test('a changed source only regenerates the generators that list it', async t => {
  const AUCTION = 'docusaurus-examples:exe:example-ual-auction';
  const root = makeRoot(t);
  const { store, output } = await setupStore(t, root);
  /** Lists the targets the fake generator was run for. */
  const runs = () => output.lines.filter(line => line.startsWith('> ') && line.includes('fake-generator.js')).map(line => line.split(' ')[3]);
  await store.fetchTestTree();
  await store.generators.whenGenerated();
  assert.equal(runs().length, 7);

  const auctionSource = JSON.parse(readFileSync(LIST_FIXTURE, 'utf8')).find(entry => entry.target === AUCTION).sources[0];
  assert.equal(store.markHaskellChanges([join(root, 'unrelated/Other.hs')]), false);
  assert.equal(store.markHaskellChanges([join(root, auctionSource)]), true);
  const discovered = (await store.fetchTestTree(false)).workspaces.workspace.nodes;
  const kept = discovered[PURPOSE].tests[`ual:${PURPOSE}:spendingOnly_purpose_isolation`].haskell;
  assert.equal(kept.title, 'T spendingOnly_purpose_isolation');
  assert.equal(kept.scope, 'spendingOnly');
  const changed = Object.values(discovered[AUCTION].tests).find(test => test.haskell.propertyId === 'outbids_exact').haskell;
  assert.equal(changed.scope, undefined);
  await store.generators.whenGenerated();
  assert.deepEqual(runs().slice(7), [AUCTION]);
  const nodes = (await store.getTestTree()).workspaces.workspace.nodes;
  for (const node of Object.values(nodes)) assert.deepEqual(node.state, { kind: 'ready' });
  assert.equal(nodes[PURPOSE].tests[`ual:${PURPOSE}:spendingOnly_purpose_isolation`].haskell.title, 'T spendingOnly_purpose_isolation');

  assert.equal(store.markHaskellChanges([join(root, 'docusaurus-examples.cabal')]), true);
  await store.fetchTestTree(false);
  await store.generators.whenGenerated();
  assert.equal(runs().length, 15);
});

test('clearing results keeps generator states and template details', async t => {
  const { store } = await setupStore(t, makeRoot(t));
  await store.fetchTestTree();
  await store.generators.whenGenerated();
  await store.clearTestResults();
  const purpose = (await store.getTestTree()).workspaces.workspace.nodes[PURPOSE];
  assert.deepEqual(purpose.state, { kind: 'ready' });
  assert.equal(purpose.tests[`ual:${PURPOSE}:spendingOnly_purpose_isolation`].haskell.title, 'T spendingOnly_purpose_isolation');
  assert.ok(existsSync(AUCTION_NDJSON));
});
