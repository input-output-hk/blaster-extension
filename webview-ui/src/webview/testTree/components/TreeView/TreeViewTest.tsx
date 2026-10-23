import { VscodeTreeItem } from '@vscode-elements/react-elements';

import TestStatusIcon from '../../../../components/TestStatusIcon';
import { formatRunTime } from '../../../../utils/format';

interface TreeViewTestProps {
  test: Test;
  onRunTest: (testRuns: Array<TestRun>) => void;
  onOpenTestResult: (workspaceId: string, testId: string) => void;
}

const TreeViewTest: React.FC<TreeViewTestProps> = ({
  test,
  onRunTest,
  onOpenTestResult
}) => {
  const isRunnable = !test.isRunning && !test.isWaiting;
  const hasResult = test.status === 'invalid';

  const handleOpenTestResult = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onOpenTestResult(test.workspaceId, test.id);
  };

  const handleRunTest = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onRunTest([{ workspaceId: test.workspaceId, testIds: [test.id] }]);
  };

  return (
    <VscodeTreeItem>
      <TestStatusIcon
        isWaiting={test.isWaiting}
        isRunning={test.isRunning}
        status={test.status}
      />
      <span className="flex flex-row w-full items-center justify-between gap-0.5">
        <span
          className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-ellipsis"
          data-tooltip-id="tree-node-name"
          data-node-name={test.name}
        >
          {test.name}
          {test.time !== undefined && test.time > 0 &&
            <span className="ml-1 opacity-60">
              {formatRunTime(test.time)}
            </span>
          }
        </span>

        {hasResult &&
          <button
            type="button"
            className="flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent p-0 opacity-60 hover:opacity-100 cursor-pointer"
            onClickCapture={handleOpenTestResult}
            data-tooltip-id="tree-node-action"
            data-tooltip-content="View Results"
          >
            <i className="codicon codicon-tasklist" />
          </button>
        }

        <button
          type="button"
          className={`flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent p-0 ${
            isRunnable ? 'opacity-60 hover:opacity-100 cursor-pointer' : 'opacity-30 cursor-not-allowed'
          }`}
          disabled={!isRunnable}
          onClickCapture={handleRunTest}
          data-tooltip-id="tree-node-action"
          data-tooltip-content="Run Test"
        >
          <i className="codicon codicon-play" />
        </button>
      </span>
    </VscodeTreeItem>
  );
};

export default TreeViewTest;
