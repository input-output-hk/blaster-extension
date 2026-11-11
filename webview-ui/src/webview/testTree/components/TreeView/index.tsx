import { VscodeTree } from '@vscode-elements/react-elements';

import Tooltip from '../../../../components/Tooltip';
import TreeViewWorkspace from './TreeViewWorkspace';

interface TreeViewProps {
  testTree: TestTree;
  onRunTest: (testRuns: Array<TestRun>) => void;
  onFetchTestTree: () => void;
  onOpenTestResult: (workspaceId: string, testId: string) => void;
  onUpdateOpenTestTreeNode: (isOpen: boolean, workspaceId: string, group?: Array<string>) => void;
}

const TreeView: React.FC<TreeViewProps> = ({
  testTree,
  onRunTest,
  onFetchTestTree,
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
          onFetchTestTree={onFetchTestTree}
          onOpenTestResult={onOpenTestResult}
          onUpdateOpenTestTreeNode={onUpdateOpenTestTreeNode}
        />
      ))}
    </VscodeTree>
    <Tooltip id="tree-node-action" place="bottom" />
  </div>
);

export default TreeView;
