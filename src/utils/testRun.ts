export const getTestRunLocation = (test: Pick<Test, 'group' | 'location'>): { uri: string; id: string } => ({
  uri: test.group.join('/'),
  id: `${test.location.range.start.line + 1}:${test.location.range.start.character + 1}`,
});

export const matchesTestRun = (
  test: Pick<Test, 'workspaceId' | 'group' | 'location'>,
  run: TestRun
): boolean => {
  if (test.workspaceId !== run.workspaceId) return false;
  if (run.tests === undefined) return true;
  const { uri, id } = getTestRunLocation(test);
  return run.tests.some(selection =>
    selection.uri === uri && (selection.ids === undefined || selection.ids.includes(id))
  );
};

// A group with a run error still shows as valid when its other tests are valid
export const getGroupStatus = (tests: Array<Pick<Test, 'status'>>): RunStatus => {
  const has = (status: RunStatus) => tests.some(test => test.status === status);
  if (has('invalid')) return 'invalid';
  if (has('valid') && tests.every(test => test.status === 'valid' || test.status === 'error')) return 'valid';
  if (has('undetermined')) return 'undetermined';
  if (has('error')) return 'error';
  return 'empty';
};
