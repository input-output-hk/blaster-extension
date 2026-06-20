/** Shortens a Cardano hash for display: `"aabbccdd...eeff"` → `"#aabb...eeff"` */
export const formatHash = (hash: string, n = 4): string =>
  `#${hash.slice(0, n)}...${hash.slice(-n)}`;

/** Decodes a hex-encoded byte string to a UTF-8 string: `"626172"` → `"bar"` */
export const hexToString = (hex: string): string => {
  const bytes = hex.match(/.{1,2}/g) ?? [];
  return bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join("");
};
