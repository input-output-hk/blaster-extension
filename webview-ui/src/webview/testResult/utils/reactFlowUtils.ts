import { MarkerType } from '@xyflow/react';
import type { Node, Edge, XYPosition } from '@xyflow/react';

const NODE_COLUMN_WIDTH = 340;
const NODE_VERTICAL_GAP = 40;
const NODE_COLLISION_MARGIN = 20;
const NODE_COLLISION_ITERATIONS = 50;
const NODE_COLLISION_OVERLAP_THRESHOLD = 0.5;

export type GraphData = {
  nodes: Array<Node>;
  edges: Array<Edge>;
};

type CollisionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  moved: boolean;
  node: Node;
};

export const resolveNodeCollisions = (nodes: Array<Node>): Array<Node> => {
  const boxes: Array<CollisionBox> = nodes.map(node => ({
    x: node.position.x - NODE_COLLISION_MARGIN,
    y: node.position.y - NODE_COLLISION_MARGIN,
    width: (node.measured?.width ?? node.width ?? 0) + NODE_COLLISION_MARGIN * 2,
    height: (node.measured?.height ?? node.height ?? 0) + NODE_COLLISION_MARGIN * 2,
    moved: false,
    node,
  }));

  for (let iteration = 0; iteration < NODE_COLLISION_ITERATIONS; iteration++) {
    let moved = false;

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const first = boxes[i];
        const second = boxes[j];
        const deltaX = first.x + first.width / 2 - (second.x + second.width / 2);
        const deltaY = first.y + first.height / 2 - (second.y + second.height / 2);
        const overlapX = (first.width + second.width) / 2 - Math.abs(deltaX);
        const overlapY = (first.height + second.height) / 2 - Math.abs(deltaY);

        if (overlapX <= NODE_COLLISION_OVERLAP_THRESHOLD || overlapY <= NODE_COLLISION_OVERLAP_THRESHOLD) continue;

        first.moved = true;
        second.moved = true;
        moved = true;

        if (overlapX < overlapY) {
          const amount = overlapX / 2 * (deltaX > 0 ? 1 : -1);
          first.x += amount;
          second.x -= amount;
        } else {
          const amount = overlapY / 2 * (deltaY > 0 ? 1 : -1);
          first.y += amount;
          second.y -= amount;
        }
      }
    }

    if (!moved) break;
  }

  return boxes.map(box => box.moved ? {
    ...box.node,
    position: {
      x: box.x + NODE_COLLISION_MARGIN,
      y: box.y + NODE_COLLISION_MARGIN,
    },
  } : box.node);
};

export const applyMeasuredLayout = (nodes: Array<Node>): Record<string, XYPosition> => {
  const columns: Record<number, Array<Node>> = {};
  for (const node of nodes) {
    columns[node.position.x] = columns[node.position.x] ?? [];
    columns[node.position.x].push(node);
  }

  const getColumnHeight = (column: Array<Node>): number =>
    column.reduce((height, node) => height + (node.measured?.height ?? node.height ?? 0), 0) +
    Math.max(0, column.length - 1) * NODE_VERTICAL_GAP;

  const maxColumnHeight = Math.max(0, ...Array.from(Object.values(columns), getColumnHeight));
  const positions: Record<string, XYPosition> = {};
  for (const column of Object.values(columns)) {
    let positionY = (maxColumnHeight - getColumnHeight(column)) / 2;
    for (const node of column) {
      positions[node.id] = { x: node.position.x, y: positionY };
      positionY += (node.measured?.height ?? node.height ?? 0) + NODE_VERTICAL_GAP;
    }
  }

  return positions;
};

export const mapGraphTxsToGraphData = (graphTxs: Array<GraphTx>): GraphData => {
  const nodes: Record<string, Node> = {};
  const edges: Record<string, Edge> = {};

  for (const [index, graphTx] of graphTxs.entries()) {
    const { tx, inputs, outputs } = graphTx;
    const txId = `tx-${tx.identifier}`;
    const inputColumn = index * 2;
    const txColumn = inputColumn + 1;
    const outputColumn = txColumn + 1;

    nodes[txId] = {
      id: txId,
      type: 'tx',
      data: tx,
      zIndex: 10,
      position: {
        x: txColumn * NODE_COLUMN_WIDTH,
        y: 0
      }
    };

    for (const [inputIndex, input] of inputs.entries()) {
      const txHandle = `${txId}-i-${inputIndex}`;
      const utxoId = `utxo-${input.identifier}`;
      if (nodes[utxoId] !== undefined) {
        nodes[utxoId].data = {
          ...nodes[utxoId].data,
          ...input,
          consumed: true,
        };
      } else {
        nodes[utxoId] = {
          id: utxoId,
          type: 'utxo',
          data: {
            ...input,
            consumed: true,
          },
          zIndex: 10,
          position: {
            x: inputColumn * NODE_COLUMN_WIDTH,
            y: 0
          }
        };
      }
      const edgeId = `edge-${utxoId}-to-${txHandle}`;
      edges[edgeId] = {
        id: edgeId,
        type: 'smoothstep',
        source: utxoId,
        target: txId,
        targetHandle: txHandle,
        selectable: true,
        pathOptions: {
          borderRadius: 40
        },
        markerEnd: {
          type: MarkerType.Arrow,
          height: 20, width: 20
        },
      } as Edge;
    }

    for (const [outputIndex, output] of outputs.entries()) {
      const txHandle = `${txId}-o-${outputIndex}`;
      const utxoId = `utxo-${output.identifier}`;
      if (nodes[utxoId] !== undefined) {
        nodes[utxoId].data = {
          ...nodes[utxoId].data,
          ...output,
          consumed: nodes[utxoId].data.consumed || output.consumed,
        };
      } else {
        nodes[utxoId] = {
          id: utxoId,
          type: 'utxo',
          data: output,
          zIndex: 10,
          position: {
            x: outputColumn * NODE_COLUMN_WIDTH,
            y: 0
          }
        };
      }
      const edgeId = `edge-${txHandle}-to-${utxoId}`;
      edges[edgeId] = {
        id: edgeId,
        type: 'smoothstep',
        source: txId,
        sourceHandle: txHandle,
        target: utxoId,
        selectable: true,
        pathOptions: {
          borderRadius: 40
        },
        markerEnd: {
          type: MarkerType.Arrow,
          height: 20, width: 20
        },
      } as Edge;
    }
  }

  return {
    edges: Object.values(edges),
    nodes: Object.values(nodes)
  };
};
