import { Handle, Position } from "@xyflow/react";
import TransactionCard from "../TransactionCard";
import type { TransactionCardProps } from "../TransactionCard";

export type GraphCardNodeData = TransactionCardProps;

// ReactFlow custom node wrapper for TransactionCard.
// Attaches a non-interactive target handle on the left and source handle on the right,
// then delegates all rendering to TransactionCard via its data prop.
const GraphCardNode: React.FC<{ data: GraphCardNodeData }> = ({ data }) => (
  <>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <TransactionCard {...data} />
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </>
);

export default GraphCardNode;
