# GraphTab

## Overview

The GraphTab visualises the sequence of transactions produced by a property check run. Each node represents a participant in the transaction trace (a wallet, a script, or a transaction itself). Edges show how value or control flows between them.

Nodes are arranged in columns left-to-right by sequence number. Multiple nodes in the same sequence column are stacked top-to-bottom in the order they appear in the data. The graph is read-only — panning and zooming are supported but nodes and edges cannot be moved or edited.

---

## Data model

Defined in `graphMockData.ts`. At runtime this will be replaced by data from the backend.

### `EdgeConnection`

```ts
interface EdgeConnection {
  id: string;
  dashed?: boolean;
}
```

| Field | Description |
|---|---|
| `id` | ID of the target node. |
| `dashed` | If `true`, the edge is rendered as a dashed line. Defaults to solid. |

### `GraphNode`

```ts
interface GraphNode {
  id: string;
  sequence: number;
  connectsTo: EdgeConnection[];
  card: TransactionCardProps;
}
```

| Field | Description |
|---|---|
| `id` | Unique node identifier. Used as the ReactFlow node ID and as the basis for edge IDs. |
| `sequence` | Column position (1-based). Nodes with the same sequence are placed in the same column. |
| `connectsTo` | Connections from this node to other nodes. Each entry can optionally be marked as `dashed`. |
| `card` | Display data passed to `TransactionCard` — see below. |

### `TransactionCardProps`

```ts
interface TransactionCardProps {
  type: "transaction" | "wallet" | "script";
  identifier: string;
  address: string;
  fields: { label: string; value: string }[];
}
```

| Field | Description |
|---|---|
| `type` | Controls the card header style. One of `"transaction"`, `"wallet"`, or `"script"`. |
| `identifier` | Short hash or label displayed as a badge in the card header (e.g. `"# e57hp0..."`). |
| `address` | Full or abbreviated address shown below the header. |
| `fields` | Arbitrary list of key-value rows rendered in the card body. Any number of entries is supported — common examples are `Amount`, `Datum`, `Input Reference`. |

### `GraphData`

```ts
interface GraphData {
  nodes: GraphNode[];
}
```

---

## Layout

- **X axis** — `(sequence - 1) * COLUMN_WIDTH` (default `320px` per column)
- **Y axis** — `rowIndex * ROW_HEIGHT` (default `180px` per row), where `rowIndex` is the zero-based position of the node within its sequence column

---

## Edge and handle conventions

- Every node renders one fixed `target` handle on the left and one fixed `source` handle on the right.
- `deriveEdges` produces one ReactFlow edge per entry in `connectsTo`.
- All edges have a closed arrowhead (`MarkerType.ArrowClosed`) at the target end.
- Edges with `dashed: true` are rendered with a dashed stroke (`strokeDasharray: "6 3"`).
- Handles are not interactive (`isConnectable={false}`).
