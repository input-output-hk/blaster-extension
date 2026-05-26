import { useEffect, useState } from "react";
import {
  VscodeTabs,
  VscodeTabHeader,
  VscodeTabPanel,
  VscodeSingleSelect,
  VscodeOption,
} from "@vscode-elements/react-elements";

import type { WebviewApi } from "vscode-webview";


import TheoremStatusBadge from "../components/TheoremStatusBadge/index";
import CounterExampleTab from "../components/tabs/CounterExampleTab";
import GraphTab from "../components/tabs/GraphTab";
import RunPropertyInfoTab from "../components/tabs/RunPropertyInfoTab";

interface Props {
  vscode: WebviewApi<unknown>;
}

const getTheoremResultDetails = (
  result: TheoremResult,
): TheoremResultDetail[] => {
  return (
    result.details?.diagnostics
      .map((detail) => {
        if (detail.severity === "information") {
          try {
            return JSON.parse(detail.message) as TheoremResultDetail;
          } catch {
            return null;
          }
        }
        return null;
      })
      .filter((d) => d !== null) || []
  );
};

const toDisplayStatus = (status: string) => {
  if (status === "invalid") return "Falsified";
  if (status === "valid") return "Valid";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

type SelectItem =
  | { type: "header"; label: string }
  | { type: "theorem"; id: string; label: string };

type WsNode = {
  type: "folder" | "file";
  label: string;
  theorems?: Theorem[];
  children?: WsNode[];
};

const flattenWorkspaces = (workspaces: Workspace[]): SelectItem[] => {
  const items: SelectItem[] = [];
  const visit = (node: WsNode) => {
    if (node.type === "file") {
      if (node.theorems && node.theorems.length > 0) {
        items.push({ type: "header", label: node.label });
        node.theorems.forEach((t) =>
          items.push({ type: "theorem", id: t.id, label: `  ${t.label}` })
        );
      }
    } else {
      node.children?.forEach(visit);
    }
  };
  workspaces.forEach((ws) =>
    ws.children.forEach((child) => visit(child as unknown as WsNode))
  );
  return items;
};

const PropertyPanel: React.FC<Props> = ({ vscode }) => {
  const [result, setResult] = useState<TheoremResult | null>(null);
  const [details, setDetails] = useState<TheoremResultDetail[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    vscode.postMessage({ type: "webview-ready" } as WebviewToExtensionMessage);

    // Example of sending a message to the extension when a theorem is selected
    // vscode.postMessage({ type: "change-theorem", payload: { theoremId: "example-theorem-id" } } as WebviewToExtensionMessage);

    // Example of sending a message to the extension to run the current theorem
    // vscode.postMessage({ type: "run-theorem" } as WebviewToExtensionMessage);

    // Example of sending a message to the extension to set fullscreen mode
    // vscode.postMessage({ type: "set-fullscreen" } as WebviewToExtensionMessage);

    const messageHandler = (event: MessageEvent) => {
      const message = event.data as ExtensionToWebviewMessage;
      if (message.type === "theorem-result") {
        setResult(message.payload);
        setDetails(
          message.payload.status === "running"
            ? []
            : getTheoremResultDetails(message.payload),
        );
        
        console.log("Received theorem result:", message.payload);
      }
      if (message.type === "workspaces") {
        setWorkspaces(message.payload);
      }
    };

    window.addEventListener("message", messageHandler);
    return () => window.removeEventListener("message", messageHandler);
  }, [vscode]);

  if (!result) return <></>;

  const displayStatus = toDisplayStatus(result.status);
  const cexDetail = details.find((d) => d.counterexample);
  const counterexample = cexDetail?.counterexample || {};
  const allVariables = Object.keys(counterexample);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div className="flex items-center px-2 py-1 gap-2 shrink-0 border-b border-(--vscode-panel-border) min-h-8">
        <VscodeSingleSelect onChange={(e) => {
          const value = (e.target as EventTarget & { value: string }).value;
          if (value) {
            vscode.postMessage({ type: "change-theorem", payload: { theoremId: value } } as WebviewToExtensionMessage);
          }
        }}>
          {flattenWorkspaces(workspaces).map((item, i) =>
            item.type === "header" ? (
              <VscodeOption key={i} disabled>{item.label}</VscodeOption>
            ) : (
              <VscodeOption key={i} value={item.id}>{"   "}{item.label}</VscodeOption>
            )
          )}
        </VscodeSingleSelect>

        <TheoremStatusBadge status={result.status} />

        <div className="flex-1" />

        <button className="flex items-center gap-[6px] bg-base-15 text-base-06 rounded pl-2 pr-[11px] py-[6px] text-[13px] shrink-0 cursor-pointer active:bg-blue-07 active:text-base-01" onClick={() => vscode.postMessage({ type: "run-theorem" } as WebviewToExtensionMessage)}>
          <i className="codicon codicon-refresh" />
          Recheck
        </button>
        <button className="flex items-center gap-[6px] bg-base-15 text-base-06 rounded pl-2 pr-[11px] py-[6px] text-[13px] shrink-0 cursor-pointer active:bg-blue-07 active:text-base-01">
          <i className="codicon codicon-cloud-download" />
          Download
        </button>
      </div>

      <VscodeTabs
        style={{
          flex: "1",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <VscodeTabHeader slot="header">Counterexample Trace</VscodeTabHeader>
        <VscodeTabHeader slot="header">Transaction Graph</VscodeTabHeader>
        <VscodeTabHeader slot="header">Run Property Info</VscodeTabHeader>

        <VscodeTabPanel className="flex flex-col flex-1 overflow-hidden p-0">
          <CounterExampleTab result={result} steps={result.counterexampleSteps ?? []} />
        </VscodeTabPanel>

        <VscodeTabPanel className="flex flex-col flex-1 overflow-hidden p-0">
          <GraphTab graph={result.graph} />
        </VscodeTabPanel>

        <VscodeTabPanel className="flex flex-col flex-1 overflow-hidden p-0">
          <RunPropertyInfoTab
            displayStatus={displayStatus}
            hasCex={!!cexDetail}
            allVariables={allVariables}
            result={result}
          />
        </VscodeTabPanel>
      </VscodeTabs>
    </div>
  );
};

export default PropertyPanel;
