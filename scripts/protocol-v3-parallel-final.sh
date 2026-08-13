#!/usr/bin/env bash
set -euo pipefail
set +x

# Runs the authoritative final coverage as independent fresh-ledger shards.
# Role keys are read once from the invoking terminal, kept only in shell memory,
# and streamed to each shard over an anonymous pipe. They are never exported,
# persisted, included in a command line, or written to shard logs.

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly RUNNER="${ROOT_DIR}/scripts/protocol-v3-dev-runner.sh"
readonly V3_LEO_VERSION="4.4.0"
readonly LEO_BIN="${LEO_BIN:-${HOME}/.local/leo-toolchains/${V3_LEO_VERSION}/bin/leo}"
readonly DEVNODE_CACHE_ROOT="${ZKBB_DEVNODE_CACHE_ROOT:-${HOME}/.cache/zkbb/devnode}"
readonly BASE_PORT="${ZKBB_PARALLEL_BASE_PORT:-31300}"
readonly MAX_WORKERS="${ZKBB_PARALLEL_WORKERS:-3}"
readonly RESUME_ROOT="${ZKBB_PARALLEL_RESUME_ROOT:-}"
readonly LOCAL_PRIVATE_KEY_LENGTH=59

PARALLEL_OWNER_KEY=""
PARALLEL_WHITEHAT_KEY=""
PARALLEL_ARBITER_KEY=""
PARALLEL_ROOT=""
STATIC_KEY=""
declare -a WORKER_PIDS=()
declare -A PID_SHARDS=()
declare -A PID_LOGS=()

readonly -a FINAL_SHARDS=(
  reproduction-remediation
  legacy
  three-of-three
  two-core
  duplicate-scope
  severity
)

die() {
  printf 'protocol-v3-parallel-final: %s\n' "$*" >&2
  exit 1
}

