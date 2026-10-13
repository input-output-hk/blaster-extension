/** Shortens a Cardano hash for display: `"aabbccdd...eeff"` → `"#aabb...eeff"` */
export const formatHash = (hash: string, length = 4): string =>
  `#${hash.slice(0, length)}...${hash.slice(-length)}`;

/** Returns true if the value looks like a Plutus constructor node `{ constructor, fields[] }`.
 * Used for runtime narrowing when datum type is unknown. */
export const isPlutusNode = (v: unknown): v is { constructor: number; fields: unknown[] } =>
  typeof v === "object" && v !== null && "constructor" in v && "fields" in v && Array.isArray((v as { fields: unknown }).fields);

/** Decode a hex-encoded byte string to a UTF-8 string if all bytes are printable ASCII,
 * otherwise we assume it's an address and return the original hex. */
export const hexToString = (hex: string): string => {
  const codes = (hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16));
  if (codes.every((c) => c >= 32 && c <= 126)) {
    return codes.map((c) => String.fromCharCode(c)).join("");
  }
  return hex;
};
