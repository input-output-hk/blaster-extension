import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';

import { txValueToString } from '../../utils/txUtils';
import CopyButton from '../../../../components/CopyButton';

interface GraphNodeProps {
  data: GraphNode;
};

interface GraphNodeRowProps {
  label: string;
  value?: string;
  copyButton?: boolean;
  expanded: boolean;
}

interface GraphNodeFooterProps {
  onExpandNode: () => void;
}

interface GraphNodeHeaderProps {
  label: string;
  content: string;
  colorClass: string;
  expanded: boolean;
  onCollapseNode: () => void;
}

const getRowContent = (label: string, value?: string): string | null =>
  value === undefined || value === '' ? null : `${label}:\n${value}`;

const getNodeContent = (label: string, rows: Array<string | null>): string =>
  [label, ...rows.filter(row => row !== null)].join('\n\n');

const getTxNodeContent = (data: GraphNodeTx): string => getNodeContent(data.label, [
  getRowContent('Transaction ID', data.id),
  getRowContent('Mints', txValueToString(data.mint)),
  getRowContent('Fee', `${data.fee} lovelace`),
]);

const getUTxONodeContent = (data: GraphNodeUTxO): string => getNodeContent(data.label, [
  getRowContent('Address', data.address),
  getRowContent('UTxO', data.utxo),
  getRowContent('Amount', txValueToString(data.value)),
  getRowContent('Redeemer', data.redeemer),
  getRowContent('Datum', data.datum),
]);

const GraphNodeRow: React.FC<GraphNodeRowProps> = ({ label, value, copyButton, expanded }) => {
  if (value === undefined || value === '') return null;

  if (expanded) {
    return (
      <p className="w-full min-w-0 font-mono text-xs whitespace-pre-wrap break-all mt-2">
        {`${label}:`}<br />
        <span>{value}</span>
      </p>
    );
  }

  return (
    <div className="text-[11px] pb-2 mb-2 border-b border-b-[var(--vscode-sideBar-border)]">
      <p className="flex flex-row items-center gap-1">
        <span className="text-[var(--vscode-sideBarTitle-foreground)]">{label}</span>
        {copyButton && <CopyButton text={value} />}
      </p>
      <p className="truncate">{value}</p>
    </div>
  );
};

const GraphNodeFooter: React.FC<GraphNodeFooterProps> = ({ onExpandNode }) => (
  <div className="flex flex-row justify-end">
    <button
      onClick={onExpandNode}
      className="flex-none flex flex-row items-center gap-0.5 py-1 pl-1 pr-1.5 rounded-sm border border-[var(--vscode-sideBar-border)] bg-[var(--vscode-modernTab-activeBackground)] cursor-pointer"
    >
      <i className="codicon codicon-chevron-right" style={{ fontSize: '12px' }} />
      <span className="text-[12px] font-semibold">View details</span>
    </button>
  </div>
);

const GraphNodeHeader: React.FC<GraphNodeHeaderProps> = ({ label, content, colorClass, expanded, onCollapseNode }) => (
  <div className={`flex flex-row items-center py-1 px-2 gap-1 ${colorClass}`}>
    <span className="flex-1 min-w-0 break-all text-white text-[12px] capitalize">
      {label}
    </span>
    {expanded &&
      <>
        <button
          type="button"
          aria-label="Copy node details"
          title="Copy node details"
          className="inline-flex items-center justify-center cursor-pointer opacity-60 hover:opacity-100"
          onClick={() => navigator.clipboard.writeText(content)}
        >
          <i className="text-white codicon codicon-copy" style={{ fontSize: '14px' }} />
        </button>
        <button
          type="button"
          aria-label="Collapse node"
          title="Collapse node"
          className="inline-flex items-center justify-center cursor-pointer opacity-60 hover:opacity-100"
          onClick={onCollapseNode}
        >
          <i className="text-white codicon codicon-close" style={{ fontSize: '14px' }} />
        </button>
      </>
    }
  </div>
);

