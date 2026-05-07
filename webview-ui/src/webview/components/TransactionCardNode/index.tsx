import { Handle, Position } from "@xyflow/react";
import TransactionCard from "../TransactionCard";
import type { TransactionCardProps } from "../TransactionCard";

export type TransactionCardNodeData = TransactionCardProps;

const TransactionCardNode: React.FC<{ data: TransactionCardNodeData }> = ({ data }) => (
  <>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <TransactionCard {...data} />
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </>
);

export default TransactionCardNode;
