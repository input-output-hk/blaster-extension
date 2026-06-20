/** Shortens a Cardano hash for display: `"aabbccdd...eeff"` → `"#aabb...eeff"` */
export const formatHash = (hash: string, n = 4): string =>
  `#${hash.slice(0, n)}...${hash.slice(-n)}`;