const GraphNodeTx: React.FC<GraphNodeTx> = (data) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  return (
    <div className="relative">
      <div className="w-60 overflow-clip border border-[var(--vscode-sideBar-border)] bg-[var(--vscode-sideBar-background)] text-[var(--vscode-sideBarTitle-foreground)]">
        <GraphNodeHeader
          label={data.label}
          content={getTxNodeContent(data)}
          colorClass="bg-green-05"
          expanded={expanded}
          onCollapseNode={() => setExpanded(false)}
        />
        <div className={expanded ? 'px-2 pb-2 max-h-130 overflow-y-scroll' : 'p-2'}>
          <GraphNodeRow
            copyButton
            label="Transaction ID"
            value={data.id}
            expanded={expanded}
          />
          <GraphNodeRow
            label="Mints"
            value={txValueToString(data.mint)}
            expanded={expanded}
          />
          <GraphNodeRow
            label="Fee"
            value={`${data.fee} lovelace`}
            expanded={expanded}
          />
          {!expanded &&
            <GraphNodeFooter onExpandNode={() => setExpanded(true)} />
          }
        </div>
      </div>
      <div className="absolute flex flex-col justify-around top-[25%] left-0 h-[50%] -translate-x-0.5">
        {[...Array(data.inputCount)].map((_, index) =>
          <Handle
            type="target"
            id={`tx-${data.identifier}-i-${index}`}
            key={`tx-${data.identifier}-i-${index}`}
            position={Position.Left}
            isConnectable={false}
            style={{
              position: 'relative', top: 0, left: 0,
              transform: 'none', opacity: 0
            }}
          />
        )}
      </div>
      <div className="absolute flex flex-col justify-around top-[25%] right-0 h-[50%] translate-x-1">
        {[...Array(data.outputCount)].map((_, index) =>
          <Handle
            type="source"
            id={`tx-${data.identifier}-o-${index}`}
            key={`tx-${data.identifier}-o-${index}`}
            position={Position.Right}
            isConnectable={false}
            style={{
              position: 'relative', top: 0, left: 0,
              transform: 'none', background: 'white'
            }}
          />
        )}
      </div>
    </div>
  );
};

const GraphNodeUTxO: React.FC<GraphNodeUTxO> = (data) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  return (
    <>
      <div className="w-60 overflow-clip border border-[var(--vscode-sideBar-border)] bg-[var(--vscode-sideBar-background)] text-[var(--vscode-sideBarTitle-foreground)]">
        <GraphNodeHeader
          label={data.label}
          content={getUTxONodeContent(data)}
          colorClass="bg-blue-09"
          expanded={expanded}
          onCollapseNode={() => setExpanded(false)}
        />
        <div className={expanded ? 'px-2 pb-2 max-h-130 overflow-y-scroll' : 'p-2'}>
          <GraphNodeRow
            copyButton
            label="Address"
            value={data.address}
            expanded={expanded}
          />
          <GraphNodeRow
            copyButton
            label="UTxO"
            value={data.utxo}
            expanded={expanded}
          />
          <GraphNodeRow
            label="Amount"
            value={txValueToString(data.value)}
            expanded={expanded}
          />
          <GraphNodeRow
            label="Redeemer"
            value={data.redeemer}
            expanded={expanded}
          />
          <GraphNodeRow
            copyButton
            label="Datum"
            value={data.datum}
            expanded={expanded}
          />
          {!expanded &&
            <GraphNodeFooter onExpandNode={() => setExpanded(true)} />
          }
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        style={{ opacity: 0 }}
      />
      {data.consumed &&
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={false}
          style={{ background: 'white' }}
        />
      }
    </>
  );
};

const GraphNode: React.FC<GraphNodeProps> = ({ data }) => (
  data.type === 'tx' ?
    <GraphNodeTx {...(data as GraphNodeTx)} /> :
    <GraphNodeUTxO {...(data as GraphNodeUTxO)} />
);

export default GraphNode;