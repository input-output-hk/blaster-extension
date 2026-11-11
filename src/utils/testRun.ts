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
