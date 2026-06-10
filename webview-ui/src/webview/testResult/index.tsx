import { useEffect, useState } from 'react';
import {
  VscodeTabs,
  VscodeTabHeader,
  VscodeTabPanel,
} from '@vscode-elements/react-elements';

import type { WebviewApi } from 'vscode-webview';

import TestStatusBadge from '../components/TestStatusBadge';
import TestSelector from '../components/TestSelector';
import TestCounterexampleTab from './components/TestCounterexampleTab';
import TestGraphTab from './components/TestGraphTab';
import TestPropertiesTab from './components/TestPropertiesTab';

interface Props {
  vscode: WebviewApi<unknown>;
}

const TestResultView: React.FC<Props> = ({ vscode }) => {
  const [testResult, setTestResult] = useState<TestResult|null>(null);
  const [testTree, setTestTree] = useState<TestTree[]>([]);

  const onTestOpenDetail = (txHash: string) => {
    vscode.postMessage({
      type: 'open-result-detail',
      payload: { type: 'tx', id: txHash },
    } as WebviewToExtensionMessage);
  };

  const onTestSelected = (testId: string) => {
    vscode.postMessage({ type: 'change-test', payload: { testId } } as WebviewToExtensionMessage);
  };

  const onTestRecheck = () => {
    vscode.postMessage({ type: 'run-test' } as WebviewToExtensionMessage);
  }

  useEffect(() => {
    vscode.postMessage({ type: 'webview-ready' } as WebviewToExtensionMessage);

    const messageHandler = (event: MessageEvent) => {
      const message = event.data as ExtensionToWebviewMessage;
      if (message.type === 'test-result') {
        setTestResult(message.payload);
      }
      if (message.type === 'test-tree') {
        setTestTree(message.payload.testTree);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  if (!testResult) return <></>;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center px-2 py-1 gap-2 shrink-0 border-b border-(--vscode-panel-border) min-h-8">

        <TestSelector
          testTree={testTree}
          selectedTestId={testResult.test.id}
          onTestSelected={onTestSelected}
        />

        <TestStatusBadge status={testResult.status} />

        <div className="flex-1" />

        <button
          className="flex items-center gap-1.5 bg-base-15 text-base-06 rounded pl-2 pr-2.75 py-1.5 text-[13px] shrink-0 cursor-pointer active:bg-blue-07 active:text-base-01"
          onClick={onTestRecheck}
        >
          <i className="codicon codicon-refresh" />
          Recheck
        </button>

        <button className="flex items-center gap-1.5 bg-base-15 text-base-06 rounded pl-2 pr-2.75 py-1.5 text-[13px] shrink-0 cursor-pointer active:bg-blue-07 active:text-base-01">
          <i className="codicon codicon-cloud-download" />
          Download
        </button>

      </div>

      <VscodeTabs
        style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <VscodeTabHeader slot="header">Counterexample Trace</VscodeTabHeader>
        <VscodeTabHeader slot="header">Transaction Graph</VscodeTabHeader>
        <VscodeTabHeader slot="header">Run Property Info</VscodeTabHeader>

        <VscodeTabPanel className="flex flex-col flex-1 overflow-hidden p-0">
          <TestCounterexampleTab testResult={testResult} onOpenDetail={onTestOpenDetail} />
        </VscodeTabPanel>

        <VscodeTabPanel className="flex flex-col flex-1 overflow-hidden p-0">
          <TestGraphTab testResult={testResult} onOpenDetail={onTestOpenDetail} />
        </VscodeTabPanel>

        <VscodeTabPanel className="flex flex-col flex-1 overflow-hidden p-0">
          <TestPropertiesTab testResult={testResult} />
        </VscodeTabPanel>
      </VscodeTabs>
    </div>
  );
};

export default TestResultView;
