import { MarkerType } from "@xyflow/react";
import type { GraphNode } from "../components/tabs/GraphTab/graphMockData";

const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 210;

// Returns the number of nodes in the tallest column.
const maxItems = (nodes: GraphNode[]): number => {
  const counts: Record<number, number> = {};
  for (const n of nodes) counts[n.sequence] = (counts[n.sequence] ?? 0) + 1;
  return Math.max(...Object.values(counts));
};

// Maps GraphNodes to ReactFlow node objects with calculated x/y positions.
export const toFlowNodes = (nodes: GraphNode[]) => {
  const tallest = maxItems(nodes);
  const colSize: Record<number, number> = {};
  for (const n of nodes) colSize[n.sequence] = (colSize[n.sequence] ?? 0) + 1;

  const countBySeq: Record<number, number> = {};
  return nodes.map((n) => {
    const idx = countBySeq[n.sequence] ?? 0;
    countBySeq[n.sequence] = idx + 1;
    const offsetY = ((tallest - colSize[n.sequence]) / 2) * ROW_HEIGHT;
    return {
      id: n.id,
      type: "transactionCard" as const,
      position: {
        x: (n.sequence - 1) * COLUMN_WIDTH,
        y: offsetY + idx * ROW_HEIGHT,
      },
      data: n.card,
    };
  });
};

// Maps GraphNodes to ReactFlow edge objects, with arrows and optional dashed style.
export const deriveEdges = (nodes: GraphNode[]) =>
  nodes.flatMap((n) =>
    n.connectsTo.map((conn) => ({
      id: `${n.id}-${conn.id}`,
      source: n.id,
      target: conn.id,
      sourceHandle: null,
      targetHandle: null,
      markerEnd: { type: MarkerType.ArrowClosed },
      ...(conn.dashed && { style: { strokeDasharray: "6 3" } }),
    }))
  );
