# GraphTab

## Overview

The GraphTab visualises the sequence of transactions produced by a property check run. Each node represents a UTxO or a transaction in the trace. Edges show how value flows between them.

Nodes are arranged in alternating columns left-to-right: UTxO inputs, transaction, UTxO outputs, next transaction, and so on. Multiple nodes in the same column are stacked top-to-bottom. The graph is read-only — panning and zooming are supported but nodes and edges cannot be moved or edited.

---

## Data model

Defined in `graphMapper.ts`. The entry point is `toGraphData(graph: TheoremGraph)`.

### `GraphNode`

```ts
interface GraphNode {
  id: string;
  card: TransactionCardProps;
}
```

| Field | Description |
|---|---|
| `id` | Unique node identifier. Used as the ReactFlow node ID and as the basis for edge IDs. |
| `card` | Display data passed to `TransactionCard` — see below. |

Column position is not stored on the node. It is implicit in the `GraphNode[][]` structure returned by `toGraphData` — the outer array index is the column index.

### `GraphEdge`

```ts
interface GraphEdge {
  id: string;
  source: string;
  target: string;
  dashed?: boolean;
}
```

| Field | Description |
|---|---|
| `id` | Unique edge identifier, formatted as `"<sourceId>-<targetId>"`. |
| `source` | ID of the source node. |
| `target` | ID of the target node. |
| `dashed` | If `true`, the edge is rendered as a dashed line. Used for reference inputs. |

### `TransactionCardProps`

```ts
interface TransactionCardProps {
  type: "Tx" | "UTxO";
  identifier: string;
  address: string;
  fields: { label: string; value: string }[];
}
```

| Field | Description |
|---|---|
| `type` | Controls the card header colour. `"Tx"` for transactions, `"UTxO"` for all UTxO nodes regardless of address type. |
| `identifier` | Short hash displayed as a badge in the card header (e.g. `"# e57hp0..."`). |
| `address` | Full address or transaction hash shown below the header. |
| `fields` | Key-value rows rendered in the card body. Common entries: `Amount`, `Fees`, `Datum`, `Input Reference`, `Token`. |

### `GraphData`

```ts
interface GraphData {
  nodes: GraphNode[][];
  edges: GraphEdge[];
}
```

`nodes` is a sparse array of columns. `nodes[colIndex]` contains all nodes in that column. `edges` is a flat list of all edges in the graph.

---

## Column layout

Transactions and UTxOs interleave in alternating columns. For transaction `N` (1-based, sorted by slot):

| Content | Column index |
|---|---|
| Input UTxOs of tx N | `N*2 - 1` |
| Transaction N | `N*2` |
| Output UTxOs of tx N | `N*2 + 1` |

A UTxO that is the output of tx N and the input of tx N+1 resolves to the same column from both sides (`N*2+1 == (N+1)*2-1`), so it appears once. A `placed` set in `toGraphData` prevents any UTxO from being added to the column array more than once.

- **X axis** — `(colIndex - 1) * COLUMN_WIDTH` (default `320px` per column)
- **Y axis** — rows within a column are stacked top-to-bottom; each column is vertically centred relative to the tallest column

---

## Edge and handle conventions

- `toGraphData` produces one `GraphEdge` per tx input (UTxO → Tx) and per tx output (Tx → UTxO).
- `toFlowEdges` converts `GraphEdge[]` to ReactFlow edge objects.
- All edges have a closed arrowhead (`MarkerType.ArrowClosed`) at the target end.
- Edges with `dashed: true` are rendered with a dashed stroke (`strokeDasharray: "6 3"`). Used for reference inputs (UTxOs with a `referenceScriptHash`).
- Handles are not interactive (`isConnectable={false}`).
