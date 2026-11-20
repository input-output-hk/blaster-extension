import { describe, expect, test } from 'vitest';
import { getVisibleItems, parseFilterText, sortTests } from './treeUtils';

import type { FilterContext } from './filterTags';

const MINT_FILE = '/ws/token-ws/Mint/Mint.lean';
const BURN_FILE = '/ws/token-ws/Burn.lean';

/** Builds a test with the given name, status and file. */
const makeTest = (id: string, name: string, status: RunStatus, path: string): Test => ({
  id,
  name,
  group: [],
  location: { path, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } },
  status,
  isWaiting: false,
  isRunning: false,
  workspaceId: 'ws',
});

const mintValid = makeTest('1', 'mint succeeds', 'valid', MINT_FILE);
const mintInvalid = makeTest('2', 'mint twice', 'invalid', MINT_FILE);
const burnPending = makeTest('3', 'burn token', 'undetermined', BURN_FILE);
const burnEmpty = makeTest('4', 'burn later', 'empty', BURN_FILE);
const burnBroken = makeTest('5', 'burn broken', 'error', BURN_FILE);

const mintFile: TestTreeFileNode = {
  type: 'file',
  name: 'Mint.lean',
  isOpen: false,
  tests: { '1': mintValid, '2': mintInvalid },
};

const mintFolder: TestTreeFolderNode = {
  type: 'folder',
  name: 'Mint',
  isOpen: false,
  nodes: { 'Mint.lean': mintFile },
};

const burnFile: TestTreeFileNode = {
  type: 'file',
  name: 'Burn.lean',
  isOpen: false,
  tests: { '3': burnPending, '4': burnEmpty, '5': burnBroken },
};

const swapFile: TestTreeFileNode = {
  type: 'file',
  name: 'Swap.lean',
  isOpen: false,
  tests: {},
  error: 'unknown identifier',
};

const workspace: TestTreeWorkspaceNode = {
  id: 'ws',
  path: '/ws/token-ws',
  status: 'invalid',
  isWaiting: false,
  isRunning: false,
  isOpen: false,
  nodes: { Mint: mintFolder, 'Burn.lean': burnFile, 'Swap.lean': swapFile },
};

const testTree: TestTree = { workspaces: { ws: workspace } };

const context: FilterContext = { activeFile: BURN_FILE, openFiles: new Set([MINT_FILE]) };

const items: Record<string, VisibleItem> = {
  workspace, mintFolder, mintFile, mintValid, mintInvalid, burnFile, burnPending, burnEmpty, burnBroken, swapFile,
};

/** Returns the fixture names of the items left visible by the filter text, in fixture order. */
const getVisibleNames = (text: string, filterContext: FilterContext = context): Array<string> => {
  const visible = getVisibleItems(testTree, { text }, filterContext);
  const names: Array<string> = [];
  for (const [name, item] of Object.entries(items)) {
    if (visible.has(item)) names.push(name);
  }
  return names;
};

const everything = Object.keys(items);
const mintBranch = ['workspace', 'mintFolder', 'mintFile'];

describe('parseFilterText', () => {
  test('splits words by their first character and lowercases them', () => {
    expect(parseFilterText('Mint !Slow @openedFiles')).toEqual({
      positiveKeywords: ['mint'],
      negativeKeywords: ['slow'],
      tagKeywords: ['openedfiles'],
    });
  });

  test('ignores a lone ! or @', () => {
    expect(parseFilterText('! @')).toEqual({ positiveKeywords: [], negativeKeywords: [], tagKeywords: [] });
  });

  test('treats !@tag as a negative text keyword', () => {
    expect(parseFilterText('!@falsified').negativeKeywords).toEqual(['@falsified']);
  });

  test('handles missing text', () => {
    expect(parseFilterText(undefined)).toEqual({ positiveKeywords: [], negativeKeywords: [], tagKeywords: [] });
  });
});

