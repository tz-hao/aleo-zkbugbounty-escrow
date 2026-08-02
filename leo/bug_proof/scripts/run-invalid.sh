#!/usr/bin/env bash
set -euo pipefail

LEO_BIN="${LEO_BIN:-leo}"

cd "$(dirname "$0")/.."
if "${LEO_BIN}" run prove_vault_invariant_break $(tr '\n' ' ' < inputs/invalid.in) >/dev/null 2>&1; then
  echo "Expected the invalid invariant witness to be rejected." >&2
  exit 1
fi

echo "Invalid invariant witness rejected by Leo constraints."
