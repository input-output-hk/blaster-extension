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
  if (!graph) return <></>;

  const { nodes, edges } = toGraphData(graph);

  return (
    <div className="flex-1 min-h-0">
      <ReactFlow
        nodes={toFlowNodes(nodes)}
        edges={toFlowEdges(edges)}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 20, y: 20, zoom: 1 }}
      />
    </div>
  );
};

export default GraphTab;
