import { VscodeTree } from '@vscode-elements/react-elements';

import TreeViewWorkspace from './TreeViewWorkspace';

interface TreeViewProps {
  testTree: TestTree;
  isBusy: boolean;
  onShowTestLocation: (workspaceId: string, testId: string) => void;
  onRunTest: (testRuns: Array<TestRun>) => void;
  onOpenTestResult: (workspaceId: string, testId: string) => void;
  onUpdateOpenTestTreeNode: (isOpen: boolean, workspaceId: string, group?: Array<string>) => void;
}

const TreeView: React.FC<TreeViewProps> = ({
  testTree,
  isBusy,
  onShowTestLocation,
  onRunTest,
  onUpdateOpenTestTreeNode,
  onOpenTestResult
}) => (
  <div className="h-full overflow-y-auto">
    <VscodeTree>
      {Object.values(testTree.workspaces).map(workspace => (
        <TreeViewWorkspace
          key={workspace.id}
          workspace={workspace}
          isBusy={isBusy}
          onShowTestLocation={onShowTestLocation}
          onRunTest={onRunTest}
          onOpenTestResult={onOpenTestResult}
          onUpdateOpenTestTreeNode={onUpdateOpenTestTreeNode}
        />
      ))}
    </VscodeTree>
  </div>
);

export default TreeView;
