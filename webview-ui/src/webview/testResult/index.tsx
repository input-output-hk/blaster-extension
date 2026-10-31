import { useEffect, useState, useRef } from 'react';

import RunningIndicator from '../../components/RunningIndicator';
import TestHeader from '../../components/TestHeader';
import Tabs from './components/Tabs';
import CounterexampleView from './components/CounterexampleView';
import TransactionGraphView from './components/TransactionGraphView';

import type { WebviewApi } from 'vscode-webview';
import type { TransactionGraphViewRef } from './components/TransactionGraphView';

const COUNTEREXAMPLE_TAB = 'counterexample';
const TX_GRAPH_TAB = 'graph';

interface Props {
  vscode: WebviewApi<unknown>;
}

const TestResultView: React.FC<Props> = ({ vscode }) => {
  const graphRef = useRef<TransactionGraphViewRef>(null);
  const [test, setTest] = useState<Test|null>(null);
  const [testResult, setTestResult] = useState<TestResult|null>(null);
  const [selectedTab, setSelectedTab] = useState<string>(COUNTEREXAMPLE_TAB);

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data as ExtensionToWebviewMessage;
      if (message.type === 'test-result') {
        setTest(message.payload.test);
        setTestResult(message.payload.result);
      }
    };

    window.addEventListener('message', messageHandler);
    vscode.postMessage({ type: 'webview-ready' } as WebviewToExtensionMessage);
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  if (!test) return <></>;
  
  const hasResult = !!(testResult?.steps?.length || testResult?.graph?.length);

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex-none pt-4 px-4">
        <TestHeader test={test} />
      </div>

      { test.isRunning &&
        <RunningIndicator />
      }

      { !test.isRunning && !hasResult &&
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <span className="text-md">This test does not have any results</span>
        </div>
      }

      { testResult !== null && hasResult &&
        <Tabs
          className="flex-1 min-h-0 flex flex-col p-4"
          panelClassName="flex-1 min-h-0 pt-4"
          selectedId={selectedTab}
          onSelect={setSelectedTab}
          tabs={[
            {
              id: COUNTEREXAMPLE_TAB,
              label: 'Counterexamples Table',
              panel: (
                <CounterexampleView
                  key={`${test.workspaceId}:${test.id}`}
                  test={test}
                  testResult={testResult}
                  isActive={selectedTab === COUNTEREXAMPLE_TAB}
                />
              ),
            },
            {
              id: TX_GRAPH_TAB,
              label: 'Transaction Graph',
              panel: (
                <TransactionGraphView
                  ref={graphRef}
                  test={test}
                  testResult={testResult}
                  isActive={selectedTab === TX_GRAPH_TAB}
                />
              ),
            },
          ]}
        />
      }
    </div>
  );
};

export default TestResultView;
