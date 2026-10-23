import { VscodeTreeItem } from '@vscode-elements/react-elements';

import TreeViewGroup from './TreeViewGroup';
import TestStatusIcon from '../../../../components/TestStatusIcon';
import useTreeItemState from '../../../../hooks/useTreeItemState';
import { formatRunTime } from '../../../../utils/format';

interface TreeViewWorkspaceProps {
  workspace: TestTreeWorkspaceNode;
  onRunTest: (testRuns: Array<TestRun>) => void;
  onOpenTestResult: (workspaceId: string, testId: string) => void;
  onUpdateOpenTestTreeNode: (isOpen: boolean, workspaceId: string, group?: Array<string>) => void;
}

const TreeViewWorkspace: React.FC<TreeViewWorkspaceProps> = ({
  workspace,
  onRunTest,
  onOpenTestResult,
  onUpdateOpenTestTreeNode
}) => {
  const isRunnable = Object.keys(workspace.nodes).length > 0 && !workspace.isRunning && !workspace.isWaiting;
  const name = workspace.path.split(/[/\\]/).filter(Boolean).at(-1) ?? workspace.path;

  const treeItemRef = useTreeItemState({
    onToggleCollapsed: (isCollapsed) => {
      onUpdateOpenTestTreeNode(!isCollapsed, workspace.id);
    },
  });

  const handleRunWorkspace = (event: React.MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onRunTest([{ workspaceId: workspace.id }]);
  };

  return (
    <VscodeTreeItem ref={treeItemRef} open={workspace.isOpen}>
      <TestStatusIcon
        isWaiting={workspace.isWaiting}
        isRunning={workspace.isRunning}
        status={workspace.status}
      />
      <span className="flex flex-row w-full items-center justify-between gap-0.5">
        <span
          className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-ellipsis"
          data-tooltip-id="tree-node-name"
          data-node-name={workspace.path}
        >
          {name}
          {workspace.time !== undefined && workspace.time > 0 &&
            <span className="ml-1 opacity-60">
              {formatRunTime(workspace.time)}
            </span>
          }
        </span>
        <button
          type="button"
          className={`flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent p-0 ${
            isRunnable ? 'opacity-60 hover:opacity-100 cursor-pointer' : 'opacity-30 cursor-not-allowed'
          }`}
          disabled={!isRunnable}
          onClickCapture={handleRunWorkspace}
          data-tooltip-id="tree-node-action"
          data-tooltip-content="Run Tests"
        >
          <i className="codicon codicon-run-all" />
        </button>
      </span>
      {Object.values(workspace.nodes).map(node => (
        <TreeViewGroup
          key={node.name}
          node={node}
          path={[]}
          onRunTest={onRunTest}
          onOpenTestResult={onOpenTestResult}
          onUpdateOpenTestTreeNode={onUpdateOpenTestTreeNode}
        />
      ))}
    </VscodeTreeItem>
  );
};

export default TreeViewWorkspace;
