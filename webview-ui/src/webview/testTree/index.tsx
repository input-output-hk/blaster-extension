import { useEffect, useState } from 'react';

import WelcomeView from './components/WelcomeView';
import LoadingView from './components/LoadingView';
import TreeView from './components/TreeView';

import type { WebviewApi } from 'vscode-webview';

interface Props {
  vscode: WebviewApi<unknown>;
}

const TestTreeView: React.FC<Props> = ({ vscode }) => {
  const [activeView, setActiveView] = useState<'welcome'|'building'|'tree'>('welcome');
  const [testTree, setTestTree] = useState<TestTree[]|null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    vscode.postMessage({ type: 'webview-ready' } as WebviewToExtensionMessage);

    const messageHandler = (event: MessageEvent) => {
      const message = event.data as ExtensionToWebviewMessage;
      if (message.type === 'test-tree') {
        setTestTree(message.payload.testTree);
        setTestResults(message.payload.testResults!);
        setActiveView('tree');
      }
      if (message.type === 'test-result') {
        setTestResults((prev) => ({ ...prev, [message.payload.test.id]: message.payload }));
      }
    };

    window.addEventListener('message', messageHandler);
    
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  const onScanWorkspace = () => {
    setActiveView('building');
    vscode.postMessage({ type: 'scan-workspace' } as WebviewToExtensionMessage);
  };

  const onRunTest = (testIds: string[]) => {
    vscode.postMessage({ type: 'run-test', payload: { testIds } } as WebviewToExtensionMessage);
  }

  const onOpenResult = (testId: string) => {
    vscode.postMessage({ type: 'open-result', payload: { testId } } as WebviewToExtensionMessage);
  }

  return (
    <>
      {activeView === 'welcome' && <WelcomeView onScanWorkspace={onScanWorkspace} />}
      {activeView === 'building' && <LoadingView />}
      {activeView === 'tree' && (
        <TreeView
          testTree={testTree||[]}
          testResults={testResults}
          onRunTest={onRunTest}
          onOpenResult={onOpenResult}
        />
      )}
    </>
  )
};

export default TestTreeView;
