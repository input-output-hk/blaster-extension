import { VscodeTreeItem } from '@vscode-elements/react-elements';

import TreeViewTest from './TreeViewTest';
import TestStatusIcon from '../../../../components/TestStatusIcon';
import useTreeItemState from '../../../../hooks/useTreeItemState';
import { getGroupInfo } from '../../utils/treeUtils';
import { formatRunTime } from '../../../../utils/format';

interface TreeViewGroupProps {
  node: TestTreeGroupNode;
  isBusy: boolean;
  onShowTestLocation: (workspaceId: string, testId: string) => void;
  path: Array<string>;
  onRunTest: (testRuns: Array<TestRun>) => void;
  onOpenTestResult: (workspaceId: string, testId: string) => void;
  onUpdateOpenTestTreeNode: (isOpen: boolean, workspaceId: string, group?: Array<string>) => void;
}

const TreeViewGroup: React.FC<TreeViewGroupProps> = ({
  node,
  isBusy,
  onShowTestLocation,
  path,
  onRunTest,
  onUpdateOpenTestTreeNode,
  onOpenTestResult
}) => {
  const {
    workspaceId,
    testIds,
    time,
    status,
    isWaiting,
    isRunning,
    isRunnable: canRun
  } = getGroupInfo(node);
  const isRunnable = canRun && !isBusy;

  const treeItemRef = useTreeItemState({
    onToggleCollapsed: (isCollapsed) => {
      onUpdateOpenTestTreeNode(!isCollapsed, workspaceId, [...path, node.name]);
    },
  });

  const handleRunGroup = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onRunTest([{ workspaceId, testIds }]);
  };

  return (
    <VscodeTreeItem ref={treeItemRef} open={node.isOpen}>
      <TestStatusIcon
        isWaiting={isWaiting}
        isRunning={isRunning}
        status={status}
      />
      <span className="flex flex-row w-full items-center justify-between gap-0.5">
        <span
          className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-ellipsis"
          data-tooltip-id="tree-node-name"
          data-node-name={node.name}
          title={node.name}
        >
          {node.name}
          {time !== undefined && time > 0 && !isRunning && !isWaiting &&
            <span className="ml-1 opacity-60">
              {formatRunTime(time)}
            </span>
          }
        </span>
        <button
          type="button"
          className={`flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent p-0 ${
            isRunnable ? 'opacity-60 hover:opacity-100 cursor-pointer' : 'opacity-30 cursor-not-allowed'
          }`}
          disabled={!isRunnable}
          aria-label="Run Tests"
          title="Run Tests"
          onClickCapture={handleRunGroup}
          data-tooltip-id="tree-node-action"
          data-tooltip-content="Run Tests"
        >
          <i className="codicon codicon-run-all" />
        </button>
      </span>
      {node.type === 'folder' &&
        Object.values((node as TestTreeFolderNode).nodes).map(folderNode => (
          <TreeViewGroup
            key={folderNode.name}
            node={folderNode}
            isBusy={isBusy}
            onShowTestLocation={onShowTestLocation}
            path={[...path, node.name]}
            onRunTest={onRunTest}
            onOpenTestResult={onOpenTestResult}
            onUpdateOpenTestTreeNode={onUpdateOpenTestTreeNode}
          />
        ))
      }
      {node.type === 'file' &&
        Object.values((node as TestTreeFileNode).tests).map(test => (
          <TreeViewTest
            key={test.id}
            test={test}
            isBusy={isBusy}
            onShowTestLocation={onShowTestLocation}
            onRunTest={onRunTest}
            onOpenTestResult={onOpenTestResult}
          />
        ))
      }
    </VscodeTreeItem>
  );
};

export default TreeViewGroup;
