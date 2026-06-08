import { useState, useCallback } from 'react';
import { ReactFlow } from '@xyflow/react';

import GraphNode from '../../components/graph/GraphNode';
import { toFlowNodes, toFlowEdges } from '../../utils/flowUtils';
import { toGraphData } from '../../utils/graphMapper';

import "@xyflow/react/dist/style.css";

const nodeTypes = { node: GraphNode };

interface Props {
  testResult: TestResult;
}

const GraphTab: React.FC<Props> = ({ testResult }) => {
  const [collapsedCols, setCollapsedCols] = useState<Set<number>>(new Set());

  const toggleCol = useCallback((colIdx: number) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colIdx)) next.delete(colIdx);
      else next.add(colIdx);
      return next;
    });
  }, []);

  if (!testResult.graph) return <></>;

  const { nodes, edges } = toGraphData(testResult.graph);

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
