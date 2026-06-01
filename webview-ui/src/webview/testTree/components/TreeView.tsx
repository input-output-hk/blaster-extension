import {
  VscodeTree,
  VscodeTreeItem,
} from '@vscode-elements/react-elements';

interface TreeViewProps {
  testTree: TestTree[];
  testResults: Record<string, TestResult>;
  onRunTest: (testIds: string[]) => void;
  onOpenResult: (testId: string) => void;
}

interface TreeViewRootProps {
  root: TestTree;
  results: Record<string, TestResult>;
  onRunTest: (testIds: string[]) => void;
  onOpenResult: (testId: string) => void;
}

interface TreeViewNodeProps {
  node: TestTreeNode;
  results: Record<string, TestResult>;
  onRunTest: (testIds: string[]) => void;
  onOpenResult: (testId: string) => void;
}

interface TreeViewTestProps {
  test: Test;
  result?: TestResult;
  onRunTest: (testIds: string[]) => void;
  onOpenResult: (testId: string) => void;
}

const TreeViewRoot: React.FC<TreeViewRootProps> = ({ root, results, onRunTest, onOpenResult }) => (
  <VscodeTreeItem>
    <i className="codicon codicon-project" />
    {root.label}
    {root.children.map((node, index) => <TreeViewNode key={index} node={node} results={results} onRunTest={onRunTest} onOpenResult={onOpenResult} />)}
  </VscodeTreeItem>
);

const TreeViewNode: React.FC<TreeViewNodeProps> = ({ node, results, onRunTest, onOpenResult }) => (
  <VscodeTreeItem>
    {node.type === 'file' && <img src="assets/test-icon.svg" />}
    {node.type === 'folder' && <i className="codicon codicon-folder translate-y-1" slot="icon-branch" />}
    {node.type === 'folder' && <i className="codicon codicon-folder-opened translate-y-1" slot="icon-branch-opened" />}
    <span className="flex flex-row w-full items-center justify-between gap-0.5">
      <span className="flex-1 min-w-0 text-base-06 overflow-hidden whitespace-nowrap text-ellipsis">
        {node.label}
      </span>
      {node.type === 'file' &&
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-base-12 hover:text-base-06 cursor-pointer"
          onClickCapture={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            onRunTest((node as TestTreeFileNode).tests.map(test => test.id));
          }}
        >
          <i className="codicon codicon-run-all" />
        </button>
      }
    </span>
    {node.type === 'folder' && (node as TestTreeFolderNode).children.map((node, index) => <TreeViewNode key={index} node={node} results={results} onRunTest={onRunTest} onOpenResult={onOpenResult} />)}
    {node.type === 'file' && (node as TestTreeFileNode).tests.map((test, index) => <TreeViewTest key={index} test={test} result={results[test.id]} onRunTest={onRunTest} onOpenResult={onOpenResult} />)}
  </VscodeTreeItem>
);

const TreeViewTest: React.FC<TreeViewTestProps> = ({ test, result, onRunTest, onOpenResult }) => (
  <VscodeTreeItem>
    {(!result || result.status === 'undetermined') && <i className="codicon codicon-circle text-base-10 translate-y-0.75" slot="icon-leaf" />}
    {(result && result.status === 'valid') && <i className="codicon codicon-pass text-green-01 translate-y-0.75" slot="icon-leaf" />}
    {(result && result.status === 'invalid') && <i className="codicon codicon-error text-red-01 translate-y-0.75" slot="icon-leaf" />}
    {(result && result.status === 'running') && <i className="codicon codicon-question text-purple-02 translate-y-0.75" slot="icon-leaf" />}
    <span className="flex flex-row w-full items-center justify-between gap-0.5">
      <span className="flex-1 min-w-0 text-base-06 overflow-hidden whitespace-nowrap text-ellipsis">
        {test.label}
        {(result && result.time !== undefined && result.time > 0) &&
          <span className="ml-1 text-base-09">
            {result.time}ms
          </span>
        }
      </span>
      {(result && result.details) &&
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-base-12 hover:text-base-06 cursor-pointer"
          onClickCapture={() => onOpenResult(test.id)}
        >
          <i className="codicon codicon-book" />
        </button>
      }
      {(!result || result.status !== 'running') &&
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-base-12 hover:text-base-06 cursor-pointer"
          onClickCapture={() => onRunTest([test.id])}
        >
          <i className="codicon codicon-play" />
        </button>
      }
      {(result && result.status === 'running') &&
        <i className="codicon codicon-loading h-5 w-5 text-base-06 animate-spin" />
      }
    </span>
  </VscodeTreeItem>
);

const TreeView: React.FC<TreeViewProps> = ({ testTree, testResults, onRunTest, onOpenResult }) => (
  <div className="h-full">
    <VscodeTree>
      {testTree.map((root, index) =>
        <TreeViewRoot
          key={index}
          root={root}
          results={testResults}
          onRunTest={onRunTest}
          onOpenResult={onOpenResult}
        />
      )}
    </VscodeTree>
  </div>
);

export default TreeView;