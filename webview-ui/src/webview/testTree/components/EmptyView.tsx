import { VscodeButton } from '@vscode-elements/react-elements';

interface Props {
  message: 'empty-workspaces' | 'empty-tree';
  onOpenFolder: () => void;
}

const MESSAGE_EMPTY_WORKSPACES = 'No folders detected in the workspace. Open a folder with the necessary test suite files for tests to appear.';
const MESSAGE_EMPTY_TREE = 'No test suites found in this workspace. Open a different folder, or add a test-suite file to the open folder.';

const EmptyView: React.FC<Props> = ({ onOpenFolder, message }) => (
  <div className="h-full p-4">
    <p className="text-[12px]">
      {message === 'empty-workspaces' ? MESSAGE_EMPTY_WORKSPACES : MESSAGE_EMPTY_TREE}
    </p>
    <VscodeButton
      className="mt-4 w-full max-w-[300px]"
      onClick={onOpenFolder}
    >
      Open Folder
    </VscodeButton>
  </div>
);

export default EmptyView;