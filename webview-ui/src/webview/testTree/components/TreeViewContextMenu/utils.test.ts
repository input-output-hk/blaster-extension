import { describe, expect, test } from 'vitest';
import { getContextMenuEntries } from './utils';

const AUCTION = 'docusaurus-examples:exe:example-ual-auction';

/** Builds a test, as a Haskell property when `haskell` is given. */
const makeTest = (id: string, haskell?: HaskellProperty): Test => ({
  id,
  name: id,
  group: [],
  location: { path: '/ws/plutus/FormalSpec.hs', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } },
  status: 'empty',
  isWaiting: false,
  isRunning: false,
  workspaceId: 'ws',
  haskell,
});

const property = makeTest(`ual:${AUCTION}:outbids_exact`, { generator: AUCTION, propertyId: 'outbids_exact', index: 0, kind: 'explicit' });

/** Builds a generator group item in the given generation state. */
const makeGenerator = (state?: GeneratorState): TestTreeItem => ({
  type: 'group',
  workspaceId: 'ws',
  node: { type: 'generator', name: AUCTION, isOpen: false, tests: { [property.id]: property }, state } as TestTreeGeneratorNode,
});

describe('generated files entries', () => {
  test('a generator can open its files once its bundle is ready', () => {
    const files = getContextMenuEntries(makeGenerator({ kind: 'ready' })).find(entry => entry.action === 'files');
    expect(files).toMatchObject({ label: 'Open Generated Files…', disabled: false, payload: { workspaceId: 'ws', generator: AUCTION } });
  });

  test('the entry is disabled while the bundle is not ready', () => {
    for (const state of [undefined, { kind: 'pending' }, { kind: 'generating' }, { kind: 'error', message: 'x' }] as Array<GeneratorState | undefined>) {
      expect(getContextMenuEntries(makeGenerator(state)).find(entry => entry.action === 'files')?.disabled).toBe(true);
    }
  });

  test('a Haskell property opens its checking context', () => {
    const context = getContextMenuEntries({ type: 'test', test: property }).find(entry => entry.action === 'files');
    expect(context).toMatchObject({
      label: 'Open Checking Context',
      payload: { workspaceId: 'ws', generator: AUCTION, propertyId: 'outbids_exact' },
    });
  });

  test('Lean tests and folders have no generated files entries', () => {
    expect(getContextMenuEntries({ type: 'test', test: makeTest('Mint.lean:1:1') }).some(entry => entry.action === 'files')).toBe(false);
    const folder: TestTreeItem = { type: 'group', workspaceId: 'ws', node: { type: 'folder', name: 'src', isOpen: false, nodes: {} } as TestTreeFolderNode };
    expect(getContextMenuEntries(folder).some(entry => entry.action === 'files')).toBe(false);
  });
});
