import type { GraphNodeCardProps } from "../components/graph/GraphNodeCard";
import { hexToString, isPlutusNode } from "./cardanoUtils";

export type DatumNode = { value: string; level: number };

const buildDatumDisplay = (datum: unknown): string => {
  if (typeof datum === "string") return datum;
  return "Plutus data";
};

/**
 * Builds the tooltip tree for a datum. Each node in the tree is represented by a string and level used for indentation.
 * @param datum 
 * @param level 
 * @returns 
 */
const buildDatumTree = (datum: unknown, level = 0): DatumNode[] => {
  if (typeof datum === "string") return [{ value: datum, level }];
  if (!isPlutusNode(datum)) return [{ value: String(datum), level }];
  return datum.fields.flatMap((field) => {
    if (typeof field === "object" && field !== null) {
      if ("bytes" in field) return [{ value: hexToString((field as { bytes: string }).bytes), level }];
      if ("int" in field) return [{ value: String((field as { int: unknown }).int), level }];
      // needs real-world examples of datums
      // if ("list" in field) return [{ value: "list", level }];
      // if ("map" in field) return [{ value: "map", level }];
      if ("constructor" in field) return buildDatumTree(field, level + 1);
    }
    return [{ value: String(field), level }];
  });
};

export interface GraphNode {
  id: string;
  card: GraphNodeCardProps;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  dashed?: boolean;
}

export interface GraphData {
  nodes: GraphNode[][];
  edges: GraphEdge[];
}

const lovelaceToAda = (quantity: number): string =>
  `${(quantity / 1_000_000).toFixed(2)} ADA`;

const truncateHash = (hash: string): string => `# ${hash.slice(0, 8)}...`;

const utxoId = (txHash: string, outputIndex: number): string =>
  `${txHash}#${outputIndex}`;

const txId = (hash: string): string => `tx-${hash}`;

const toUtxoNode = (utxo: TestGraph["utxos"][number]): GraphNode => {
  const lovelace = utxo.amount.find((a) => a.unit === "lovelace");
  const tokens = utxo.amount.filter((a) => a.unit !== "lovelace");

  const fields: GraphNodeCardProps["fields"] = [];
  if (lovelace) {
    fields.push({ label: "Amount", value: lovelaceToAda(lovelace.quantity) });
  }
  if (utxo.datum) {
    fields.push({
      label: "Datum",
      value: buildDatumDisplay(utxo.datum),
      tooltip: buildDatumTree(utxo.datum),
    });
  }
  for (const token of tokens) {
    fields.push({
      label: "Token",
      value: `${token.unit.slice(0, 8)}... ×${token.quantity}`,
    });
  }

  return {
    id: utxoId(utxo.txHash, utxo.outputIndex),
    card: {
      type: "utxo",
      address: utxo.address,
      fields,
    },
  };
};

const toTxNode = (tx: TestGraph["txs"][number]): GraphNode => {
  const fields: GraphNodeCardProps["fields"] = [
    { label: "Amount", value: lovelaceToAda(tx.totalOutput) },
    { label: "Fees", value: lovelaceToAda(tx.fees) },
  ];
  if (tx.inputs.length > 0) {
    fields.push({
      label: "Input Reference",
      value: truncateHash(tx.inputs[0]),
    });
  }

  return {
    id: txId(tx.hash),
    card: {
      type: "tx",
      address: tx.hash,
      fields,
    },
  };
};

// Converts a TestGraph into column-grouped GraphNodes and edges.
// Columns alternate between UTxOs and transactions (1-indexed):
//   tx N → col N*2;  its inputs → col N*2-1;  its outputs → col N*2+1
// A UTxO that is output of tx[i] and input of tx[i+1] lands in the same column
// from both sides — the `placed` set prevents it being added twice.
export const toGraphData = (graph: TestGraph): GraphData => {
  const utxoMap = new Map(
    graph.utxos.map((u) => [utxoId(u.txHash, u.outputIndex), u]),
  );

  const sortedTxs = [...graph.txs].sort((a, b) => a.slot - b.slot);

  const cols: GraphNode[][] = [];
  const edges: GraphEdge[] = [];
  const placed = new Set<string>();

  for (let i = 0; i < sortedTxs.length; i++) {
    const tx = sortedTxs[i];
    const N = i + 1;
    const tId = txId(tx.hash);

    for (const inputId of tx.inputs) {
      edges.push({
        id: `${inputId}-${tId}`,
        source: inputId,
        target: tId,
        // Leave this commented. Will decide later the condition for dashed edges.
        // ...(utxoMap.get(inputId)?.referenceScriptHash !== undefined && { dashed: true }),
      });
      if (!placed.has(inputId)) {
        const utxo = utxoMap.get(inputId);
        if (utxo) (cols[N * 2 - 1] ??= []).push(toUtxoNode(utxo));
        placed.add(inputId);
      }
    }

    (cols[N * 2] ??= []).push(toTxNode(tx));

    for (const outputId of tx.outputs) {
      edges.push({ id: `${tId}-${outputId}`, source: tId, target: outputId });
      if (!placed.has(outputId)) {
        const utxo = utxoMap.get(outputId);
        if (utxo) (cols[N * 2 + 1] ??= []).push(toUtxoNode(utxo));
        placed.add(outputId);
      }
    }
  }

  return { nodes: cols, edges };
};
