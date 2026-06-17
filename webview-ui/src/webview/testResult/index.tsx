import { useEffect, useState } from 'react';
import { NotifyProvider } from '../hooks/useNotify';
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

function findTestsInNode(nodes: TestTreeNode[], testId: string): Test[] | null {
  for (const node of nodes) {
    if (node.type === 'folder') {
      const result = findTestsInNode((node as TestTreeFolderNode).children, testId);
      if (result) return result;
    } else if (node.type === 'file') {
      const tests = (node as TestTreeFileNode).tests;
      if (tests.some(t => t.id === testId)) return tests;
    }
  }
  return null;
}

function getSiblingTests(testTree: TestTree[], testId: string): Test[] {
  for (const root of testTree) {
    const result = findTestsInNode(root.children, testId);
    if (result) return result;
  }
  return [];
}

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
  };

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
    <NotifyProvider vscode={vscode}>
    <div className="flex flex-col h-full overflow-hidden bg-base-20 p-4">
      <div className="flex items-center py-1 gap-2 shrink-0 border-b border-(--vscode-panel-border) min-h-8">

        <TestSelector
          tests={getSiblingTests(testTree, testResult.test.id)}
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
        className="flex-1 flex flex-col overflow-hidden min-h-0 mb-4"
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
    </NotifyProvider>
  );
};

export default TestResultView;
