#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
leo run prove_vault_invariant_break $(tr '\n' ' ' < inputs/withdraw-valid.in)
