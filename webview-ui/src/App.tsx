import { useState, useEffect } from 'react';
import Tabs from './components/Tabs';
import TableView from './views/tableView.tsx';

import type { WebviewApi, TheoremResult } from '../index.d.ts';

interface AppProps {
  vscode: WebviewApi<unknown>;
}

const TABS = [{label: 'Counterexample Trace'}, {label: 'Transaction Graph'}, {label: 'Run Property Info'}];

function App({ vscode }: AppProps) {
  const [testItem, setTestItem] = useState<TheoremResult|null>(null);
  const [selectedTab, setSelectedTab] = useState<number>(0);

  useEffect(() => {
    // Notify extension that webview is ready
    vscode.postMessage({ type: 'webviewReady' });

    // Listen for messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'loadPropertyResults') {
        // Handle the test item data
        setTestItem(message.payload);
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [vscode]);

  if (!testItem) {
    return (
      <div className="resultsView p-4">
        <h3 className='text-lg font-semibold'>No property selected</h3>
      </div>
    )
  }

  return (
    <div className="resultsView p-4">
      <h3 className='text-lg font-semibold'>The {testItem.theorem.label} property is <span className={`${testItem.status == "valid" ? "text-success" : "text-error"}`}>{testItem.status}</span></h3>
      <p className='text-variant'>Open the property switcher to select a new property to inspect</p>
      <div className='border-white/80 border-2 m-2 w-[200px] p-2 mt-4'>
        select box placeholder
      </div>
      <Tabs
        activeTab={selectedTab}
        onChange={setSelectedTab}
        tabs={TABS}
      />
      {<TableView />}
    </div>
  )
}

export default App
