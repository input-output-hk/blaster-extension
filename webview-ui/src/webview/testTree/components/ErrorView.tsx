import { VscodeButton } from '@vscode-elements/react-elements';

interface Props {
  message?: string;
  onFetchTestTree: () => void;
}

const ErrorView: React.FC<Props> = ({ onFetchTestTree, message }) => (
  <div className="h-full p-4">
    <p className="text-[12px] break-words">{message ?? 'Unable to discover tests.'}</p>
    <VscodeButton
      className="mt-4 w-full max-w-[300px]"
      onClick={onFetchTestTree}
    >
      Retry
    </VscodeButton>
  </div>
);

export default ErrorView;