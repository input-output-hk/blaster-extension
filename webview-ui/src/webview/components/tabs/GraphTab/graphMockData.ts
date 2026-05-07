import type { TransactionCardProps } from "../../TransactionCard";

export interface EdgeConnection {
  id: string;
  dashed?: boolean;
}

export interface GraphNode {
  id: string;
  sequence: number;
  connectsTo: EdgeConnection[];
  card: TransactionCardProps;
}

export interface GraphData {
  nodes: GraphNode[];
}

export const MOCK_GRAPH: GraphData = {
  nodes: [
    {
      id: "card1a",
      sequence: 1,
      connectsTo: [{ id: "card3", dashed: true }],
      card: {
        type: "wallet",
        identifier: "# e57hp0...",
        address: "addr1q8gg2r3vf9zg7m88c1605ad48",
        fields: [
          { label: "Amount", value: "10 ada" },
          { label: "Datum", value: 'Hello world' },
          { label: "foo", value: 'bar' },
        ],
      },
    },
    {
      id: "card1b",
      sequence: 1,
      connectsTo: [{ id: "card3" }],
      card: {
        type: "script",
        identifier: "# b72xs9...",
        address: "addr1qxsc7r2vf9zg7m88c1605gh34",
        fields: [
          { label: "Datum", value: '"Lock"' },
          { label: "Redeemer", value: '"Unlock"' },
        ],
      },
    },
    {
      id: "card3",
      sequence: 2,
      connectsTo: [{ id: "card4a" }, { id: "card4b" }, { id: "card4c" }],
      card: {
        type: "transaction",
        identifier: "# a91bc2...",
        address: "addr1qxmt4r2vf9zg7m88c1605bc19",
        fields: [
          { label: "Amount", value: "5 ada" },
          { label: "Input Reference", value: "tx#0" },
        ],
      },
    },
    {
      id: "card4a",
      sequence: 3,
      connectsTo: [],
      card: {
        type: "wallet",
        identifier: "# f83kp1...",
        address: "addr1q9tt3s4vf9zg7m88c1605ef56",
        fields: [
          { label: "Amount", value: "2 ada" },
        ],
      },
    },
    {
      id: "card4b",
      sequence: 3,
      connectsTo: [],
      card: {
        type: "script",
        identifier: "# c14yw7...",
        address: "addr1qxkl5r3vf9zg7m88c1605gh78",
        fields: [
          { label: "Datum", value: '"Locked"' },
          { label: "Redeemer", value: '"Release"' },
        ],
      },
    },
    {
      id: "card4c",
      sequence: 3,
      connectsTo: [],
      card: {
        type: "wallet",
        identifier: "# d56mn2...",
        address: "addr1q7rr2s5vf9zg7m88c1605ij90",
        fields: [
          { label: "Amount", value: "3 ada" },
        ],
      },
    },
  ],
};
