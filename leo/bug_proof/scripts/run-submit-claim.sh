#!/usr/bin/env bash
set -euo pipefail

LEO_BIN="${LEO_BIN:-leo}"

cd "$(dirname "$0")/.."
"${LEO_BIN}" run submit_claim $(tr '\n' ' ' < inputs/valid.in)
