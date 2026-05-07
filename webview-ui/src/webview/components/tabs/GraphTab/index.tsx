import { ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import TransactionCardNode from "../../TransactionCardNode";
import { MOCK_GRAPH } from "./graphMockData";
import { toFlowNodes, deriveEdges } from "../../../utils/flowUtils";

const nodeTypes = { transactionCard: TransactionCardNode };

const GraphTab: React.FC = () => (
  <div className="flex-1 min-h-0">
    <ReactFlow
      nodes={toFlowNodes(MOCK_GRAPH.nodes)}
      edges={deriveEdges(MOCK_GRAPH.nodes)}
      nodeTypes={nodeTypes}
      defaultViewport={{ x: 20, y: 20, zoom: 1 }}
    />
  </div>
);

export default GraphTab;
