import { useEffect, useState } from 'react'
import {
  VscodeTable,
  VscodeTableBody,
  VscodeTableRow,
  VscodeTableCell,
} from '@vscode-elements/react-elements'

import type { WebviewApi } from 'vscode-webview'

interface Props {
  vscode: WebviewApi<unknown>;
}

interface TheoremResultDetail {
  cexLabel?: string;
  counterexample?: Record<string, string|string[]>;
  depth: number | null;
  expected: boolean;
  status: 'valid' | 'falsified';
  timestamp: number;
  type: 'result';
}

const getTheoremResultDetails = (result: TheoremResult): TheoremResultDetail[] => {
  return result.details?.diagnostics
    .map(detail => {
      if (detail.severity === 'information') {
        try {
          return JSON.parse(detail.message) as TheoremResultDetail;
        } catch {
          return null;
        }
      }
      return null;
    })
    .filter(d => d !== null) || [];
}

const PropertyPanel: React.FC<Props> = ({ vscode }) => {
  const [result, setResult] = useState<TheoremResult | null>(null);
  const [details, setDetails] = useState<TheoremResultDetail[]>([]);

  useEffect(() => {
    // Notify extension that webview is ready
    vscode.postMessage({ type: 'webview-ready' });

    // Listen for messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'theorem-result') {
        setResult(message.payload);
        setDetails(getTheoremResultDetails(message.payload));
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [vscode]);

  if (!result) return <></>;

  return (
    <div className="p-4">
      <h1 className="text-xl">Theorem: {result.theorem.label}</h1>
      <h3 className="text-md">Status: {result.status}</h3>
      <h3 className="text-md">Time: {result.time}</h3>
      {details.map((d, index) =>
        <>
          <h3 className="text-lg mt-2">Counterexample {index+1}:</h3>
          <h3 className="text-md">Label: {d.cexLabel}</h3>
          <h3 className="text-md">Depth: {d.depth}</h3>
          <h3 className="text-md">Expected: {d.expected}</h3>
          <h3 className="text-md">Status: {d.status}</h3>
          <h3 className="text-md">Timestamp: {d.timestamp}</h3>
          <h3 className="text-md">Type: {d.type}</h3>
          <h3 className="text-md mt-1">Counterexample</h3>
          {d.counterexample &&
            <VscodeTable zebra>
              <VscodeTableBody>
              {Object.keys(d.counterexample || {}).map(key =>
                <VscodeTableRow key={key}>
                  <VscodeTableCell>{key}</VscodeTableCell>
                  {Array.isArray(d.counterexample?.[key]) ?
                    d.counterexample?.[key].map((val, idx) => (
                      <VscodeTableCell key={idx}>{val}</VscodeTableCell>
                    )) : <VscodeTableCell>{d.counterexample?.[key]}</VscodeTableCell>}
                </VscodeTableRow>
              )}
              </VscodeTableBody>
            </VscodeTable>
          }
        </>
      )}
    </div>
  );
}

export default PropertyPanel
