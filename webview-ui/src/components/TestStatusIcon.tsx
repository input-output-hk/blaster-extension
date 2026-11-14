import StatusIcon from './StatusIcon';

interface Props {
  status: RunStatus;
  isWaiting: boolean;
  isRunning: boolean;
}

const mapTestStatusToClassName = (status: RunStatus, isWaiting: boolean, isRunning: boolean): string => {
  if (isRunning) return 'codicon-loading';
  if (isWaiting) return 'codicon-history text-[var(--vscode-testing-iconQueued)]';
  switch (status) {
    case 'empty':
      return 'codicon-circle text-[var(--vscode-testing-iconUnset)]';
    case 'undetermined':
      return 'codicon-question text-[#B180D7]';
    case 'valid':
      return 'codicon-pass text-[var(--vscode-testing-iconPassed)]';
    case 'invalid':
      return 'codicon-error text-[var(--vscode-testing-iconFailed)]';
    case 'error':
      return 'codicon-info text-[var(--vscode-testing-iconErrored)]';
  }
};

const TestStatusIcon: React.FC<Props> = ({ status, isWaiting, isRunning }) => (
  <StatusIcon
    className={mapTestStatusToClassName(status, isWaiting, isRunning)}
    animated={isRunning}
  />
);

export default TestStatusIcon;