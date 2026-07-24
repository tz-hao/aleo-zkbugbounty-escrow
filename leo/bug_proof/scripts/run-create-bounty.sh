#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
leo run create_bounty \
  5001field \
  6001field \
  1field \
  1000u64 \
  500u64 \
  100u64 \
  10u64 \
  20000000u32
