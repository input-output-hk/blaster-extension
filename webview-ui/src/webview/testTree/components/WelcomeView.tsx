import { VscodeButton } from '@vscode-elements/react-elements';

interface Props {
  onFetchTestTree: () => void;
}

const WelcomeView: React.FC<Props> = ({ onFetchTestTree }) => (
  <div className="flex flex-col items-center justify-center h-full gap-2">
    <img src="assets/blaster-logo.svg" className="w-20 h-20 pb-2" />
    <h1 className="text-2xl text-center font-semibold">Welcome to Blaster</h1>
    <p className="text-md text-center font-medium pb-4">Scan your workspace files to get started</p>
    <VscodeButton onClick={onFetchTestTree}>Run test extension</VscodeButton>
  </div>
);

export default WelcomeView;