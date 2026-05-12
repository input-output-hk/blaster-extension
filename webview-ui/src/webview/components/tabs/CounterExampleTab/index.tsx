import { useRef, useState } from "react";
import {
  VscodeBadge,
  VscodeTextfield,
  VscodeToolbarButton,
} from "@vscode-elements/react-elements";
import SortMenu, { type SortOption } from "../../SortMenu";
import type { CounterexampleData } from "../../../propertyPanel/types";

interface Props {
  result: TheoremResult;
  data: CounterexampleData;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  badgeCount?: number;
}> = ({ checked, onChange, label, badgeCount }) => (
  <label
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      cursor: "pointer",
      fontSize: "13px",
      color: "var(--color-base-06)",
      userSelect: "none",
    }}
  >
    <span
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        display: "inline-block",
        width: "26px",
        height: "14px",
        borderRadius: "7px",
        background: checked ? "var(--color-blue-06)" : "var(--color-base-13)",
        transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "1px",
          left: checked ? "13px" : "1px",
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
        }}
      />
    </span>
    {badgeCount !== undefined && badgeCount > 0 && (
      <VscodeBadge>{badgeCount}</VscodeBadge>
    )}
    <span style={{ color: "var(--color-base-07)", fontSize: "13px" }}>
      {label}
    </span>
  </label>
);

const CounterexampleTab: React.FC<Props> = ({ data }) => {
  const [searchText, setSearchText] = useState("");
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("alphabetical");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortButtonRef = useRef<HTMLDivElement>(null);

  const allVariables = Object.keys(data);
  const stepCount = Math.max(
    0,
    ...Object.values(data).map((p) => p.steps.length),
  );
  const steps = Array.from({ length: stepCount }, (_, i) => `Step ${i + 1}`);

  const displayVariables = allVariables
    .filter((k) => showDiscarded || !data[k].discarded)
    .filter(
      (k) =>
        searchText === "" || k.toLowerCase().includes(searchText.toLowerCase()),
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "alphabetical":
          return a.localeCompare(b);
        case "non-discarded-first":
          return (data[a].discarded ? 1 : 0) - (data[b].discarded ? 1 : 0);
        case "discarded-first":
          return (data[b].discarded ? 1 : 0) - (data[a].discarded ? 1 : 0);
        default:
          return 0;
      }
    });

  return (
    <div className="flex flex-col overflow-hidden flex-1">
      {/* Search & filter bar */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <VscodeTextfield
          placeholder="Search variable..."
          value={searchText}
          onInput={(e: Event) =>
            setSearchText((e.target as HTMLInputElement).value)
          }
        >
          <i
            slot="content-after"
            className="codicon codicon-clear-all cursor-pointer opacity-70 hover:opacity-100 mr-1"
            onClick={() => setSearchText("")}
          />
          <i
            slot="content-after"
            className="codicon codicon-filter cursor-pointer opacity-70 hover:opacity-100 mr-1"
          />
        </VscodeTextfield>

        <div className="flex-1" />

        <ToggleSwitch
          checked={showDiscarded}
          onChange={setShowDiscarded}
          label="Show discarded"
          badgeCount={0}
        />

        <div className="relative" ref={sortButtonRef}>
          <VscodeToolbarButton
            title="Sort"
            style={{ transform: "rotate(90deg)" }}
            onClick={() => setSortMenuOpen((o) => !o)}
          >
            <i className="codicon codicon-arrow-swap" />
          </VscodeToolbarButton>
          {sortMenuOpen && (
            <SortMenu
              value={sortBy}
              onChange={setSortBy}
              onClose={() => setSortMenuOpen(false)}
              anchorRef={sortButtonRef}
            />
          )}
        </div>

        <VscodeToolbarButton title="Filter">
          <i className="codicon codicon-filter" />
        </VscodeToolbarButton>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col w-full">
          {/* Header */}
          <div className="flex items-center w-full shrink-0 h-8">
            <div className="w-32 shrink-0 flex items-center h-full px-4 border border-base-13 bg-base-20">
              <span className="text-xs font-bold text-base-05">
                Variable Name
              </span>
            </div>
            {steps.map((step) => (
              <div
                key={step}
                className="flex-1 flex items-center justify-center h-full px-4 border border-base-13 bg-base-20"
              >
                <span className="text-xs font-bold text-base-05">{step}</span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {displayVariables.map((varName, rowIdx) => {
            const { steps: varSteps } = data[varName];
            const rowBg = rowIdx % 2 === 0 ? "bg-base-19" : "bg-base-20";
            return (
              <div
                key={varName}
                className={`flex items-center w-full shrink-0 h-9 ${rowBg}`}
              >
                <div
                  className={`w-32 shrink-0 flex items-center h-full pl-2 pr-4 border border-base-13 ${rowBg}`}
                >
                  <span className="text-xs text-base-06 truncate">
                    {varName}
                  </span>
                </div>
                {varSteps.map((step, i) => (
                  <div
                    key={i}
                    className={`flex-1 flex items-center justify-center h-full px-4 border border-base-13 ${rowBg}`}
                  >
                    <span className="text-xs text-base-06 text-center">
                      {String(step.value)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CounterexampleTab;
