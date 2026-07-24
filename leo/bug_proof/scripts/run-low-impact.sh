#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
if leo run prove_vault_invariant_break $(tr '\n' ' ' < inputs/low-impact.in) >/dev/null 2>&1; then
  echo "Expected the low-impact invariant witness to be rejected." >&2
  exit 1
fi

echo "Low-impact invariant witness rejected by Leo constraints."
