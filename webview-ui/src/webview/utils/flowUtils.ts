import { MarkerType } from "@xyflow/react";
import type { GraphNode, GraphEdge } from "./graphMapper";

const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 210;

// Maps column-grouped GraphNodes to ReactFlow nodes with x/y positions.
// Each column is vertically centred relative to the tallest column.
export const toFlowNodes = (cols: GraphNode[][]) => {
  const tallest = Math.max(0, ...cols.filter(Boolean).map((c) => c.length));
  return cols.flatMap((col, colIdx) => {
    if (!col) return [];
    return col.map((n, rowIdx) => ({
      id: n.id,
      type: "transactionCard" as const,
      position: {
        x: (colIdx - 1) * COLUMN_WIDTH,
        y: ((tallest - col.length) / 2) * ROW_HEIGHT + rowIdx * ROW_HEIGHT,
      },
      data: n.card,
    }));
  });
};

// Maps GraphEdges to ReactFlow edge objects, with arrows and optional dashed style.
export const toFlowEdges = (edges: GraphEdge[]) =>
  edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: null,
    targetHandle: null,
    markerEnd: { type: MarkerType.ArrowClosed },
    ...(e.dashed && { style: { strokeDasharray: "6 3" } }),
  }));
