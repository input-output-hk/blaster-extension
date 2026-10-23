import { useState, forwardRef, useImperativeHandle } from 'react';

import Toolbar from './Toolbar';
import Graph from './Graph';
import GraphExplorer from './GraphExplorer';
import Tooltip from '../../../../components/Tooltip';

interface Handle {}

interface Props {
  test: Test;
  testResult: TestResult;
  isActive: boolean;
}

const EMPTY_GRAPH_TXS: Array<GraphTx> = [];

const TransactionGraphView: React.FC<Props & React.RefAttributes<Handle>> = forwardRef<Handle, Props>((props, ref) => {
  const [test, setTest] = useState<Test|null>(null);
  const [nodeId, setNodeId] = useState<string|null>(null);
  const [explorerOpen, setExplorerOpen] = useState<boolean>(false);
  const graphTxs = props.testResult.graph ?? EMPTY_GRAPH_TXS;
  const selectedNodeId = graphTxs.some(({ tx }) => `tx-${tx.identifier}` === nodeId) ? nodeId : null;

  if (test === null || test.id !== props.test.id || test.workspaceId !== props.test.workspaceId) {
    setTest(props.test);
    setNodeId(null);
    setExplorerOpen(false);
  }

  const onSelectTx = (txNodeId: string): void => {
    setNodeId(txNodeId);
  };

  const onToggleExplorer = (): void => {
    setExplorerOpen(open => !open);
  };

  useImperativeHandle(ref, () => ({}));

  return (
    <div className="relative flex flex-col h-full border border-[var(--vscode-sideBar-border)]">
      {explorerOpen &&
        <GraphExplorer
          graphTxs={graphTxs}
          selectedNodeId={selectedNodeId}
          onSelectTx={onSelectTx}
          onClose={onToggleExplorer}
        />
      }
      <Toolbar
        onOpenExplorer={onToggleExplorer}
      />
      <div className="flex-1 flex flex-row bg-[var(--vscode-panel-background)]">
        <div className="flex-1 relative">
          <Graph
            graphTxs={graphTxs}
            nodeId={selectedNodeId ?? undefined}
            isActive={props.isActive}
          />
        </div>
      </div>
      <Tooltip id="graph-toolbar-action" place="bottom" />
      <Tooltip id="graph-node-action" place="top" />
    </div>
  );
});

export type { Handle as TransactionGraphViewRef };
export default TransactionGraphView;
