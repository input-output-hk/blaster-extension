
export type TestGroupInfo = {
  workspaceId: string;
  testIds: Array<string>;
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

  const isRunning = tests.some(test => test.isRunning);
  const isWaiting = tests.some(test => test.isWaiting) && !isRunning;

  const status = tests.some(test => test.status === 'invalid')
    ? 'invalid'
    : tests.length > 0 && tests.every(test => test.status === 'valid') ? 'valid' : 'undetermined';

  const time = isWaiting || isRunning ? undefined
    : tests.reduce((sum, test) => sum + (test.time ?? 0), 0);

  return {
    workspaceId: tests[0]?.workspaceId ?? '',
    testIds: tests.map(test => test.id),
    isRunnable: tests.length > 0 && !isWaiting && !isRunning,
    isWaiting,
    isRunning,
    status,
    time
  };
};
