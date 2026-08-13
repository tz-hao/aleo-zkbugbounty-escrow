#!/usr/bin/env bash
set -euo pipefail
set +x

# Development-only Protocol V3 test orchestrator. It never targets a public
# endpoint and never reads credentials itself; the localhost harness prompts in
# the invoking terminal only after static gates have passed.

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly CANDIDATE_REF_DEFAULT="15b3d860948623d66eb957c69336b45af582c398"
readonly CANONICAL_MAIN_LEO_SHA256="75883ade8223f549db44c2d2ede0d0834bdafd3f34f5cb4d139f3a6168617247"
readonly BASELINE_FIXTURE_REL="audit/testnet-edition-0/zkbugbounty_7f3c92.edition-0.aleo"
readonly BASELINE_FIXTURE_SHA256="5f60a222cc989a55285258d1fa89ae46a6aa9e4487a396898e28cf94aa7afdf2"
readonly V3_LEO_VERSION="4.4.0"
readonly LEO_BIN="${LEO_BIN:-${HOME}/.local/leo-toolchains/${V3_LEO_VERSION}/bin/leo}"
readonly CANDIDATE_DIR="${V3_CANDIDATE_WORKTREE:-${ROOT_DIR}/local-devnode/candidate-protocol-v3-r2}"
readonly CANDIDATE_REF="${CANDIDATE_REF:-${CANDIDATE_REF_DEFAULT}}"
readonly DEVNODE_CACHE_ROOT="${ZKBB_DEVNODE_CACHE_ROOT:-${HOME}/.cache/zkbb/devnode}"
readonly STATIC_CACHE_DIR="${DEVNODE_CACHE_ROOT}/static-gates"
readonly SNAPSHOT_DIR_ROOT="${DEVNODE_CACHE_ROOT}/snapshots"
readonly RUN_DIR_ROOT="${DEVNODE_CACHE_ROOT}/runs"

CURRENT_STAGE_START_MS=0
TIME_SUMMARY=()

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/protocol-v3-dev-runner.sh preflight [--no-cache]
  bash scripts/protocol-v3-dev-runner.sh e2e <scenario> [--from-bootstrap]
  bash scripts/protocol-v3-dev-runner.sh changed
  bash scripts/protocol-v3-dev-runner.sh final
  bash scripts/protocol-v3-dev-runner.sh final-parallel

Scenarios:
  reproduction, dispute-types, quorum-2, quorum-3, non-arbiter,
  duplicate-vote, settlement-replay, refund-replay, atomicity, legacy
USAGE
}

die() {
  printf 'protocol-v3-dev: %s\n' "$*" >&2
  exit 1
}

now_ms() {
  if date +%s%3N >/dev/null 2>&1; then
    date +%s%3N
  else
    printf '%s000\n' "$(date +%s)"
  fi
}

stage_begin() {
  local label="$1"
  CURRENT_STAGE_START_MS="$(now_ms)"
  printf '[time] %s: start\n' "${label}"
}

stage_end() {
  local label="$1"
  local ended elapsed
  ended="$(now_ms)"
  elapsed=$((ended - CURRENT_STAGE_START_MS))
  TIME_SUMMARY+=("${elapsed}\t${label}")
  printf '[time] %s: %sms\n' "${label}" "${elapsed}"
}

