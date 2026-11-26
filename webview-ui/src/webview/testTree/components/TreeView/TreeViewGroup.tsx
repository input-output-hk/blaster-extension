import { VscodeTreeItem } from '@vscode-elements/react-elements';

import TreeViewTest from './TreeViewTest';
import TestStatusIcon from '../../../../components/TestStatusIcon';
import useTreeItemState from '../../../../hooks/useTreeItemState';
import { getGroupInfo, HASKELL_RUN_UNAVAILABLE } from '../../utils/treeUtils';
import { formatRunTime } from '../../../../utils/format';

/** Returns the executable name of a generator target (`package:exe:name` → `name`). */
const getGeneratorLabel = (target: string): string => target.split(':').at(-1) ?? target;

interface TreeViewGroupProps {
  node: TestTreeGroupNode;
  workspaceId: string;
  path: Array<string>;
  visible: Set<VisibleItem>;
  onRunTest: (testRuns: Array<TestRun>) => void;
  onFetchTestTree: () => void;
  onOpenTestResult: (workspaceId: string, testId: string) => void;
  onUpdateOpenTestTreeNode: (isOpen: boolean, workspaceId: string, group?: Array<string>) => void;
  onContextMenu: (event: React.MouseEvent, item: TestTreeItem) => void;
}

const TreeViewGroup: React.FC<TreeViewGroupProps> = ({
  node,
  workspaceId,
  path,
  visible,
  onRunTest,
  onFetchTestTree,
  onUpdateOpenTestTreeNode,
  onOpenTestResult,
  onContextMenu
}) => {
  const {
    tests,
    time,
    status,
    isWaiting,
    isRunning,
    isRunnable: canRun
  } = getGroupInfo(node);
  const error = node.type !== 'folder' ? (node as TestTreeFileNode).error : undefined;
  const isRunnable = canRun && error === undefined;
  const isGenerator = node.type === 'generator';
  const label = isGenerator ? getGeneratorLabel(node.name) : node.name;

  const treeItemRef = useTreeItemState({
    onToggleCollapsed: (isCollapsed) => {
      onUpdateOpenTestTreeNode(!isCollapsed, workspaceId, [...path, node.name]);
    },
  });

  const handleRunGroup = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onRunTest([{ workspaceId, tests }]);
  };

  /** Returns whether the filter left this node or test visible. */
  const isVisible = (item: TestTreeGroupNode | Test): boolean => visible.has(item);

  const handleRetryDiscovery = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onFetchTestTree();
  };

  const handleContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu(event, { type: 'group', workspaceId, node });
  };

  return (
    <VscodeTreeItem ref={treeItemRef} open={node.isOpen} onContextMenu={handleContextMenu}>
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
        >
          {label}
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
            className="flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent p-0 opacity-60 hover:opacity-100 cursor-pointer"
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
          onClickCapture={handleRunGroup}
          data-tooltip-id="tree-node-action"
          data-tooltip-content={isGenerator ? HASKELL_RUN_UNAVAILABLE : 'Run Tests'}
        >
          <i className="codicon codicon-run-all" />
        </button>
      </span>
      {node.type === 'folder' &&
        Object.values((node as TestTreeFolderNode).nodes).filter(isVisible).map(folderNode => (
          <TreeViewGroup
            key={folderNode.name}
            node={folderNode}
            workspaceId={workspaceId}
            path={[...path, node.name]}
            visible={visible}
            onRunTest={onRunTest}
            onFetchTestTree={onFetchTestTree}
            onOpenTestResult={onOpenTestResult}
            onUpdateOpenTestTreeNode={onUpdateOpenTestTreeNode}
            onContextMenu={onContextMenu}
          />
        ))
      }
      {node.type !== 'folder' &&
        Object.values((node as TestTreeFileNode).tests).filter(isVisible).map(test => (
          <TreeViewTest
            key={test.id}
            test={test}
            onRunTest={onRunTest}
            onOpenTestResult={onOpenTestResult}
            onContextMenu={onContextMenu}
          />
        ))
      }
    </VscodeTreeItem>
  );
};

export default TreeViewGroup;
