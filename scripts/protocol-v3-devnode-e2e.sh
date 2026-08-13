#!/usr/bin/env bash
set -euo pipefail

v3_wrapper_exit() {
  local status="$?"
  trap - EXIT
  if ((status != 0)); then
    printf 'Protocol V3 R2 FINAL DYNAMIC COVERAGE: FAIL\n' >&2
  fi
  exit "${status}"
}
trap v3_wrapper_exit EXIT

readonly V3_LEO_VERSION="4.4.0"
readonly V3_E2E_LEO_BIN="${LEO_BIN:-${HOME}/.local/leo-toolchains/${V3_LEO_VERSION}/bin/leo}"

[[ -x "${V3_E2E_LEO_BIN}" ]] || {
  printf 'protocol-v3-devnode-e2e: Leo 4.4.0 binary is unavailable: %s\n' "${V3_E2E_LEO_BIN}" >&2
  exit 1
}
[[ "$("${V3_E2E_LEO_BIN}" --version)" == "leo ${V3_LEO_VERSION}"* ]] || {
  printf 'protocol-v3-devnode-e2e: Leo 4.4.0 is required: %s\n' "${V3_E2E_LEO_BIN}" >&2
  exit 1
}

readonly V3_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${V3_ROOT_DIR}"
env -u LEO_BIN npm test
npm run test:worktree-paths
npm run lint
bash -n scripts/protocol-v3-devnode-e2e.sh
bash -n scripts/escrow-v2-devnode-e2e.sh
bash -n scripts/protocol-v3-final-dynamic-coverage.sh
bash -n scripts/protocol-v3-dev-scenarios.sh
bash -n scripts/protocol-v3-dev-runner.sh
bash -n scripts/protocol-v3-parallel-final.sh
node scripts/check-protocol-v3-harness-static.mjs
git -c core.whitespace=cr-at-eol diff --check -- \
  .gitignore \
  scripts/escrow-v2-devnode-e2e.sh \
  scripts/protocol-v3-devnode-e2e.sh \
  scripts/protocol-v3-final-dynamic-coverage.sh \
  scripts/protocol-v3-parallel-final.sh \
  scripts/leo-struct-reader.mjs \
  scripts/fixtures/v3-public-key-deriver/program.json \
  scripts/fixtures/v3-public-key-deriver/src/main.leo \
  tests/aleo-program-id.test.ts \
  tests/escrow-v2-devnode-harness.test.ts \
  tests/leo-struct-reader.test.ts
# Windows/WSL checkout conversion may change CRLF only. Reject every
# substantive source change while accepting that transport-only difference.
git diff --ignore-space-at-eol --exit-code -- leo/bug_proof/src/main.leo

export LEO_BIN="${V3_E2E_LEO_BIN}"

export V3_STATIC_GATES_PASSED=1
export ZKBB_RUN_PROTOCOL_V3=1
exec bash "${V3_ROOT_DIR}/scripts/escrow-v2-devnode-e2e.sh" "$@"
