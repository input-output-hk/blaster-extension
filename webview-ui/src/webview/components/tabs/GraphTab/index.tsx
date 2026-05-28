import { useState, useCallback } from "react";
import { ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import GraphCardNode from "../../GraphCardNode";
import { toFlowNodes, toFlowEdges } from "../../../utils/flowUtils";
import { toGraphData } from "../../../utils/graphMapper";

const nodeTypes = { transactionCard: GraphCardNode };

interface Props {
  graph?: TheoremGraph;
}

const GraphTab: React.FC<Props> = ({ graph }) => {
  const [collapsedCols, setCollapsedCols] = useState<Set<number>>(new Set());

  const toggleCol = useCallback((colIdx: number) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colIdx)) next.delete(colIdx);
      else next.add(colIdx);
      return next;
    });
  }, []);

  if (!graph) return <></>;

  const { nodes, edges } = toGraphData(graph);

  return (
    <div className="flex-1 min-h-0">
      <ReactFlow
        nodes={toFlowNodes(nodes, collapsedCols, toggleCol)}
        edges={toFlowEdges(edges)}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 20, y: 20, zoom: 1 }}
      />
    </div>
  );
};

export default GraphTab;