print_slowest_stages() {
  ((${#TIME_SUMMARY[@]} > 0)) || return 0
  printf '[time] slowest stages:\n'
  printf '%b\n' "${TIME_SUMMARY[@]}" | sort -rn | head -n 10 | while IFS=$'\t' read -r elapsed label; do
    printf '  %sms %s\n' "${elapsed}" "${label}"
  done
}

require_wsl_cache_root() {
  [[ "${DEVNODE_CACHE_ROOT}" != /mnt/* ]] \
    || die "development ledger cache must use the WSL filesystem, not ${DEVNODE_CACHE_ROOT}"
  mkdir -p "${STATIC_CACHE_DIR}" "${SNAPSHOT_DIR_ROOT}" "${RUN_DIR_ROOT}"
}

require_leo() {
  [[ -x "${LEO_BIN}" ]] || die "Leo ${V3_LEO_VERSION} binary is unavailable: ${LEO_BIN}"
  [[ "$("${LEO_BIN}" --version)" == "leo ${V3_LEO_VERSION}"* ]] \
    || die "Leo ${V3_LEO_VERSION} is required: ${LEO_BIN}"
}

normalise_worktree_path() {
  local path="$1"
  if command -v wslpath >/dev/null 2>&1 && [[ "${path}" == /mnt/[a-zA-Z]/* ]]; then
    path="$(wslpath -w "${path}")"
  fi
  printf '%s\n' "${path}" | tr '\\' '/' | tr '[:upper:]' '[:lower:]' | sed 's:/*$::'
}

worktree_head_from_root() {
  local requested_path current_path="" current_head=""
  requested_path="$(normalise_worktree_path "$1")"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    case "${line}" in
      "worktree "*) current_path="$(normalise_worktree_path "${line#worktree }")"; current_head="" ;;
      "HEAD "*) current_head="${line#HEAD }" ;;
      "")
        if [[ "${current_path}" == "${requested_path}" && -n "${current_head}" ]]; then
          printf '%s\n' "${current_head}"
          return 0
        fi
        current_path=""; current_head=""
        ;;
    esac
  done < <(git -C "${ROOT_DIR}" worktree list --porcelain)
  return 1
}

candidate_gitdir() {
  local pointer="" raw=""
  [[ -f "${CANDIDATE_DIR}/.git" ]] || die "Candidate worktree .git pointer is missing: ${CANDIDATE_DIR}"
  IFS= read -r pointer < "${CANDIDATE_DIR}/.git" || die "Candidate worktree .git pointer is unreadable"
  pointer="${pointer%$'\r'}"
  [[ "${pointer}" == "gitdir: "* ]] || die "Candidate worktree .git pointer is malformed"
  raw="${pointer#gitdir: }"
  if [[ "${raw}" =~ ^[[:alpha:]]:[/\\] ]]; then
    command -v wslpath >/dev/null 2>&1 || die "Windows Candidate Git pointer requires wslpath"
    wslpath -u -- "${raw}"
  else
    realpath -e -- "${CANDIDATE_DIR}/${raw}"
  fi
}

assert_candidate_integrity() {
  local expected actual gitdir status="" canonical_sha="" normalized_sha="" fixture_sha=""
  expected="$(git -C "${ROOT_DIR}" rev-parse "${CANDIDATE_REF}^{commit}")" \
    || die "could not resolve Candidate ref: ${CANDIDATE_REF}"
  [[ "${expected}" == "${CANDIDATE_REF_DEFAULT}" ]] \
    || die "Candidate ref is not frozen R2: ${expected}"
  actual="$(worktree_head_from_root "${CANDIDATE_DIR}")" \
    || die "Candidate worktree is not registered by the root repository: ${CANDIDATE_DIR}"
  [[ "${actual}" == "${expected}" ]] || die "Candidate worktree HEAD mismatch: expected ${expected}, got ${actual:-missing}"
  gitdir="$(candidate_gitdir)"
  status="$(git -c core.autocrlf=true --git-dir="${gitdir}" --work-tree="${CANDIDATE_DIR}" status --porcelain=v1)"
  [[ -z "${status}" ]] || die "Candidate worktree is dirty after CRLF-normalized status check"
  canonical_sha="$(git -C "${ROOT_DIR}" show "${expected}:leo/bug_proof/src/main.leo" | sha256sum | awk '{print $1}')"
  [[ "${canonical_sha}" == "${CANONICAL_MAIN_LEO_SHA256}" ]] \
    || die "canonical main.leo SHA256 mismatch: ${canonical_sha}"
  normalized_sha="$(python3 - "${CANDIDATE_DIR}/leo/bug_proof/src/main.leo" <<'PY'
from pathlib import Path
import hashlib
import sys
raw = Path(sys.argv[1]).read_bytes()
normal = raw.replace(b"\r\n", b"\n")
if b"\r" in normal:
    raise SystemExit(2)
print(hashlib.sha256(normal).hexdigest())
PY
)" || die "Candidate main.leo has unsupported line endings"
  [[ "${normalized_sha}" == "${canonical_sha}" ]] \
    || die "Candidate normalized main.leo SHA256 mismatch: ${normalized_sha}"
  fixture_sha="$(sha256sum "${ROOT_DIR}/${BASELINE_FIXTURE_REL}" | awk '{print $1}')"
  [[ "${fixture_sha}" == "${BASELINE_FIXTURE_SHA256}" ]] \
    || die "baseline fixture SHA256 mismatch: ${fixture_sha}"
  git -C "${ROOT_DIR}" diff --ignore-space-at-eol --exit-code -- leo/bug_proof/src/main.leo \
    || die "root main.leo has a substantive working-tree change"
  printf 'Candidate HEAD: %s\n' "${expected}"
  printf 'canonical main.leo hash: %s\n' "${canonical_sha}"
  printf 'Candidate source integrity: PASS\n'
}

static_input_hash() {
  {
    git -C "${ROOT_DIR}" rev-parse HEAD
    git -C "${ROOT_DIR}" rev-parse "${CANDIDATE_REF}^{commit}"
    "${LEO_BIN}" --version
    git -C "${ROOT_DIR}" diff --no-ext-diff -- scripts tests package.json package-lock.json eslint.config.mjs .gitignore
    git -C "${ROOT_DIR}" diff --cached --no-ext-diff -- scripts tests package.json package-lock.json eslint.config.mjs .gitignore
    find "${ROOT_DIR}/scripts" "${ROOT_DIR}/tests" -type f -print0 | sort -z | xargs -0 sha256sum
    sha256sum "${ROOT_DIR}/package.json" "${ROOT_DIR}/package-lock.json" "${ROOT_DIR}/eslint.config.mjs" "${ROOT_DIR}/.gitignore" "${ROOT_DIR}/${BASELINE_FIXTURE_REL}" "${ROOT_DIR}/leo/bug_proof/program.json"
  } | sha256sum | awk '{print $1}'
}

run_harness_static_checks() {
  # Equivalent static harness checks when ShellCheck is not installed. Bash
  # syntax plus the focused Node regression suite catches unsupported stages,
  # unsafe ledger guards, helper arity, source integrity, and final-mode gates.
  bash -n "${ROOT_DIR}/scripts/escrow-v2-devnode-e2e.sh"
  bash -n "${ROOT_DIR}/scripts/protocol-v3-devnode-e2e.sh"
  bash -n "${ROOT_DIR}/scripts/protocol-v3-final-dynamic-coverage.sh"
  bash -n "${ROOT_DIR}/scripts/protocol-v3-dev-scenarios.sh"
  bash -n "${ROOT_DIR}/scripts/protocol-v3-dev-runner.sh"
  bash -n "${ROOT_DIR}/scripts/protocol-v3-parallel-final.sh"
  node "${ROOT_DIR}/scripts/check-protocol-v3-harness-static.mjs"
  node --experimental-strip-types --test \
    --test-name-pattern 'Protocol V3|Devnode harness|worktrees|arity|fixture' \
    "${ROOT_DIR}/tests/escrow-v2-devnode-harness.test.ts"
}

run_preflight() {
  local allow_cache="$1" key marker
  require_wsl_cache_root
  require_leo
  key="$(static_input_hash)"
  marker="${STATIC_CACHE_DIR}/${key}.pass"
  if [[ "${allow_cache}" == "1" && -f "${marker}" ]]; then
    printf 'static gates: cached PASS\n'
    printf 'static cache key: %s\n' "${key}"
    return 0
  fi

  stage_begin preflight
  assert_candidate_integrity
  (cd "${ROOT_DIR}" && env -u LEO_BIN npm test)
  (cd "${ROOT_DIR}" && npm run test:worktree-paths)
  (cd "${ROOT_DIR}" && npm run lint)
  git -c core.whitespace=cr-at-eol diff --check -- scripts tests package.json package-lock.json eslint.config.mjs .gitignore
  git -C "${ROOT_DIR}" diff --ignore-space-at-eol --exit-code -- leo/bug_proof/src/main.leo
  run_harness_static_checks
  bash "${ROOT_DIR}/tests/protocol-v3-parallel-scheduler.sh"
  if command -v shellcheck >/dev/null 2>&1; then
    shellcheck "${ROOT_DIR}/scripts/escrow-v2-devnode-e2e.sh" \
      "${ROOT_DIR}/scripts/protocol-v3-devnode-e2e.sh" \
      "${ROOT_DIR}/scripts/protocol-v3-final-dynamic-coverage.sh" \
      "${ROOT_DIR}/scripts/protocol-v3-dev-scenarios.sh" \
      "${ROOT_DIR}/scripts/protocol-v3-parallel-final.sh" \
      "${ROOT_DIR}/scripts/protocol-v3-dev-runner.sh"
    printf 'shellcheck: PASS\n'
  else
    printf 'shellcheck: unavailable; equivalent harness static checks: PASS\n'
  fi
  (cd "${ROOT_DIR}/scripts/fixtures/v3-public-key-deriver" && \
    "${LEO_BIN}" build --offline --disable-update-check --network testnet --endpoint http://127.0.0.1:3030)
  printf '%s\n' "${key}" > "${marker}"
  printf 'static gates: PASS\n'
  printf 'static cache key: %s\n' "${key}"
  stage_end preflight
  print_slowest_stages
}

assert_scenario() {
  case "$1" in
    reproduction|dispute-types|quorum-2|quorum-3|non-arbiter|duplicate-vote|settlement-replay|refund-replay|atomicity|legacy) ;;
    *) die "unsupported V3 development scenario: $1" ;;
  esac
}

run_scenario() {
  local scenario="$1" from_bootstrap="$2" key run_dir snapshot_dir harness_stage="development" protocol_v3="1"
  assert_scenario "${scenario}"
  run_preflight 1
  if [[ "${scenario}" == "legacy" ]]; then
    harness_stage="legacy"
    protocol_v3="0"
  fi
  key="$(static_input_hash)"
  snapshot_dir="${SNAPSHOT_DIR_ROOT}/${key}"
  run_dir="${RUN_DIR_ROOT}/${key}/${scenario}/run-$(date +%s%N)-$$"
  mkdir -p "${run_dir}"
  [[ ! -e "${run_dir}/ledger" ]] || die "development run ledger unexpectedly exists: ${run_dir}/ledger"
  stage_begin "v3-${scenario}"
  env \
    "LEO_BIN=${LEO_BIN}" \
    "V3_CANDIDATE_WORKTREE=${CANDIDATE_DIR}" \
    "CANDIDATE_REF=${CANDIDATE_REF}" \
    "ZKBB_RUN_PROTOCOL_V3=${protocol_v3}" \
    "V3_STATIC_GATES_PASSED=1" \
    "ESCROW_DEVNODE_STAGE=${harness_stage}" \
    "ZKBB_DEV_MODE=1" \
    "ZKBB_DEV_SCENARIO=${scenario}" \
    "ZKBB_DEV_SNAPSHOT_DIR=${snapshot_dir}" \
    "ZKBB_DEV_SNAPSHOT_KEY=${key}" \
    "ZKBB_DEV_SNAPSHOT_RESUME=${from_bootstrap}" \
    "ZKBB_DEVNODE_LEDGER_DIR=${run_dir}/ledger" \
    "ZKBB_DEVNODE_CACHE_ROOT=${DEVNODE_CACHE_ROOT}" \
    bash "${ROOT_DIR}/scripts/escrow-v2-devnode-e2e.sh"
  stage_end "v3-${scenario}"
  print_slowest_stages
}

select_changed_scenario() {
  local changed
  changed="$(git -C "${ROOT_DIR}" diff --name-only -- scripts tests package.json eslint.config.mjs)"
  case "${changed}" in
    *protocol-v3-final-dynamic-coverage.sh*|*protocol-v3-dev-scenarios.sh*) printf 'dispute-types\n' ;;
    *leo-struct-reader*|*fixture*) printf 'quorum-2\n' ;;
    *escrow-v2-devnode-e2e.sh*|*protocol-v3-devnode-e2e.sh*) printf 'reproduction\n' ;;
    *) printf 'reproduction\n' ;;
  esac
}

run_final() {
  [[ -z "${ZKBB_DEV_SNAPSHOT_DIR:-}" && -z "${ZKBB_DEVNODE_REUSE_LEDGER:-}" && -z "${ESCROW_DEVNODE_STAGE:-}" ]] \
    || die "final mode forbids resume, snapshot, reuse ledger, and stage overrides"
  require_wsl_cache_root
  local final_root final_ledger
  final_root="$(mktemp -d "${DEVNODE_CACHE_ROOT}/final-run.XXXXXX")"
  final_ledger="${final_root}/ledger"
  [[ ! -e "${final_ledger}" ]] || die "final mode requires a fresh ledger path"
  exec env \
    "LEO_BIN=${LEO_BIN}" \
    "V3_CANDIDATE_WORKTREE=${CANDIDATE_DIR}" \
    "CANDIDATE_REF=${CANDIDATE_REF}" \
    "ZKBB_FINAL_MODE=1" \
    "ZKBB_DEVNODE_CACHE_ROOT=${DEVNODE_CACHE_ROOT}" \
    "ZKBB_DEVNODE_LEDGER_DIR=${final_ledger}" \
    bash "${ROOT_DIR}/scripts/protocol-v3-devnode-e2e.sh"
}

assert_final_shard() {
  case "$1" in
    legacy|two-core|duplicate-scope|severity|reproduction-remediation|three-of-three) ;;
    *) die "unsupported final shard: $1" ;;
  esac
}

run_final_shard() {
  local shard="$1" port="$2" expected_static_key="${ZKBB_PARALLEL_STATIC_KEY:-}"
  local actual_static_key="" final_root="" final_ledger=""
  assert_final_shard "${shard}"
  [[ "${port}" =~ ^[0-9]+$ ]] || die "invalid final shard port: ${port}"
  [[ -n "${expected_static_key}" ]] || die "parallel final shard requires a verified static cache key"
  require_wsl_cache_root
  require_leo
  actual_static_key="$(static_input_hash)"
  [[ "${actual_static_key}" == "${expected_static_key}" ]] \
    || die "parallel final shard static inputs changed after preflight"
  [[ -f "${STATIC_CACHE_DIR}/${expected_static_key}.pass" ]] \
    || die "parallel final shard has no matching successful preflight marker"
  final_root="$(mktemp -d "${DEVNODE_CACHE_ROOT}/final-run.XXXXXX")"
  final_ledger="${final_root}/ledger"
  [[ ! -e "${final_ledger}" ]] || die "parallel final shard requires a fresh ledger path"
  exec env \
    "LEO_BIN=${LEO_BIN}" \
    "V3_CANDIDATE_WORKTREE=${CANDIDATE_DIR}" \
    "CANDIDATE_REF=${CANDIDATE_REF}" \
    "ZKBB_RUN_PROTOCOL_V3=1" \
    "V3_STATIC_GATES_PASSED=1" \
    "ZKBB_FINAL_MODE=1" \
    "ZKBB_FINAL_SHARD=${shard}" \
    "ZKBB_DEVNODE_PORT=${port}" \
    "ZKBB_DEVNODE_ENDPOINT=http://127.0.0.1:${port}" \
    "ZKBB_DEVNODE_CACHE_ROOT=${DEVNODE_CACHE_ROOT}" \
    "ZKBB_DEVNODE_LEDGER_DIR=${final_ledger}" \
    bash "${ROOT_DIR}/scripts/escrow-v2-devnode-e2e.sh"
}

run_parallel_final() {
  exec bash "${ROOT_DIR}/scripts/protocol-v3-parallel-final.sh"
}

main() {
  local command="${1:-}" scenario="" from_bootstrap=0
  case "${command}" in
    preflight)
      [[ "${2:-}" != "--no-cache" || $# -eq 2 ]] || die "preflight accepts only --no-cache"
      run_preflight "$([[ "${2:-}" == "--no-cache" ]] && printf 0 || printf 1)"
      ;;
    e2e)
      scenario="${2:-}"; [[ -n "${scenario}" ]] || { usage >&2; exit 2; }
      [[ "${3:-}" == "" || "${3:-}" == "--from-bootstrap" ]] || die "e2e accepts only --from-bootstrap"
      [[ "${3:-}" == "--from-bootstrap" ]] && from_bootstrap=1
      run_scenario "${scenario}" "${from_bootstrap}"
      ;;
    changed)
      scenario="$(select_changed_scenario)"
      printf 'v3:e2e:changed selected scenario: %s\n' "${scenario}"
      run_scenario "${scenario}" 1
      ;;
    final) run_final ;;
    final-parallel) run_parallel_final ;;
    final-shard)
      [[ $# -eq 3 ]] || die "final-shard requires a shard name and local port"
      run_final_shard "$2" "$3"
      ;;
    static-key)
      [[ $# -eq 1 ]] || die "static-key accepts no arguments"
      require_wsl_cache_root
      require_leo
      static_input_hash
      ;;
    *) usage >&2; exit 2 ;;
  esac
}

main "$@"
