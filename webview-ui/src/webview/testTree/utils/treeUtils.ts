
import { getGroupStatus, getTestRunLocation } from '../../../../../src/utils/testRun';

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

  const status = getGroupStatus(tests);

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
