import { readdirSync } from 'node:fs';

const LEAN_MARKERS = new Set(['lean-toolchain', 'lakefile.lean', 'lakefile.toml']);

export type ProjectLanguages = { lean: boolean; haskell: boolean };

/**
 * Tells whether a top-level file name marks a Lean project.
 */
function isLeanMarker(name: string): boolean {
  return LEAN_MARKERS.has(name);
}

/**
 * Tells whether a top-level file name marks a Cabal (Haskell) project.
 */
function isHaskellMarker(name: string): boolean {
  return name === 'cabal.project' || name.endsWith('.cabal');
}

/**
 * Detects which providers apply to a workspace root, from marker files at its top level only.
 * Nothing is executed. A root with no Haskell markers keeps Lean discovery, as before.
 */
export function detectLanguages(root: string): ProjectLanguages {
  let names: Array<string>;
  try {
    names = readdirSync(root);
  } catch {
    return { lean: true, haskell: false };
  }
  const haskell = names.some(isHaskellMarker);
  return { lean: names.some(isLeanMarker) || !haskell, haskell };
}
