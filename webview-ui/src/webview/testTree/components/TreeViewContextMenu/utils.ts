import { getGroupInfo } from '../../utils/treeUtils';
import { getTestRunLocation } from '../../../../../../src/utils/testRun';

export type TreeViewContextMenuEntry =
  | { action: 'run'; label: string; disabled: boolean; testRuns: Array<TestRun> }
  | { action: 'results'; label: string; disabled: boolean; test: Test };

export const getContextMenuEntries = (item: TestTreeItem): Array<TreeViewContextMenuEntry> => {
  if (item.type === 'group') {
    const { tests, isRunnable } = getGroupInfo(item.node);
    const hasError = item.node.type === 'file' && (item.node as TestTreeFileNode).error !== undefined;
    return [{
      action: 'run',
      label: 'Run Proofs',
      disabled: !isRunnable || hasError,
      testRuns: [{ workspaceId: item.workspaceId, tests }],
    }];
  }

  const { test } = item;
  const { uri, id } = getTestRunLocation(test);
  return [
    {
      action: 'run',
      label: 'Run Proof',
      disabled: test.isRunning || test.isWaiting,
      testRuns: [{ workspaceId: test.workspaceId, tests: [{ uri, ids: [id] }] }],
    },
    { action: 'results', label: 'View Results', disabled: test.status === 'empty', test },
  ];
};
