/** Shortens a Cardano hash for display: `"aabbccdd...eeff"` → `"#aabb...eeff"` */
export const formatHash = (hash: string): string =>
  `#${hash.slice(0, 4)}...${hash.slice(-4)}`;
