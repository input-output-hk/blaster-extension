import { getGroupInfo, isRunnableTest } from '../../utils/treeUtils';
import { getTestRunLocation } from '../../../../../../src/utils/testRun';

export type TreeViewContextMenuEntry =
  | { action: 'run'; label: string; disabled: boolean; testRuns: Array<TestRun> }
  | { action: 'results'; label: string; disabled: boolean; test: Test }
  | { action: 'files'; label: string; disabled: boolean; payload: OpenBundleFilePayload };

/** Returns the "Open Checking Context" entry of a Haskell property, or nothing for a Lean test. */
const getCheckingContextEntries = (test: Test): Array<TreeViewContextMenuEntry> => {
  if (test.haskell === undefined) return [];
  const { generator, propertyId } = test.haskell;
  return [{
    action: 'files',
    label: 'Open Checking Context',
    disabled: false,
    payload: { workspaceId: test.workspaceId, generator, propertyId },
  }];
};

export const getContextMenuEntries = (item: TestTreeItem): Array<TreeViewContextMenuEntry> => {
  if (item.type === 'group') {
    const { tests, isRunnable } = getGroupInfo(item.node);
    const hasError = item.node.type !== 'folder' && (item.node as TestTreeFileNode).error !== undefined;
    const entries: Array<TreeViewContextMenuEntry> = [{
      action: 'run',
      label: 'Run Proofs',
      disabled: !isRunnable || hasError,
      testRuns: [{ workspaceId: item.workspaceId, tests }],
    }];
    if (item.node.type === 'generator') {
      entries.push({
        action: 'files',
        label: 'Open Generated Files…',
        disabled: (item.node as TestTreeGeneratorNode).state?.kind !== 'ready',
        payload: { workspaceId: item.workspaceId, generator: item.node.name },
      });
    }
    return entries;
  }

  const { test } = item;
  const { uri, id } = getTestRunLocation(test);
  return [
    {
      action: 'run',
      label: 'Run Proof',
      disabled: !isRunnableTest(test) || test.isRunning || test.isWaiting,
      testRuns: [{ workspaceId: test.workspaceId, tests: [{ uri, ids: [id] }] }],
    },
    { action: 'results', label: 'View Results', disabled: test.status === 'empty', test },
    ...getCheckingContextEntries(test),
  ];
};
