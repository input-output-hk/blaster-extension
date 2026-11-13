import { describe, expect, test } from 'vitest';
import { getVisibleItems, parseFilterText } from './treeUtils';

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
  tests: { '3': burnPending, '4': burnEmpty },
};

const workspace: TestTreeWorkspaceNode = {
  id: 'ws',
  path: '/ws/token-ws',
  status: 'invalid',
  isWaiting: false,
  isRunning: false,
  isOpen: false,
  nodes: { Mint: mintFolder, 'Burn.lean': burnFile },
};

const testTree: TestTree = { workspaces: { ws: workspace } };

const context: FilterContext = { activeFile: BURN_FILE, openFiles: new Set([MINT_FILE]) };

const items: Record<string, VisibleItem> = {
  workspace, mintFolder, mintFile, mintValid, mintInvalid, burnFile, burnPending, burnEmpty,
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
      expect(getVisibleNames('burn.lean')).toEqual(['workspace', 'burnFile', 'burnPending', 'burnEmpty']);
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
      expect(getVisibleNames('!mint')).toEqual(['workspace', 'burnFile', 'burnPending', 'burnEmpty']);
    });

    test('! wins over a plain word', () => {
      expect(getVisibleNames('mint !mint')).toEqual([]);
    });
  });

  describe('tags (@)', () => {
    test('@falsified keeps invalid tests', () => {
      expect(getVisibleNames('@falsified')).toEqual([...mintBranch, 'mintInvalid']);
    });

    test('@error keeps invalid tests too, for now', () => {
      expect(getVisibleNames('@error')).toEqual(getVisibleNames('@falsified'));
    });

    test('@undetermined keeps undetermined tests', () => {
      expect(getVisibleNames('@undetermined')).toEqual(['workspace', 'burnFile', 'burnPending']);
    });

    test('@executed keeps every test that has a result', () => {
      expect(getVisibleNames('@executed')).toEqual(everything.filter(name => name !== 'burnEmpty'));
    });

    test('@doc keeps tests in the active file', () => {
      expect(getVisibleNames('@doc')).toEqual(['workspace', 'burnFile', 'burnPending', 'burnEmpty']);
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
      expect(getVisibleNames('@doc @executed')).toEqual(['workspace', 'burnFile', 'burnPending']);
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

  describe('pruning', () => {
    test('hides parents with no visible test left', () => {
      expect(getVisibleNames('nothing-matches')).toEqual([]);
    });
  });
});
