import { useEffect, useState } from "react";
import type { WebviewApi } from "vscode-webview";
import Paginator from "../Paginator";
import RunningIndicator from "../RunningIndicator";

interface Props {
  vscode: WebviewApi<unknown>;
}

const Section: React.FC<{
  label: string;
  items: unknown[];
  index: number;
  onIndexChange: (i: number) => void;
}> = ({ label, items, index, onIndexChange }) => (
  <div className="flex-1 min-h-0 flex flex-col gap-2 p-4">
    <div className="flex items-center justify-between shrink-0">
      <span className="text-base-06 text-[12px] font-bold uppercase tracking-wide">{label}</span>
      {items.length > 1 && (
        <Paginator index={index} total={items.length} onChange={onIndexChange} />
      )}
    </div>
    <div className="flex-1 min-h-0 rounded-md bg-base-20 [box-shadow:inset_0_2px_8px_rgba(0,0,0,0.6)] overflow-auto p-3">
      {items.length > 0
        ? <pre className="text-base-05 text-[11px] whitespace-pre-wrap break-all m-0">{JSON.stringify(items[index], null, 2)}</pre>
        : <span className="text-base-09 text-[12px]">—</span>
      }
    </div>
  </div>
);

const TestResultDetail: React.FC<Props> = ({ vscode }) => {
  const [detail, setDetail] = useState<TestResultTxDetail | null>(null);
  const [status, setStatus] = useState<TestResult['status']>('running');
  const [inputIndex, setInputIndex] = useState(0);
  const [outputIndex, setOutputIndex] = useState(0);

  useEffect(() => {
    vscode.postMessage({ type: "webview-ready" } as WebviewToExtensionMessage);

    const handler = (event: MessageEvent) => {
      const message = event.data as ExtensionToWebviewMessage;
      if (message.type === "test-result") {
        setStatus(message.payload.status);
      }
      if (message.type === "test-result-detail") {
        setDetail(message.payload as TestResultTxDetail);
        setInputIndex(0);
        setOutputIndex(0);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [vscode]);

  if (status === 'running') return <div className="flex flex-col h-full"><RunningIndicator /></div>;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Section
        label="Input"
        items={detail?.data.inputs ?? []}
        index={inputIndex}
        onIndexChange={setInputIndex}
      />
      <div className="h-px bg-base-13 shrink-0 mx-4" />
      <Section
        label="Output"
        items={detail?.data.outputs ?? []}
        index={outputIndex}
        onIndexChange={setOutputIndex}
      />
    </div>
  );
};

export default TestResultDetail;
