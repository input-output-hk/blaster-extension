import { useEffect, useState } from "react";
import {
  VscodeTabs,
  VscodeTabHeader,
  VscodeTabPanel,
  VscodeButton,
  VscodeScrollable,
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
import CounterexampleTab from "./tabs/CounterexampleTab";

interface Props {
  vscode: WebviewApi<unknown>;
}

interface TheoremResultDetail {
  cexLabel?: string;
  counterexample?: Record<string, string | string[]>;
  depth: number | null;
  expected: boolean;
  status: "valid" | "falsified" | "running" | "undetermined";
  timestamp: number;
  type: "result";
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
        <VscodeTabPanel
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flex: 1,
            padding: 0,
          }}
        >
          <CounterexampleTab result={result} data={MOCK_COUNTEREXAMPLE} />
        </VscodeTabPanel>

        {/* ── Transaction Graph tab ─────────────────────────────────────── */}
        <VscodeTabPanel>
          <div
            style={{
              padding: "16px",
              color: "var(--vscode-descriptionForeground)",
            }}
          >
            Transaction graph not yet implemented.
          </div>
        </VscodeTabPanel>

        {/* ── Run Property Info tab ─────────────────────────────────────── */}
        <VscodeTabPanel>
          <VscodeScrollable>
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <section>
                <SectionHeading>Solver Metadata</SectionHeading>
                <MetaGrid>
                  <MetaCell label="Solver Used" value="—" />
                  <MetaCell label="Solver Version" value="—" />
                  <MetaCell label="Solver Flags" value="—" />
                </MetaGrid>
              </section>

              <section>
                <SectionHeading>Statistics</SectionHeading>
                <MetaGrid>
                  <MetaCell label="Status" value={displayStatus} />
                  <MetaCell
                    label="Counterexample Kind"
                    value={cexDetail ? "Step" : "—"}
                  />
                  <MetaCell
                    label="Time to Execute"
                    value={result.time != null ? `${result.time}ms` : "—"}
                  />
                  <MetaCell label="Number of Clauses" value="—" />
                  <MetaCell
                    label="Number of Variables"
                    value={
                      allVariables.length > 0
                        ? String(allVariables.length)
                        : "—"
                    }
                  />
                  <MetaCell label="Number of Literals" value="—" />
                </MetaGrid>
              </section>
            </div>
          </VscodeScrollable>
        </VscodeTabPanel>
      </VscodeTabs>
    </div>
  );
};

// ── Small helper components ────────────────────────────────────────────────────

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      fontSize: "11px",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: "var(--vscode-descriptionForeground)",
      marginBottom: "6px",
      paddingBottom: "4px",
      borderBottom: "1px solid var(--vscode-panel-border)",
    }}
  >
    {children}
  </div>
);

const MetaGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "6px 12px",
    }}
  >
    {children}
  </div>
);

const MetaCell: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div style={{ minWidth: 0 }}>
    <div
      style={{
        color: "var(--vscode-descriptionForeground)",
        fontSize: "11px",
        marginBottom: "2px",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: "12px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </div>
  </div>
);

export default PropertyPanel;
