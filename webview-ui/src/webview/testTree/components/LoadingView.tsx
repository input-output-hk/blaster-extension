import { VscodeProgressBar } from '@vscode-elements/react-elements';

const LoadingView: React.FC = () => (
  <div className="h-full">
    <VscodeProgressBar indeterminate />
  </div>
);

export default LoadingView;
