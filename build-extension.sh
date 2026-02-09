#!/usr/bin/env bash
set -euo pipefail

if ! command -v vsce >/dev/null 2>&1; then
  echo "Warning: vsce not found; skipping VSIX build." >&2
  exit 0
fi

vsce package

vsix="$(ls -t *.vsix 2>/dev/null | head -n 1 || true)"
if [[ -z "${vsix}" ]]; then
  echo "Warning: no .vsix produced; skipping repack." >&2
  exit 0
fi

tmp="$(mktemp -d)"
unzip -q "${vsix}" -d "${tmp}"
( cd "${tmp}" && zip -9 -q -r "../${vsix}" . )
rm -rf "${tmp}"

echo "Wrote ${vsix}"
