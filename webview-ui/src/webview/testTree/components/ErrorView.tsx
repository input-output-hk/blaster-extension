import { VscodeButton } from '@vscode-elements/react-elements';

interface Props {
  onFetchTestTree: () => void;
}

const ErrorView: React.FC<Props> = ({ onFetchTestTree }) => (
  <div className="h-full p-4">
    <p className="flex items-center gap-1.5 text-[13px]">
      <i className="codicon codicon-error text-[var(--vscode-errorForeground)]" />
      Property Detection Failure
    </p>
    <p className="mt-2 text-[12px] break-words">
      Error occurred while attempting to discover properties. View the output panel for more details.
    </p>
    <VscodeButton
      className="mt-4 w-full max-w-[300px]"
      onClick={onFetchTestTree}
    >
      Retry
    </VscodeButton>
  </div>
);

export default ErrorView;
