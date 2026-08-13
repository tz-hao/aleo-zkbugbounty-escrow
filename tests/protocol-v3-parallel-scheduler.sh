#!/usr/bin/env bash
set -euo pipefail

readonly TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_ROOT="$(cd "${TEST_DIR}/.." && pwd)"

export ZKBB_PARALLEL_BASE_PORT=31300
export ZKBB_DEVNODE_CACHE_ROOT=/tmp/zkbb-parallel-scheduler-smoke
source "${TEST_ROOT}/scripts/protocol-v3-parallel-final.sh"

SMOKE_ROOT="$(mktemp -d /tmp/zkbb-parallel-scheduler.XXXXXX)"
mkdir -p "${ZKBB_DEVNODE_CACHE_ROOT}"
RESUME_SMOKE_ROOT="$(mktemp -d "${ZKBB_DEVNODE_CACHE_ROOT}/parallel-final.XXXXXX")"
PARALLEL_ROOT="${SMOKE_ROOT}"
mkdir -p "${PARALLEL_ROOT}/logs"
mkdir -p "${RESUME_SMOKE_ROOT}/logs"

cleanup_smoke() {
  rm -f -- "${RESUME_SMOKE_ROOT}/logs/legacy.log"
  rmdir "${RESUME_SMOKE_ROOT}/logs" "${RESUME_SMOKE_ROOT}" 2>/dev/null || true
  rmdir "${PARALLEL_ROOT}/logs" "${PARALLEL_ROOT}" 2>/dev/null || true
  rmdir "${ZKBB_DEVNODE_CACHE_ROOT}" 2>/dev/null || true
}
trap cleanup_smoke EXIT

run_shard() {
  [[ "$1" == "two-core" ]]
  [[ "$2" == "31302" ]]
  [[ "$3" == "${PARALLEL_ROOT}/logs/two-core.log" ]]
}

launch_shard two-core 2
[[ "${#WORKER_PIDS[@]}" -eq 1 ]]
worker_pid="${WORKER_PIDS[0]}"
wait "${worker_pid}"
[[ "${PID_SHARDS[${worker_pid}]}" == "two-core" ]]
[[ "${PID_LOGS[${worker_pid}]}" == "${PARALLEL_ROOT}/logs/two-core.log" ]]

resolved_resume_root="$(resolve_resume_root "${RESUME_SMOKE_ROOT}")"
[[ "${resolved_resume_root}" == "$(realpath -e -- "${RESUME_SMOKE_ROOT}")" ]]

resume_log="${RESUME_SMOKE_ROOT}/logs/legacy.log"
printf '%s\n' \
  'Protocol V3 R2 FINAL SHARD legacy: PASS' \
  '- HEAD match: PASS' \
  '- main.leo changed: NO' \
  '- source integrity: PASS' \
  '- Testnet transactions: 0' \
  'v2-program-conservation' >"${resume_log}"
verify_shard_log legacy "${resume_log}"
! verify_shard_log severity "${resume_log}"

printf 'protocol-v3-parallel-scheduler: PASS\n'
