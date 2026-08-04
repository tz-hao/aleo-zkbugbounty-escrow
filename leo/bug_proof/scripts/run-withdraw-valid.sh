#!/usr/bin/env bash
set -euo pipefail

LEO_BIN="${LEO_BIN:-leo}"

cd "$(dirname "$0")/.."
"${LEO_BIN}" run prove_vault_invariant_break $(tr '\n' ' ' < inputs/withdraw-valid.in)
