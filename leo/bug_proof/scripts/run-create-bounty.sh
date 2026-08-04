#!/usr/bin/env bash
set -euo pipefail

LEO_BIN="${LEO_BIN:-leo}"

cd "$(dirname "$0")/.."
"${LEO_BIN}" run create_bounty \
  5001field \
  6001field \
  1field \
  1000u64 \
  500u64 \
  100u64 \
  0u64 \
  20000000u32
