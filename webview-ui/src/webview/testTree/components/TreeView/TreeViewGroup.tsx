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
  onFetchTestTree: () => void;
  path: Array<string>;
  onRunTest: (testRuns: Array<TestRun>) => void;
  onOpenTestResult: (workspaceId: string, testId: string) => void;
  onUpdateOpenTestTreeNode: (isOpen: boolean, workspaceId: string, group?: Array<string>) => void;
}

const TreeViewGroup: React.FC<TreeViewGroupProps> = ({
  node,
  isBusy,
  onShowTestLocation,
  onFetchTestTree,
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
  const error = node.type === 'file' ? (node as TestTreeFileNode).error : undefined;
  const isRunnable = canRun && !isBusy && error === undefined;

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

  const handleRetryDiscovery = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onFetchTestTree();
  };

  return (
    <VscodeTreeItem ref={treeItemRef} open={node.isOpen}>
      {error !== undefined
        ? <i className="mr-0.5 codicon codicon-error text-[var(--vscode-errorForeground)]" />
        : <TestStatusIcon
            isWaiting={isWaiting}
            isRunning={isRunning}
            status={status}
          />
      }
      <span className="flex flex-row w-full items-center justify-between gap-0.5">
        <span
          className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-ellipsis"
          data-tooltip-id="tree-node-name"
          data-node-name={node.name}
          title={node.name}
        >
          {node.name}
          {error !== undefined &&
            <span
              className="ml-1 text-[var(--vscode-errorForeground)]"
              data-tooltip-id="tree-node-action"
              data-tooltip-content={error}
            >
              Discovery Failed
            </span>
          }
          {error === undefined && time !== undefined && time > 0 && !isRunning && !isWaiting &&
            <span className="ml-1 opacity-60">
              {formatRunTime(time)}
            </span>
          }
        </span>
        {error !== undefined &&
          <button
            type="button"
            className={`flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent p-0 ${
              isBusy ? 'opacity-30 cursor-not-allowed' : 'opacity-60 hover:opacity-100 cursor-pointer'
            }`}
            disabled={isBusy}
            aria-label="Retry Discovery"
            onClickCapture={handleRetryDiscovery}
            data-tooltip-id="tree-node-action"
            data-tooltip-content="Retry Discovery"
          >
            <i className="codicon codicon-refresh" />
          </button>
        }
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
            onFetchTestTree={onFetchTestTree}
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
