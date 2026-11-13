
import { getTestRunLocation } from '../../../../../src/utils/testRun';
import { getKnownTags, type FilterContext, type FilterTag } from './filterTags';

export type TestGroupInfo = {
  workspaceId: string;
  tests: NonNullable<TestRun['tests']>;
  time?: number;
  status: RunStatus;
  isWaiting: boolean;
  isRunning: boolean;
  isRunnable: boolean;
};

const getGroupTests = (group: TestTreeGroupNode): Array<Test> => {
  const tests: Array<Test> = [];
  if (group.type === 'folder') {
    tests.push(...Object.values((group as TestTreeFolderNode).nodes).flatMap(getGroupTests));
  } else {
    tests.push(...Object.values((group as TestTreeFileNode).tests));
  }
  return tests;
};

export const getGroupInfo = (node: TestTreeGroupNode): TestGroupInfo => {
  const tests: Array<Test> = getGroupTests(node);
  const selections = new Map<string, Array<string>>();
  for (const test of tests) {
    const { uri, id } = getTestRunLocation(test);
    const ids = selections.get(uri) ?? [];
    ids.push(id);
    selections.set(uri, ids);
  }

  const isRunning = tests.some(test => test.isRunning);
  const isWaiting = tests.some(test => test.isWaiting) && !isRunning;

  const status: RunStatus = tests.some(test => test.status === 'invalid') ? 'invalid'
    : tests.length > 0 && tests.every(test => test.status === 'valid') ? 'valid'
    : tests.some(test => test.status === 'undetermined') ? 'undetermined' : 'empty';

  const time = isWaiting || isRunning ? undefined
    : tests.reduce((sum, test) => sum + (test.time ?? 0), 0);

  return {
    workspaceId: tests[0]?.workspaceId ?? '',
    tests: Array.from(selections, ([uri, ids]) => ({ uri, ids })),
    isRunnable: tests.length > 0 && !isWaiting && !isRunning,
    isWaiting,
    isRunning,
    status,
    time
  };
};

type FilterKeywords = {
  positiveKeywords: Array<string>;
  negativeKeywords: Array<string>;
  tagKeywords: Array<string>;
};

/**
 * Splits the filter box text into lowercase keywords. Only the first character of a word picks its list:
 * `!word` → negative, `@word` → tag, anything else → positive. A lone `!` or `@` is ignored.
 * @example parseFilterText('Mint !slow @executed') // { positiveKeywords: ['mint'], negativeKeywords: ['slow'], tagKeywords: ['executed'] }
 */
export const parseFilterText = (text?: string): FilterKeywords => {
  const keywords: FilterKeywords = { positiveKeywords: [], negativeKeywords: [], tagKeywords: [] };
  for (const word of (text ?? '').toLowerCase().split(/\s+/)) {
    if (word.startsWith('!')) {
      if (word.length > 1) keywords.negativeKeywords.push(word.slice(1));
    } else if (word.startsWith('@')) {
      if (word.length > 1) keywords.tagKeywords.push(word.slice(1));
    } else if (word !== '') {
      keywords.positiveKeywords.push(word);
    }
  }
  return keywords;
};

/** Returns whether the item is a test (the leaves of the tree). */
const isTest = (item: VisibleItem): item is Test => 'location' in item;

/** Returns the display name of a workspace (its folder name), folder, file or test. */
const getItemName = (item: VisibleItem): string => {
  if (isTest(item)) return item.name;
  if ('type' in item) return item.name;
  return item.path.split(/[/\\]/).filter(Boolean).at(-1) ?? item.path;
};

/** Returns the direct children of an item: nodes of a workspace or folder, tests of a file. A test has none. */
const getItemChildren = (item: VisibleItem): Array<VisibleItem> => {
  if ('tests' in item) return Object.values((item as TestTreeFileNode).tests);
  if ('nodes' in item) return Object.values((item as TestTreeFolderNode | TestTreeWorkspaceNode).nodes);
  return [];
};

/** Returns the keywords that the name doesn't contain (case-insensitive). Keywords must already be lowercase. */
const getUnmatchedKeywords = (name: string, keywords: Array<string>): Array<string> => {
  const lowerName = name.toLowerCase();
  const unmatched: Array<string> = [];
  for (const keyword of keywords) {
    if (!lowerName.includes(keyword)) unmatched.push(keyword);
  }
  return unmatched;
};

/** Adds the item and its whole subtree to the visible set. */
const addItems = (item: VisibleItem, visible: Set<VisibleItem>): void => {
  visible.add(item);
  for (const child of getItemChildren(item)) addItems(child, visible);
};

/** Removes the item and its whole subtree from the visible set. */
const removeItems = (item: VisibleItem, visible: Set<VisibleItem>): void => {
  visible.delete(item);
  for (const child of getItemChildren(item)) removeItems(child, visible);
};

/** Step 1: removes every item whose name contains any negative keyword, with its whole subtree. */
const removeNegative = (item: VisibleItem, negativeKeywords: Array<string>, visible: Set<VisibleItem>): void => {
  if (getUnmatchedKeywords(getItemName(item), negativeKeywords).length < negativeKeywords.length) {
    removeItems(item, visible);
    return;
  }
  for (const child of getItemChildren(item)) removeNegative(child, negativeKeywords, visible);
};

/** Step 2: removes every test whose path (ancestor names and its own name) misses any positive keyword. */
const keepPositive = (item: VisibleItem, positiveKeywords: Array<string>, visible: Set<VisibleItem>): void => {
  const unmatched = getUnmatchedKeywords(getItemName(item), positiveKeywords);
  if (isTest(item)) {
    if (unmatched.length > 0) visible.delete(item);
    return;
  }
  for (const child of getItemChildren(item)) keepPositive(child, unmatched, visible);
};

/** Step 3: removes every test that doesn't match all known tags. */
const keepTags = (item: VisibleItem, tags: Array<FilterTag>, context: FilterContext, visible: Set<VisibleItem>): void => {
  if (isTest(item)) {
    for (const tag of tags) {
      if (!tag.matches(item, context)) visible.delete(item);
    }
    return;
  }
  for (const child of getItemChildren(item)) keepTags(child, tags, context, visible);
};

/** Removes every workspace, folder or file with no visible test left. Returns whether the item stays. */
const pruneEmpty = (item: VisibleItem, visible: Set<VisibleItem>): boolean => {
  if (!visible.has(item)) return false;
  if (isTest(item)) return true;
  let hasVisibleChild = false;
  for (const child of getItemChildren(item)) {
    if (pruneEmpty(child, visible)) hasVisibleChild = true;
  }
  if (!hasVisibleChild) visible.delete(item);
  return hasVisibleChild;
};

/**
 * Runs the filter over the whole tree and returns the visible workspaces, folders, files and tests.
 * Starts with everything visible; each step only removes items: negative, positive, tags, then prune.
 */
export const getVisibleItems = (testTree: TestTree, filter: TestTreeFilter, context: FilterContext): Set<VisibleItem> => {
  const { positiveKeywords, negativeKeywords, tagKeywords } = parseFilterText(filter.text);
  const tags = getKnownTags(tagKeywords);
  const workspaces = Object.values(testTree.workspaces);
  const visible = new Set<VisibleItem>();
  for (const workspace of workspaces) addItems(workspace, visible);
  for (const workspace of workspaces) removeNegative(workspace, negativeKeywords, visible);
  for (const workspace of workspaces) keepPositive(workspace, positiveKeywords, visible);
  for (const workspace of workspaces) keepTags(workspace, tags, context, visible);
  for (const workspace of workspaces) pruneEmpty(workspace, visible);
  return visible;
};
