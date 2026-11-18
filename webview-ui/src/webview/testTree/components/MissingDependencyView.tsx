import { VscodeButton } from '@vscode-elements/react-elements';

interface Props {
  onInstall: () => void;
  onRetry: () => void;
}

const MissingDependencyView: React.FC<Props> = ({ onInstall, onRetry }) => (
  <div className="h-full p-4">
    <p className="flex items-center gap-1.5 text-[13px]">
      <i className="codicon codicon-error text-[var(--vscode-errorForeground)]" />
      Blaster Not Detected
    </p>
    <p className="mt-2 text-[12px] break-words">
      Please ensure Blaster is properly installed so the extension can run.
    </p>
    <VscodeButton
      className="mt-4 w-full max-w-[300px]"
      onClick={onInstall}
    >
      Install Blaster
    </VscodeButton>
    <p className="mt-2 text-[12px] break-words">
      Already installed?{' '}
      <button
        type="button"
        className="cursor-pointer text-[var(--vscode-textLink-foreground)] hover:underline"
        onClick={onRetry}
      >
        Retry dependency detection
      </button>.
    </p>
  </div>
);

export default MissingDependencyView;
