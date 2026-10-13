import { useState, useCallback, useRef, useEffect } from "react";
import { ReactFlow, type ReactFlowInstance } from "@xyflow/react";

import GraphNode from '../../components/graph/GraphNode';
import RunningIndicator from '../../components/RunningIndicator';
import { toFlowNodes, toFlowEdges } from '../../utils/flowUtils';
import { toGraphData } from '../../utils/graphMapper';

import "@xyflow/react/dist/style.css";
import TransactionsDrawer from './TransactionsDrawer';

const nodeTypes = { node: GraphNode };

interface Props {
  testResult: TestResult;
  onOpenDetail?: (txHash: string) => void;
}

const focusNode = (instance: ReactFlowInstance, id: string) => {
  instance.fitView({
    nodes: [{ id }],
    duration: 300,
    maxZoom: instance.getZoom(),
  });
};

const GraphTab: React.FC<Props> = ({ testResult, onOpenDetail }) => {
  const [collapsedCols, setCollapsedCols] = useState<Set<number>>(new Set());
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const pendingFocusRef = useRef<string | null>(null);

  const toggleCol = useCallback((colIdx: number) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colIdx)) next.delete(colIdx);
      else next.add(colIdx);
      return next;
    });
  }, []);

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
  }, []);

  const handleFocusUtxo = useCallback((id: string) => {
    const instance = rfInstanceRef.current;
    if (!instance) return;
    if (instance.getNode(id)) {
      focusNode(instance, id);
      return;
    }
    // The node's column may be collapsed into a single group node — expand
    // everything and retry once the resulting re-render lands (see effect below).
    pendingFocusRef.current = id;
    setCollapsedCols(new Set());
  }, []);

  useEffect(() => {
    const id = pendingFocusRef.current;
    if (!id) return;
    pendingFocusRef.current = null;
    const instance = rfInstanceRef.current;
    if (instance?.getNode(id)) focusNode(instance, id);
  }, [collapsedCols]);

  if (testResult.status === 'running') return <RunningIndicator />;
  if (!testResult.graph) return <></>;

  const { nodes, edges } = toGraphData(testResult.graph);

  return (
    <div className="flex-1 min-h-0 bg-base-17 rounded-2xl mt-4">
      <div className="relative flex-1 min-w-0 h-full bg-base-17 rounded-2xl">
        <TransactionsDrawer
          graph={testResult.graph}
          onFocusUtxo={handleFocusUtxo}
        />
        <ReactFlow
          nodes={toFlowNodes(nodes, collapsedCols, toggleCol, onOpenDetail)}
          edges={toFlowEdges(edges)}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 20, y: 20, zoom: 1 }}
          onInit={handleInit}
        />
      </div>
    </div>
  );
};

export default GraphTab;