describe('getVisibleItems', () => {
  describe('no filter', () => {
    test('shows everything', () => {
      expect(getVisibleNames('')).toEqual(everything);
    });
  });

  describe('plain text keywords', () => {
    test('a word in a test name keeps that test and its parents', () => {
      expect(getVisibleNames('twice')).toEqual([...mintBranch, 'mintInvalid']);
    });

    test('a word in a folder name keeps the whole folder', () => {
      expect(getVisibleNames('mint')).toEqual([...mintBranch, 'mintValid', 'mintInvalid']);
    });

    test('a word in a file name keeps the whole file', () => {
      expect(getVisibleNames('burn.lean')).toEqual(['workspace', 'burnFile', 'burnPending', 'burnEmpty', 'burnBroken']);
    });

    test('a word in the workspace folder name keeps everything', () => {
      expect(getVisibleNames('token-ws')).toEqual(everything);
    });

    test('ignores case', () => {
      expect(getVisibleNames('MINT')).toEqual(getVisibleNames('mint'));
    });

    test('every word must match (AND)', () => {
      expect(getVisibleNames('burn later')).toEqual(['workspace', 'burnFile', 'burnEmpty']);
      expect(getVisibleNames('mint later')).toEqual([]);
    });
  });

  describe('exclusions (!)', () => {
    test('removes a matching test', () => {
      expect(getVisibleNames('!twice')).toEqual(everything.filter(name => name !== 'mintInvalid'));
    });

    test('removes a matching folder with its subtree', () => {
      expect(getVisibleNames('!mint')).toEqual(['workspace', 'burnFile', 'burnPending', 'burnEmpty', 'burnBroken', 'swapFile']);
    });

    test('! wins over a plain word', () => {
      expect(getVisibleNames('mint !mint')).toEqual([]);
    });
  });

  describe('tags (@)', () => {
    test('@falsified keeps invalid tests', () => {
      expect(getVisibleNames('@falsified')).toEqual([...mintBranch, 'mintInvalid']);
    });

    test('@error keeps errored tests and files whose discovery failed', () => {
      expect(getVisibleNames('@error')).toEqual(['workspace', 'burnFile', 'burnBroken', 'swapFile']);
    });

    test('@undetermined keeps undetermined tests', () => {
      expect(getVisibleNames('@undetermined')).toEqual(['workspace', 'burnFile', 'burnPending']);
    });

    test('@executed keeps every test that has a result', () => {
      expect(getVisibleNames('@executed')).toEqual(everything.filter(name => name !== 'burnEmpty' && name !== 'swapFile'));
    });

    test('@doc keeps tests in the active file', () => {
      expect(getVisibleNames('@doc')).toEqual(['workspace', 'burnFile', 'burnPending', 'burnEmpty', 'burnBroken']);
    });

    test('@doc keeps nothing without an active file', () => {
      expect(getVisibleNames('@doc', { openFiles: new Set() })).toEqual([]);
    });

    test('@openedFiles keeps tests in open files, ignoring case', () => {
      expect(getVisibleNames('@openedFiles')).toEqual([...mintBranch, 'mintValid', 'mintInvalid']);
      expect(getVisibleNames('@OPENEDFILES')).toEqual(getVisibleNames('@openedFiles'));
    });

    test('tags combine with AND', () => {
      expect(getVisibleNames('@falsified @undetermined')).toEqual([]);
      expect(getVisibleNames('@doc @executed')).toEqual(['workspace', 'burnFile', 'burnPending', 'burnBroken']);
    });

    test('a repeated tag acts like one', () => {
      expect(getVisibleNames('@falsified @falsified')).toEqual(getVisibleNames('@falsified'));
    });

    test('unknown or partial tags are ignored', () => {
      expect(getVisibleNames('@falsi')).toEqual(everything);
      expect(getVisibleNames('@foo')).toEqual(everything);
    });
  });

  describe('combined', () => {
    test('text, exclusion and tags together', () => {
      expect(getVisibleNames('mint !succeeds @openedFiles @falsified')).toEqual([...mintBranch, 'mintInvalid']);
    });
  });

  describe('files whose discovery failed', () => {
    test('stay visible with no tests', () => {
      expect(getVisibleNames('swap')).toEqual(['workspace', 'swapFile']);
    });

    test('are hidden by a word they miss or an exclusion', () => {
      expect(getVisibleNames('burn')).not.toContain('swapFile');
      expect(getVisibleNames('!swap')).not.toContain('swapFile');
    });

    test('are hidden by any tag other than @error', () => {
      expect(getVisibleNames('@falsified')).not.toContain('swapFile');
      expect(getVisibleNames('@error @doc')).not.toContain('swapFile');
    });
  });

  describe('pruning', () => {
    test('hides parents with no visible test left', () => {
      expect(getVisibleNames('nothing-matches')).toEqual([]);
    });
  });
});

/** Builds a test at the given 0-based line and column with the given status. */
const makeTestAt = (id: string, line: number, character: number, status: RunStatus): Test => ({
  ...makeTest(id, `prop ${id}`, status, MINT_FILE),
  location: { path: MINT_FILE, range: { start: { line, character }, end: { line, character: character + 1 } } },
});

/** Returns the ids of the tests, in order. */
const getIds = (tests: Array<Test>): Array<string> => tests.map(getTestId);

/** Returns the id of a test. */
const getTestId = (test: Test): string => test.id;

describe('sortTests', () => {
  const valid = makeTestAt('valid', 2, 0, 'valid');
  const empty = makeTestAt('empty', 0, 4, 'empty');
  const undetermined = makeTestAt('undetermined', 9, 0, 'undetermined');
  const error = makeTestAt('error', 5, 0, 'error');
  const invalid = makeTestAt('invalid', 7, 0, 'invalid');
  const tests = [valid, empty, undetermined, error, invalid];

  test('location: by line, then column', () => {
    const sameLine = makeTestAt('sameLine', 0, 1, 'empty');
    expect(getIds(sortTests([...tests, sameLine], 'location')))
      .toEqual(['sameLine', 'empty', 'valid', 'error', 'invalid', 'undetermined']);
  });

  test('status: falsified, error, undetermined, valid, not run', () => {
    expect(getIds(sortTests(tests, 'status'))).toEqual(['invalid', 'error', 'undetermined', 'valid', 'empty']);
  });

  test('status: same status keeps location order', () => {
    const late = makeTestAt('late', 20, 0, 'invalid');
    const early = makeTestAt('early', 1, 0, 'invalid');
    expect(getIds(sortTests([late, valid, early], 'status'))).toEqual(['early', 'late', 'valid']);
  });

  test('status: with no results it matches location order', () => {
    const notRun = [makeTestAt('b', 3, 0, 'empty'), makeTestAt('a', 1, 0, 'empty')];
    expect(getIds(sortTests(notRun, 'status'))).toEqual(getIds(sortTests(notRun, 'location')));
  });

  test('does not change the input array', () => {
    const input = [...tests];
    sortTests(input, 'status');
    expect(input).toEqual(tests);
  });
});
