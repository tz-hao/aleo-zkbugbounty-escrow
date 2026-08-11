#!/usr/bin/env bash
set -euo pipefail

export ZKBB_RUN_PROTOCOL_V3=1
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/escrow-v2-devnode-e2e.sh" "$@"
