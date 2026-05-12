import { useEffect, useState } from "react";
import {
  VscodeTabs,
  VscodeTabHeader,
  VscodeTabPanel,
  VscodeButton,
  VscodeSingleSelect,
  VscodeOption,
  VscodeToolbarButton,
} from "@vscode-elements/react-elements";

import type { WebviewApi } from "vscode-webview";

import type { CounterexampleData } from "./types";

const MOCK_COUNTEREXAMPLE: CounterexampleData = {
  tx: {
    discarded: false,
    steps: [
      { value: "123" },
      { value: "123" },
      { value: "123" },
      { value: "123" },
    ],
  },
  datum: {
    discarded: false,
    steps: [
      { value: "datum1" },
      { value: "datum2" },
      { value: "datum3" },
      { value: "datum4" },
    ],
  },
  redeemer: {
    discarded: false,
    steps: [
      { value: "redeemer1" },
      { value: "redeemer2" },
      { value: "redeemer3" },
      { value: "redeemer4" },
    ],
  },
  discarded1: {
    discarded: true,
    steps: [{ value: "-" }, { value: "-" }, { value: "-" }, { value: "-" }],
  },
  discarded2: {
    discarded: true,
    steps: [{ value: "-" }, { value: "-" }, { value: "-" }, { value: "-" }],
  },
};

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

// ── Main component ─────────────────────────────────────────────────────────────
const PropertyPanel: React.FC<Props> = ({ vscode }) => {
  const [result, setResult] = useState<TheoremResult | null>(null);
  const [details, setDetails] = useState<TheoremResultDetail[]>([]);

  useEffect(() => {
    vscode.postMessage({ type: "webview-ready" });

    // Example of sending a message to the extension when a theorem is selected
    // vscode.postMessage({ type: "change-theorem", payload: { theoremId: "example-theorem-id" } });

    // Example of sending a message to the extension to run the current theorem
    // vscode.postMessage({ type: "run-theorem" });

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "theorem-result") {
        setResult(message.payload);
        setDetails(getTheoremResultDetails(message.payload));
        
        console.log("Received theorem result:", message.payload);
      }
      if (message.type === "workspaces") {
        // TODO: Implement handling of workspaces data if needed
        console.log("Received workspaces:", message.payload);
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
      {/* ── Property selector row ──────────────────────────────────────── */}
      <div className="flex items-center px-2 py-1 gap-2 shrink-0 border-b border-[var(--vscode-panel-border)] min-h-8">
        <VscodeSingleSelect>
          <VscodeOption>noDeadlock (Escrow.hs)</VscodeOption>
          <VscodeOption>noDoubleSpend (Escrow.hs)</VscodeOption>
          <VscodeOption>alwaysFinishes (Vesting.hs)</VscodeOption>
          <VscodeOption>canRedeem (Vesting.hs)</VscodeOption>
          <VscodeOption>validTransition (StateMachine.hs)</VscodeOption>
        </VscodeSingleSelect>

        <TheoremStatusBadge status={result.status} />

        <div className="flex-1" />

        <VscodeToolbarButton>
          <i className="codicon codicon-export" />
        </VscodeToolbarButton>
        <VscodeButton>Recheck</VscodeButton>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
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

        {/* ── Counterexample Trace tab ─────────────────────────────────── */}
        <VscodeTabPanel className="flex flex-col flex-1 overflow-hidden p-0">
          <CounterExampleTab result={result} data={MOCK_COUNTEREXAMPLE} />
        </VscodeTabPanel>

        {/* ── Transaction Graph tab ─────────────────────────────────────── */}
        <VscodeTabPanel className="flex flex-col flex-1 overflow-hidden p-0">
          <GraphTab graph={result.graph} />
        </VscodeTabPanel>

        {/* ── Run Property Info tab ─────────────────────────────────────── */}
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
