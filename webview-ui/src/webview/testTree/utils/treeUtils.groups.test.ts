import { describe, expect, test } from 'vitest';
import { getGroupInfo } from './treeUtils';
import { makeFile, makeFolder, makeTest, makeTree } from '../../../test/fixtures';

describe('getGroupInfo', () => {
  test('selects each file once, with the 1-based position of every test', () => {
    const { ledger } = makeTree();
    const other = makeFile('Other.lean', [makeTest('d', ['Ledger', 'Other.lean'], 0)]);
    const folder = makeFolder('Ledger', [...Object.values(ledger.nodes), other]);
    expect(getGroupInfo(folder).tests).toEqual([
      { uri: 'Ledger/Types.lean', ids: ['3:1', '10:1'] },
      { uri: 'Ledger/Other.lean', ids: ['1:1'] },
    ]);
  });

  test('adds up test times and combines statuses', () => {
    const file = makeFile('A.lean', [
      makeTest('a', ['A.lean'], 0, { status: 'valid', time: 10 }),
      makeTest('b', ['A.lean'], 1, { status: 'invalid', time: 5 }),
      makeTest('c', ['A.lean'], 2),
    ]);
    expect(getGroupInfo(file)).toMatchObject({ status: 'invalid', time: 15, isRunnable: true, isRunning: false, isWaiting: false });
  });

  test('running wins over waiting, and neither can run or show a time', () => {
    const file = makeFile('A.lean', [
      makeTest('a', ['A.lean'], 0, { isRunning: true, time: 10 }),
      makeTest('b', ['A.lean'], 1, { isWaiting: true }),
    ]);
    expect(getGroupInfo(file)).toMatchObject({ isRunning: true, isWaiting: false, isRunnable: false, time: undefined });

    const waiting = makeFile('B.lean', [makeTest('c', ['B.lean'], 0, { isWaiting: true })]);
    expect(getGroupInfo(waiting)).toMatchObject({ isRunning: false, isWaiting: true, isRunnable: false, time: undefined });
  });

  test('an empty group cannot run', () => {
    expect(getGroupInfo(makeFolder('Empty', []))).toMatchObject({ tests: [], isRunnable: false, status: 'empty', time: 0 });
  });
});
