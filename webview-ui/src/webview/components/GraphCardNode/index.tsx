import { Handle, Position } from "@xyflow/react";
import TransactionCard from "../TransactionCard";
import type { TransactionCardProps } from "../TransactionCard";
import GroupTransactionCard from "../GroupTransactionCard";
import type { GroupTransactionCardProps } from "../GroupTransactionCard";

type GraphCardNodeData =
  | ({ grouped: true } & GroupTransactionCardProps)
  | ({ grouped: false } & TransactionCardProps);

// Renders either a GroupTransactionCard (collapsed) or TransactionCard (expanded),
// wrapped in ReactFlow handles.
const GraphCardNode: React.FC<{ data: GraphCardNodeData }> = ({ data }) => (
  <>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    {data.grouped
      ? <GroupTransactionCard {...data} />
      : <TransactionCard {...data} />}
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </>
);

export default GraphCardNode;
