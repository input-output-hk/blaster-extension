export type FilterContext = {
  activeFile?: string;
  openFiles: Set<string>;
};

export type FilterTag = {
  name: string;
  description: string;
  matches: (test: Test, context: FilterContext) => boolean;
};

/** Keeps failed tests. Falsified is the umbrella for any failure until the extension reports errors separately. */
const isFailed = (test: Test): boolean => test.status === 'invalid';

/** Keeps tests the solver couldn't decide. */
const isUndetermined = (test: Test): boolean => test.status === 'undetermined';

/** Keeps tests that ran and have a result. `empty` means the test didn't run. */
const isExecuted = (test: Test): boolean => test.status !== 'empty';

/** Keeps tests defined in the file of the active editor. */
const isInActiveFile = (test: Test, context: FilterContext): boolean => test.location.path === context.activeFile;

/** Keeps tests defined in a file open in any editor tab. */
const isInOpenFile = (test: Test, context: FilterContext): boolean => context.openFiles.has(test.location.path);

/** The only tags the filter knows. */
export const FILTER_TAGS: Array<FilterTag> = [
  { name: 'falsified', description: 'Show Falsified Properties', matches: isFailed },
  { name: 'undetermined', description: 'Show Undetermined Properties', matches: isUndetermined },
  { name: 'error', description: 'Show Properties with Errors', matches: isFailed },
  { name: 'executed', description: 'Show Executed Properties', matches: isExecuted },
  { name: 'doc', description: 'Show Properties in the Active File', matches: isInActiveFile },
  { name: 'openedFiles', description: 'Show Properties in Open Files', matches: isInOpenFile },
];

/** Returns the known tags among the parsed (lowercase) tag keywords. Unknown or partial tags are ignored. */
export const getKnownTags = (tagKeywords: Array<string>): Array<FilterTag> => {
  const tags: Array<FilterTag> = [];
  for (const tag of FILTER_TAGS) {
    if (tagKeywords.includes(tag.name.toLowerCase())) tags.push(tag);
  }
  return tags;
};

/** Returns the index where the word at the cursor starts (just after the previous whitespace). */
const getWordStart = (text: string, cursor: number): number => {
  let start = cursor;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  return start;
};

/**
 * Returns what the user typed after `@` when the word at the cursor (up to the cursor) starts with `@`, otherwise null.
 * @example getTagQuery('foo @va', 7) // 'va'
 * @example getTagQuery('foo@va', 6) // null
 */
export const getTagQuery = (text: string, cursor: number): string | null => {
  const word = text.slice(getWordStart(text, cursor), cursor);
  return word.startsWith('@') ? word.slice(1).toLowerCase() : null;
};

/** Returns the tags whose name starts with the (lowercase) query. */
export const getTagSuggestions = (query: string): Array<FilterTag> => {
  const tags: Array<FilterTag> = [];
  for (const tag of FILTER_TAGS) {
    if (tag.name.toLowerCase().startsWith(query)) tags.push(tag);
  }
  return tags;
};

/**
 * Replaces the text from the start of the word at the cursor up to the cursor with the tag and a space.
 * Text after the cursor is kept. Returns the new text and the cursor position after the tag and its space.
 * @example insertTag('foo @fa bar', 7, 'falsified') // { text: 'foo @falsified bar', cursor: 15 }
 */
export const insertTag = (text: string, cursor: number, tagName: string): { text: string; cursor: number } => {
  const before = text.slice(0, getWordStart(text, cursor)) + '@' + tagName;
  const after = text.slice(cursor);
  const separator = /^\s/.test(after) ? '' : ' ';
  return { text: before + separator + after, cursor: before.length + 1 };
};
