import { describe, expect, test } from 'vitest';
import { getKnownTags, getTagQuery, getTagSuggestions, insertTag, type FilterTag } from './filterTags';

/** Returns the name of a tag. */
const getTagName = (tag: FilterTag): string => tag.name;

describe('getKnownTags', () => {
  test('keeps known tags and ignores unknown or partial ones', () => {
    expect(getKnownTags(['falsified', 'falsi', 'foo', 'executed']).map(getTagName)).toEqual(['falsified', 'executed']);
  });

  test('matches camelCase tags from lowercase keywords', () => {
    expect(getKnownTags(['openedfiles']).map(getTagName)).toEqual(['openedFiles']);
  });
});

describe('getTagQuery', () => {
  test('returns the text after @', () => {
    expect(getTagQuery('foo @fa', 7)).toBe('fa');
  });

  test('returns an empty query for a lone @', () => {
    expect(getTagQuery('@', 1)).toBe('');
  });

  test('lowercases the query', () => {
    expect(getTagQuery('@FA', 3)).toBe('fa');
  });

  test('ignores @ in the middle of a word', () => {
    expect(getTagQuery('foo@fa', 6)).toBeNull();
  });

  test('ignores a word starting with !', () => {
    expect(getTagQuery('!@fa', 4)).toBeNull();
  });

  test('only looks at the word at the cursor', () => {
    expect(getTagQuery('@fa bar', 7)).toBeNull();
  });
});

describe('getTagSuggestions', () => {
  test('suggests every tag for an empty query', () => {
    expect(getTagSuggestions('').map(getTagName)).toEqual([
      'falsified', 'undetermined', 'error', 'executed', 'doc', 'openedFiles',
    ]);
  });

  test('suggests tags starting with the query', () => {
    expect(getTagSuggestions('e').map(getTagName)).toEqual(['error', 'executed']);
  });

  test('matches camelCase tags from a lowercase query', () => {
    expect(getTagSuggestions('opened').map(getTagName)).toEqual(['openedFiles']);
  });

  test('suggests nothing when no tag matches', () => {
    expect(getTagSuggestions('@fal')).toEqual([]);
  });
});

describe('insertTag', () => {
  test('inserts the tag before the text after the cursor', () => {
    expect(insertTag('@bar', 1, 'falsified')).toEqual({ text: '@falsified bar', cursor: 11 });
  });

  test('replaces only up to the cursor', () => {
    expect(insertTag('@fal', 3, 'falsified')).toEqual({ text: '@falsified l', cursor: 11 });
  });

  test('does not add a space when one already follows', () => {
    expect(insertTag('foo @fa bar', 7, 'falsified')).toEqual({ text: 'foo @falsified bar', cursor: 15 });
  });

  test('adds a space at the end of the text', () => {
    expect(insertTag('foo @op', 7, 'openedFiles')).toEqual({ text: 'foo @openedFiles ', cursor: 17 });
  });
});
