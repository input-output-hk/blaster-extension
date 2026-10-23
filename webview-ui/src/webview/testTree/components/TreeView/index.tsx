import { VscodeTree } from '@vscode-elements/react-elements';

import TreeViewWorkspace from './TreeViewWorkspace';

interface TreeViewProps {
  testTree: TestTree;
  onRunTest: (testRuns: Array<TestRun>) => void;
  onOpenTestResult: (workspaceId: string, testId: string) => void;
  onUpdateOpenTestTreeNode: (isOpen: boolean, workspaceId: string, group?: Array<string>) => void;
}

const TreeView: React.FC<TreeViewProps> = ({
  testTree,
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
          onRunTest={onRunTest}
          onOpenTestResult={onOpenTestResult}
          onUpdateOpenTestTreeNode={onUpdateOpenTestTreeNode}
        />
      ))}
    </VscodeTree>
  </div>
);

export default TreeView;
