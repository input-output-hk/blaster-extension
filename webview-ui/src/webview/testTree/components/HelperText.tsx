import { useEffect, useState } from 'react';

import StatusIcon from '../../../components/StatusIcon';
import { formatRunTime } from '../../../utils/format';
import { getGroupTests } from '../utils/treeUtils';

interface Props {
  testTree: TestTree | null;
  actionState: TestTreeActionState;
}

const HelperText: React.FC<Props> = ({ testTree, actionState }) => {
  const [now, setNow] = useState(Date.now);
  const { currentAction, isBusy, run } = actionState;
  const isRunning = run !== undefined && run.finishedAt === undefined;

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const tests = Object.values(testTree?.workspaces ?? {}).flatMap(workspace =>
    Object.values(workspace.nodes).flatMap(getGroupTests)
  );
  const valid = tests.filter(test => test.status === 'valid').length;
  const hasResults = tests.some(test => test.status !== 'empty');
  const hasErrors = tests.some(test => test.status === 'invalid' || test.status === 'error');
  const showCount = hasResults || currentAction?.type === 'run';
  const count = `${valid}/${tests.length}`;
  const message = currentAction?.isCancelling ? 'Stopping...'
    : currentAction?.type === 'fetch' ? 'Fetching properties...'
    : currentAction?.type === 'clear' ? 'Clearing results...'
    : showCount ? count
    : 'No results yet.';
  const showTime = run !== undefined && showCount && (!currentAction || currentAction.type === 'run');

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-[var(--vscode-descriptionForeground)]">
      <span className="flex min-w-0 items-center gap-1" role="status">
        {(isBusy || hasResults) &&
          <StatusIcon
            animated={isBusy}
            className={isBusy ? 'codicon-loading'
              : hasErrors ? 'codicon-error text-[var(--vscode-testing-iconFailed)]'
              : 'codicon-pass text-[var(--vscode-testing-iconPassed)]'}
          />
        }
        <span aria-label={message === count ? `${valid} of ${tests.length} properties valid` : undefined}>
          {message}
        </span>
      </span>
      {showTime &&
        <span className="shrink-0 tabular-nums" aria-label="Elapsed time">
          {formatRunTime(Math.max(0, (run.finishedAt ?? now) - run.startedAt))}
        </span>
      }
    </div>
  );
};

export default HelperText;
