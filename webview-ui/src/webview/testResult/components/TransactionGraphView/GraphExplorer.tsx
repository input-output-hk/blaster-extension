import { VscodeTree, VscodeTreeItem } from '@vscode-elements/react-elements';

import useTreeItemState from '../../../../hooks/useTreeItemState';

interface Props {
  graphTxs: Array<GraphTx>;
  selectedNodeId: string | null;
  onSelectTx: (nodeId: string) => void;
  onClose: () => void;
}

interface ExplorerRowProps {
  tx: GraphNodeTx;
  selected: boolean;
  onSelect: (nodeId: string) => void;
}

const ExplorerRow: React.FC<ExplorerRowProps> = ({ tx, selected, onSelect }) => {
  const treeItemRef = useTreeItemState({
    onToggleSelection: (isSelected) => {
      if (isSelected) onSelect(`tx-${tx.identifier}`);
    },
  });

  return (
    <VscodeTreeItem ref={treeItemRef} selected={selected}>
      <span className="flex items-center gap-1.5 pl-1.5">
        <span className="flex items-center gap-1 overflow-hidden">
          <span className="text-[var(--vscode-sideBarTitle-foreground)] text-[11px] font-medium truncate">
            {tx.label}
          </span>
          <span className="shrink-0 text-[var(--vscode-descriptionForeground)] text-[11px] font-medium whitespace-nowrap">
            {`${tx.id.slice(0, 4)}...${tx.id.slice(-4)}`}
          </span>
        </span>
      </span>
    </VscodeTreeItem>
  );
};

const GraphExplorer: React.FC<Props> = ({ graphTxs, selectedNodeId, onSelectTx, onClose }) => (
  <div className="absolute left-0 top-0 h-full w-90 max-w-full z-10">
    <div className="flex flex-col shrink-0 w-full h-full border-r border-[var(--vscode-sideBar-border)] bg-[var(--vscode-sideBar-background)]">
      <div className="flex items-center gap-2 pl-2">
        <button
          type="button" onClick={onClose}
          className="ml-1 pt-1 px-1 rounded-[var(--vscode-cornerRadius-small,2px)] hover:bg-[var(--vscode-toolbar-hoverBackground)] cursor-pointer"
          data-tooltip-id="graph-toolbar-action"
          data-tooltip-content="Close"
        >
          <i className="codicon codicon-arrow-left text-[var(--vscode-icon-foreground)]" />
        </button>
        <div className="flex flex-1 items-center h-10 pr-2 py-2">
          <span className="text-[var(--vscode-sideBarTitle-foreground)] text-[14px] font-medium">Graph Explorer</span>
        </div>
      </div>

      <div className="h-px w-full bg-[var(--vscode-sideBar-border)]" />

      <div className="flex items-center justify-between w-full mb-2 px-4 py-2 border-b border-[var(--vscode-sideBar-border)] text-[var(--vscode-sideBarTitle-foreground)] text-[11px] font-medium">
        <span>Transactions</span>
        <span>{graphTxs.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <VscodeTree>
          {graphTxs.map(node =>
            <ExplorerRow
              key={node.tx.identifier}
              tx={node.tx}
              selected={`tx-${node.tx.identifier}` === selectedNodeId}
              onSelect={onSelectTx}
            />
          )}
        </VscodeTree>
      </div>
    </div>
  </div>
);

export default GraphExplorer;