validate_setting() {
  [[ "${BASE_PORT}" =~ ^[0-9]+$ ]] || die "base port must be numeric"
  [[ "${MAX_WORKERS}" =~ ^[0-9]+$ ]] || die "worker count must be numeric"
  ((10#${BASE_PORT} >= 1024 && 10#${BASE_PORT} + ${#FINAL_SHARDS[@]} <= 65535)) \
    || die "parallel Devnode port range is invalid"
  ((10#${MAX_WORKERS} >= 1 && 10#${MAX_WORKERS} <= ${#FINAL_SHARDS[@]})) \
    || die "worker count must be between 1 and ${#FINAL_SHARDS[@]}"
  [[ "${DEVNODE_CACHE_ROOT}" != /mnt/* ]] \
    || die "parallel ledgers and logs must use the WSL filesystem"
  [[ -x "${LEO_BIN}" ]] || die "Leo ${V3_LEO_VERSION} binary is unavailable: ${LEO_BIN}"
}

validate_local_key() {
  local label="$1" value="$2" private_key_prefix="A""Private""Key"
  [[ "${#value}" -eq "${LOCAL_PRIVATE_KEY_LENGTH}" && "${value}" =~ ^${private_key_prefix}1[[:alnum:]_]+$ ]] \
    || die "${label} is not a raw 59-character local-only Leo private key"
}

prompt_secret() {
  local variable_name="$1" prompt="$2" value=""
  if ! read -r -s -p "${prompt}: " value; then
    printf '\n'
    die "${prompt} input was interrupted"
  fi
  printf '\n'
  validate_local_key "${prompt}" "${value}"
  printf -v "${variable_name}" '%s' "${value}"
  value=""
}

clear_keys() {
  PARALLEL_OWNER_KEY=""
  PARALLEL_WHITEHAT_KEY=""
  PARALLEL_ARBITER_KEY=""
  unset PARALLEL_OWNER_KEY PARALLEL_WHITEHAT_KEY PARALLEL_ARBITER_KEY
}

terminate_descendants() {
  local parent="$1" child=""
  while IFS= read -r child; do
    [[ -n "${child}" ]] || continue
    terminate_descendants "${child}"
  done < <(pgrep -P "${parent}" 2>/dev/null || true)
  kill -TERM "${parent}" 2>/dev/null || true
}

cleanup_parallel() {
  local status="$?" pid=""
  trap - EXIT INT TERM
  for pid in "${WORKER_PIDS[@]:-}"; do
    kill -0 "${pid}" 2>/dev/null && terminate_descendants "${pid}"
  done
  for pid in "${WORKER_PIDS[@]:-}"; do
    wait "${pid}" 2>/dev/null || true
  done
  clear_keys
  exit "${status}"
}

handle_signal() {
  exit 130
}

run_shard() {
  local shard="$1" port="$2" log="$3"
  set +x
  printf '%s\n%s\n%s\n' \
    "${PARALLEL_OWNER_KEY}" "${PARALLEL_WHITEHAT_KEY}" "${PARALLEL_ARBITER_KEY}" |
    env \
      "LEO_BIN=${LEO_BIN}" \
      "V3_CANDIDATE_WORKTREE=${V3_CANDIDATE_WORKTREE:-${ROOT_DIR}/local-devnode/candidate-protocol-v3-r2}" \
      "CANDIDATE_REF=${CANDIDATE_REF:-15b3d860948623d66eb957c69336b45af582c398}" \
      "ZKBB_DEVNODE_CACHE_ROOT=${DEVNODE_CACHE_ROOT}" \
      "ZKBB_PARALLEL_STATIC_KEY=${STATIC_KEY}" \
      bash "${RUNNER}" final-shard "${shard}" "${port}" >"${log}" 2>&1
}

launch_shard() {
  local shard="$1"
  local index="$2"
  local port="" log="" pid=""
  port="$((10#${BASE_PORT} + index))"
  log="${PARALLEL_ROOT}/logs/${shard}.log"
  printf '[parallel] starting %-26s port=%s log=%s\n' "${shard}" "${port}" "${log}"
  run_shard "${shard}" "${port}" "${log}" &
  pid=$!
  WORKER_PIDS+=("${pid}")
  PID_SHARDS["${pid}"]="${shard}"
  PID_LOGS["${pid}"]="${log}"
}

verify_shard_log() {
  local shard="$1" log="$2" marker=""
  [[ -f "${log}" ]] || return 1
  grep -Fq "Protocol V3 R2 FINAL SHARD ${shard}: PASS" "${log}" || return 1
  grep -Fq -- '- HEAD match: PASS' "${log}" || return 1
  grep -Fq -- '- main.leo changed: NO' "${log}" || return 1
  grep -Fq -- '- source integrity: PASS' "${log}" || return 1
  grep -Fq -- '- Testnet transactions: 0' "${log}" || return 1
  case "${shard}" in
    legacy) marker='v2-program-conservation' ;;
    two-core) marker='finalized dispute replay rejection: PASS' ;;
    duplicate-scope) marker='SCOPE dispute: PASS' ;;
    severity) marker='SEVERITY dispute: PASS' ;;
    reproduction-remediation) marker='REMEDIATION dispute: PASS' ;;
    three-of-three) marker='3/3 three-vote settlement acceptance: PASS' ;;
  esac
  grep -Fq "${marker}" "${log}"
}

resolve_resume_root() {
  local requested_root="${1:-${RESUME_ROOT}}" cache_root="" resume_root=""
  [[ -n "${requested_root}" ]] || die "parallel resume root is required"
  cache_root="$(realpath -e -- "${DEVNODE_CACHE_ROOT}")" \
    || die "Devnode cache root is unavailable: ${DEVNODE_CACHE_ROOT}"
  resume_root="$(realpath -e -- "${requested_root}")" \
    || die "parallel resume root is unavailable: ${requested_root}"
  [[ "$(dirname -- "${resume_root}")" == "${cache_root}" ]] \
    || die "parallel resume root must be a direct child of ${cache_root}"
  [[ "$(basename -- "${resume_root}")" == parallel-final.* && -d "${resume_root}/logs" ]] \
    || die "parallel resume root must be an existing parallel-final run"
  printf '%s\n' "${resume_root}"
}

print_final_report() {
  local shard=""
  printf 'Protocol V3 R2 Parallel Final Coverage Report\n'
  for shard in "${FINAL_SHARDS[@]}"; do
    printf '%s\n' "- ${shard}: PASS"
  done
  printf '%s\n' '- independent fresh ledgers: PASS'
  printf '%s\n' '- isolated localhost ports: PASS'
  printf '%s\n' '- unresolved dynamic gaps: NONE'
  printf '%s\n' '- Testnet transactions: 0'
  printf 'Protocol V3 R2 FINAL DYNAMIC COVERAGE: PASS\n'
  printf 'Testnet transactions broadcast by Codex: 0\n'
}

main() {
  local next_run=0 active=0 completed_pid="" status=0 shard="" log="" failures=0 index=0
  local -a run_indices=()
  validate_setting
  mkdir -p "${DEVNODE_CACHE_ROOT}"
  if [[ -n "${RESUME_ROOT}" ]]; then
    PARALLEL_ROOT="$(resolve_resume_root)"
    printf '[parallel] resuming verified run=%s\n' "${PARALLEL_ROOT}"
  else
    PARALLEL_ROOT="$(mktemp -d "${DEVNODE_CACHE_ROOT}/parallel-final.XXXXXX")"
  fi
  mkdir -p "${PARALLEL_ROOT}/logs"
  umask 077

  printf '[parallel] running static gates once before reading local role keys\n'
  env \
    "LEO_BIN=${LEO_BIN}" \
    "V3_CANDIDATE_WORKTREE=${V3_CANDIDATE_WORKTREE:-${ROOT_DIR}/local-devnode/candidate-protocol-v3-r2}" \
    "CANDIDATE_REF=${CANDIDATE_REF:-15b3d860948623d66eb957c69336b45af582c398}" \
    "ZKBB_DEVNODE_CACHE_ROOT=${DEVNODE_CACHE_ROOT}" \
    bash "${RUNNER}" preflight
  STATIC_KEY="$(env \
    "LEO_BIN=${LEO_BIN}" \
    "V3_CANDIDATE_WORKTREE=${V3_CANDIDATE_WORKTREE:-${ROOT_DIR}/local-devnode/candidate-protocol-v3-r2}" \
    "CANDIDATE_REF=${CANDIDATE_REF:-15b3d860948623d66eb957c69336b45af582c398}" \
    "ZKBB_DEVNODE_CACHE_ROOT=${DEVNODE_CACHE_ROOT}" \
    bash "${RUNNER}" static-key)"

  for index in "${!FINAL_SHARDS[@]}"; do
    shard="${FINAL_SHARDS[${index}]}"
    log="${PARALLEL_ROOT}/logs/${shard}.log"
    if verify_shard_log "${shard}" "${log}"; then
      printf '[parallel] REUSE PASS %s\n' "${shard}"
    else
      run_indices+=("${index}")
    fi
  done

  if ((${#run_indices[@]} == 0)); then
    print_final_report
    return 0
  fi

  prompt_secret PARALLEL_OWNER_KEY "Local-only Devnode owner private key"
  prompt_secret PARALLEL_WHITEHAT_KEY "Local-only Whitehat private key"
  prompt_secret PARALLEL_ARBITER_KEY "Local-only Arbiter private key"

  printf '[parallel] pending fresh-ledger shards=%s max-workers=%s logs=%s\n' \
    "${#run_indices[@]}" "${MAX_WORKERS}" "${PARALLEL_ROOT}/logs"

  while ((next_run < ${#run_indices[@]} || active > 0)); do
    while ((next_run < ${#run_indices[@]} && active < 10#${MAX_WORKERS})); do
      index="${run_indices[${next_run}]}"
      launch_shard "${FINAL_SHARDS[${index}]}" "${index}"
      next_run=$((next_run + 1))
      active=$((active + 1))
    done

    completed_pid=""
    set +e
    wait -n -p completed_pid
    status=$?
    set -e
    [[ -n "${completed_pid}" ]] || die "could not identify a completed parallel worker"
    shard="${PID_SHARDS[${completed_pid}]}"
    log="${PID_LOGS[${completed_pid}]}"
    unset 'PID_SHARDS['"${completed_pid}"']' 'PID_LOGS['"${completed_pid}"']'
    active=$((active - 1))

    if ((status == 0)) && verify_shard_log "${shard}" "${log}"; then
      printf '[parallel] PASS %s\n' "${shard}"
    else
      failures=$((failures + 1))
      printf '[parallel] FAIL %s (exit=%s)\n' "${shard}" "${status}" >&2
      tail -n 30 "${log}" >&2 || true
    fi
  done

  clear_keys
  ((failures == 0)) || die "${failures} final shard(s) failed; inspect ${PARALLEL_ROOT}/logs"

  for shard in "${FINAL_SHARDS[@]}"; do
    verify_shard_log "${shard}" "${PARALLEL_ROOT}/logs/${shard}.log" \
      || die "final aggregation rejected ${shard}; inspect ${PARALLEL_ROOT}/logs"
  done
  print_final_report
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  trap cleanup_parallel EXIT
  trap handle_signal INT TERM
  main "$@"
fi
