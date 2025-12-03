import { useState, useEffect } from 'react'
import type { WebviewApi, PropertyNode } from '../index.d.ts';
import Tabs from './components/Tabs';
import TableView from './views/tableView.tsx';

interface AppProps {
  vscode: WebviewApi<unknown>;
}

function App({ vscode }: AppProps) {
  const [testItem, setTestItem] = useState({} as PropertyNode);
  console.log(testItem);

  const tabs = [{label: 'Run Property Info'}];
  if (testItem.status === 'falsified') {
    tabs.unshift({label: 'Counterexample Trace'}, {label: 'Transaction Graph'});
  }

  const [selectedTab, setSelectedTab] = useState(tabs[0].label);

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
  }, []);


  return (
    <div className="resultsView p-4">
      <h3 className='text-lg font-semibold'>The {testItem.label} property is <span className={`${testItem.status == "valid" ? "text-success" : "text-error"}`}>{testItem.status}</span></h3>
      <p className='text-variant'>Open the property switcher to select a new property to inspect</p>
      <div className='border-white/80 border-2 m-2 w-[200px] p-2 mt-4'>
        select box placeholder
      </div>
      <Tabs
        activeTab={selectedTab}
        onChange={(e) => setSelectedTab(e.target.id)}
        tabs={tabs}
      />
      {<TableView />}
    </div>
  )
}

export default App
