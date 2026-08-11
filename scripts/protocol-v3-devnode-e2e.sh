#!/usr/bin/env bash
set -euo pipefail

readonly V3_LEO_VERSION="4.4.0"
if [[ -z "${LEO_BIN:-}" ]]; then
  export LEO_BIN="${HOME}/.local/leo-toolchains/${V3_LEO_VERSION}/bin/leo"
fi

[[ -x "${LEO_BIN}" ]] || {
  printf 'protocol-v3-devnode-e2e: Leo 4.4.0 binary is unavailable: %s\n' "${LEO_BIN}" >&2
  exit 1
}
[[ "$("${LEO_BIN}" --version)" == "leo ${V3_LEO_VERSION}"* ]] || {
  printf 'protocol-v3-devnode-e2e: Leo 4.4.0 is required: %s\n' "${LEO_BIN}" >&2
  exit 1
}

export ZKBB_RUN_PROTOCOL_V3=1
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/escrow-v2-devnode-e2e.sh" "$@"
