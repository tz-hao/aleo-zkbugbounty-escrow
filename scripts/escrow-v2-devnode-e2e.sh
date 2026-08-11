#!/usr/bin/env bash

set -euo pipefail
set +x

LEO_BIN="${LEO_BIN:-leo}"

# This harness only exercises a disposable localhost Devnode. It never accepts a
# live endpoint, persists a local-only key, or emits private witness inputs.

readonly PROGRAM_ID="zkbugbounty_7f3c92.aleo"
readonly ALEO_E2E_NETWORK="testnet"
readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly BASELINE_DIR="${ZKBB_DEVNODE_BASELINE_DIR:-${ROOT_DIR}/local-devnode/baseline-pre-escrow}"
readonly CANDIDATE_DIR="${V3_CANDIDATE_WORKTREE:-${ZKBB_DEVNODE_CANDIDATE_DIR:-${ROOT_DIR}/local-devnode/candidate-escrow-v2}}"
readonly CANDIDATE_REF="${CANDIDATE_REF:-${ZKBB_DEVNODE_CANDIDATE_REF:-escrow-v2-leo-4.4-migration}}"
readonly ROOT_CANDIDATE_SOURCE="${ROOT_DIR}/leo/bug_proof/src/main.leo"
readonly TESTNET_EDITION_ZERO_FIXTURE="${ROOT_DIR}/audit/testnet-edition-0/zkbugbounty_7f3c92.edition-0.aleo"
readonly TESTNET_EDITION_ZERO_FIXTURE_SHA256="5f60a222cc989a55285258d1fa89ae46a6aa9e4487a396898e28cf94aa7afdf2"
readonly REAL_BASELINE_MATERIALIZER="${ROOT_DIR}/scripts/materialize-testnet-edition0-baseline.mjs"
readonly ALEO_E2E_LEDGER="${ZKBB_DEVNODE_LEDGER_DIR:-${ROOT_DIR}/local-devnode/ledger}"
readonly ALEO_E2E_ENDPOINT="${ZKBB_DEVNODE_ENDPOINT:-http://127.0.0.1:3030}"
readonly MINIMUM_V9_BLOCK_ADVANCE=20
readonly MINIMUM_OWNER_MICROCREDITS=200000000
# One Aleo credit is one million microcredits. The 5,000-credit allocation is
# at least fifty times the 100-credit per-transaction guard used by this E2E.
readonly MICROCREDITS_PER_CREDIT=1000000
readonly BOOTSTRAP_TRANSFER_MICROCREDITS=5000000000
readonly MINIMUM_ROLE_TRANSACTION_MICROCREDITS=100000000
readonly MINIMUM_OWNER_BOOTSTRAP_MICROCREDITS=$((BOOTSTRAP_TRANSFER_MICROCREDITS * 2 + MINIMUM_OWNER_MICROCREDITS))
readonly TRANSACTION_WAIT_ATTEMPTS=60
readonly TRANSACTION_500_ATTEMPTS=3
readonly REPORT_DIR="${ROOT_DIR}/local-e2e-results"
readonly REPORT_FILE="${REPORT_DIR}/escrow-v2-devnode-report.json"
readonly LOCAL_PRIVATE_KEY_LENGTH=59
readonly PREFLIGHT_OWNER_ADDRESS="aleo1preflightowner00000000000000000000000000000000000000000000000"
readonly PREFLIGHT_ARBITER_ADDRESS="aleo1preflightarbiter00000000000000000000000000000000000000000000"

ALEO_E2E_DEVNODE_PID=""
ALEO_E2E_DEVNODE_LOG="${REPORT_DIR}/escrow-v2-devnode.log"
ALEO_E2E_LAUNCH_DIR=""
DEVNODE_PRIVATE_KEY=""
OWNER_PRIVATE_KEY=""
WHITEHAT_PRIVATE_KEY=""
ARBITER_PRIVATE_KEY=""
OWNER_ADDRESS=""
WHITEHAT_ADDRESS=""
ARBITER_ADDRESS=""
LAST_OUTPUT=""
LAST_BROADCAST_OUTPUT=""
HTTP_RESPONSE_STATUS=""
HTTP_RESPONSE_BODY=""
READ_MAPPING_U64_STATUS=""
READ_MAPPING_U64_VALUE=""
BOOTSTRAP_WHITEHAT_TX_ID=""
BOOTSTRAP_WHITEHAT_FEE_ID=""
BOOTSTRAP_WHITEHAT_FEE_TX_ID=""
BOOTSTRAP_ARBITER_TX_ID=""
BOOTSTRAP_ARBITER_FEE_ID=""
BOOTSTRAP_ARBITER_FEE_TX_ID=""
BASELINE_DEPLOY_TX_ID=""
BASELINE_DEPLOY_FEE_ID=""
BASELINE_DEPLOY_FEE_TX_ID=""
UPGRADE_TX_ID=""
UPGRADE_FEE_ID=""
UPGRADE_FEE_TX_ID=""
V1_CREATE_BOUNTY_TX_ID=""
V1_CREATE_BOUNTY_FEE_ID=""
V1_CREATE_BOUNTY_FEE_TX_ID=""
V1_SUBMIT_CLAIM_TX_ID=""
V1_SUBMIT_CLAIM_FEE_ID=""
V1_SUBMIT_CLAIM_FEE_TX_ID=""
BOOTSTRAP_OWNER_BALANCE_BEFORE=""
BOOTSTRAP_WHITEHAT_BALANCE_BEFORE=""
BOOTSTRAP_ARBITER_BALANCE_BEFORE=""
BASELINE_SOURCE_BACKUP=""
BASELINE_PROGRAM_BACKUP=""
CANDIDATE_SOURCE_BACKUP=""
CLEANUP_DONE=0
ALEO_E2E_BOOTSTRAP_COMPLETE=0

die() {
  printf 'escrow-devnode-e2e: %s\n' "$*" >&2
  exit 1
}

assert_local_endpoint() {
  case "${ALEO_E2E_ENDPOINT}" in
    http://127.0.0.1:3030|http://localhost:3030) ;;
    *) die "refusing non-local endpoint: ${ALEO_E2E_ENDPOINT}" ;;
  esac
}

assert_no_direct_network_mutation() {
  local direct_assignment='(^|[[:space:]])(export[[:space:]]+)?N'"'"'ETWORK='
  local mutation='unset[[:space:]]+N'"'"'ETWORK|readonly[[:space:]]+N'"'"'ETWORK'

  if grep -nE "${direct_assignment}" "${BASH_SOURCE[0]}"; then
    die "direct NETWORK assignment remains"
  fi
  if grep -nE "${mutation}" "${BASH_SOURCE[0]}"; then
    die "NETWORK mutation remains"
  fi
}

is_preflight_only() {
  [[ "${ESCROW_DEVNODE_PREFLIGHT_ONLY:-}" == "1" ]]
}

current_stage() {
  printf '%s' "${ESCROW_DEVNODE_STAGE:-full}"
}

is_bootstrap_stage() {
  [[ "$(current_stage)" == "bootstrap" ]]
}

assert_supported_stage() {
  case "$(current_stage)" in
    bootstrap|full) ;;
    *) die "unsupported ESCROW_DEVNODE_STAGE: $(current_stage) (use bootstrap or full)" ;;
  esac
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || die "required tool unavailable: $1"
}

require_directory() {
  [[ -d "$1" ]] || die "required directory unavailable: $1"
}

validate_local_private_key() {
  local label="$1"
  local value="$2"
  local private_key_prefix="A""Private""Key"
  local view_key_prefix="A""View""Key"
  local private_key_pattern="^${private_key_prefix}1[[:alnum:]_]+$"

  [[ -n "${value}" ]] || die "${label} is required"
  [[ "${value}" != *[[:space:]]* ]] || die "${label} must be a single key token; do not paste a label, address, View Key, or encrypted export"

  case "${value}" in
    aleo1*)
      die "${label} received an Aleo address. Enter the matching local-only account private key instead"
      ;;
    "${view_key_prefix}"*)
      die "${label} received a View Key. Enter the matching local-only account private key instead"
      ;;
    "${private_key_prefix}"*)
      ;;
    *)
      die "${label} must be a local-only Leo account private key, not an address, View Key, labeled export, or encrypted export"
      ;;
  esac

  [[ "${#value}" -eq "${LOCAL_PRIVATE_KEY_LENGTH}" ]] || die "${label} does not match the Leo account private-key format. Enter only the local account key token"
  [[ "${value}" =~ ${private_key_pattern} ]] || die "${label} contains unsupported characters. Enter only the unencrypted local account key token"
}

prompt_secret() {
  local variable_name="$1"
  local prompt="$2"
  local value=""
  if ! read -r -s -p "${prompt}: " value; then
    printf '\n'
    die "${prompt} input was interrupted"
  fi
  printf '\n'
  validate_local_private_key "${prompt}" "${value}"
  printf -v "${variable_name}" '%s' "${value}"
  unset value
}

prompt_address() {
  local variable_name="$1"
  local prompt="$2"
  local value=""
  if ! read -r -p "${prompt}: " value; then
    die "${prompt} input was interrupted"
  fi
  [[ "${value}" =~ ^aleo1[0-9a-z]+$ ]] || die "${prompt} is not an Aleo address"
  printf -v "${variable_name}" '%s' "${value}"
  unset value
}

provision_local_accounts() {
  prompt_secret OWNER_PRIVATE_KEY "Local-only Devnode owner private key"
  # Leo Devnode seeds local Credits to its startup identity, so the owner who
  # deploys and funds the baseline must be that same local-only identity.
  DEVNODE_PRIVATE_KEY="${OWNER_PRIVATE_KEY}"
  prompt_address OWNER_ADDRESS "Local-only Devnode owner public address"
  prompt_address WHITEHAT_ADDRESS "Local-only Whitehat public address"
  prompt_address ARBITER_ADDRESS "Local-only Arbiter public address"

  # Bootstrap only transfers public Credits from the Owner. Recipient keys are
  # unnecessary until the full E2E submits a Whitehat claim.
  if is_bootstrap_stage; then
    return 0
  fi

  prompt_secret WHITEHAT_PRIVATE_KEY "Local-only Whitehat private key"
  prompt_secret ARBITER_PRIVATE_KEY "Local-only Arbiter private key"
  assert_full_e2e_inputs
}

clean_local_ledger() {
  local expected
  expected="$(realpath -m "${ROOT_DIR}/local-devnode/ledger")"
  [[ "$(realpath -m "${ALEO_E2E_LEDGER}")" == "${expected}" ]] || die "ledger must be the isolated sibling directory"
  rm -rf -- "${expected}"
  mkdir -p "${expected}"
}

normalise_worktree_path() {
  local path="$1"
  if command -v wslpath >/dev/null 2>&1 && [[ "${path}" == /mnt/[a-zA-Z]/* ]]; then
    path="$(wslpath -w "${path}")"
  fi
  printf '%s\n' "${path}" | tr '\\' '/' | tr '[:upper:]' '[:lower:]' | sed 's:/*$::'
}

worktree_head_from_root() {
  local requested_path
  local current_path=""
  local current_head=""
  requested_path="$(normalise_worktree_path "$1")"

  while IFS= read -r line || [[ -n "${line}" ]]; do
    case "${line}" in
      "worktree "*)
        current_path="$(normalise_worktree_path "${line#worktree }")"
        current_head=""
        ;;
      "HEAD "*)
        current_head="${line#HEAD }"
        ;;
      "")
        if [[ "${current_path}" == "${requested_path}" && -n "${current_head}" ]]; then
          printf '%s\n' "${current_head}"
          return 0
        fi
        current_path=""
        current_head=""
        ;;
    esac
  done < <(git -C "${ROOT_DIR}" worktree list --porcelain)

  if [[ "${current_path}" == "${requested_path}" && -n "${current_head}" ]]; then
    printf '%s\n' "${current_head}"
    return 0
  fi
  return 1
}

read_linked_worktree_gitdir() {
  local workspace="$1"
  local pointer=""

  [[ -f "${workspace}/.git" ]] || return 1
  IFS= read -r pointer < "${workspace}/.git" || return 1
  pointer="${pointer%$'\r'}"
  [[ "${pointer}" == "gitdir: "* ]] || return 1
  pointer="${pointer#gitdir: }"
  [[ -n "${pointer}" ]] || return 1
  printf '%s\n' "${pointer}"
}

resolve_gitdir_path() {
  local worktree_dir="$1"
  local gitdir_value="$2"
  local resolved_path=""

  gitdir_value="${gitdir_value%$'\r'}"
  [[ -n "${gitdir_value}" ]] || return 1

  if [[ "${gitdir_value}" =~ ^[[:alpha:]]:[/\\] ]]; then
    if command -v wslpath >/dev/null 2>&1; then
      resolved_path="$(wslpath -u -- "${gitdir_value}")" || return 1
    else
      resolved_path="${gitdir_value}"
    fi
  elif [[ "${gitdir_value}" == /* ]]; then
    resolved_path="${gitdir_value}"
  else
    resolved_path="${worktree_dir}/${gitdir_value}"
  fi

  realpath -e -- "${resolved_path}"
}

linked_worktree_head_from_gitdir() {
  local gitdir="$1"
  local raw_head=""
  local revision=""

  [[ -f "${gitdir}/HEAD" ]] || return 1
  IFS= read -r raw_head < "${gitdir}/HEAD" || return 1
  raw_head="${raw_head%$'\r'}"
  [[ -n "${raw_head}" ]] || return 1
  revision="${raw_head#ref: }"
  git -C "${ROOT_DIR}" rev-parse "${revision}^{commit}"
}

assert_worktree_ref() {
  local workspace="$1"
  local ref="$2"
  local expected candidate_head registered_head candidate_gitdir candidate_gitdir_value
  local candidate_common_dir candidate_common_dir_value root_common_dir

  expected="$(git -C "${ROOT_DIR}" rev-parse "${ref}^{commit}")" \
    || die "could not resolve candidate ref: ${ref}"
  candidate_gitdir_value="$(read_linked_worktree_gitdir "${workspace}")" \
    || die "candidate Git metadata is invalid: ${workspace}"
  candidate_gitdir="$(resolve_gitdir_path "${workspace}" "${candidate_gitdir_value}")" \
    || die "could not resolve candidate Git directory: ${workspace}"
  [[ -f "${candidate_gitdir}/commondir" ]] \
    || die "candidate Git common-directory metadata is missing: ${workspace}"
  IFS= read -r candidate_common_dir_value < "${candidate_gitdir}/commondir" \
    || die "could not read candidate Git common-directory metadata: ${workspace}"
  candidate_common_dir="$(resolve_gitdir_path "${candidate_gitdir}" "${candidate_common_dir_value}")" \
    || die "could not resolve candidate Git common directory: ${workspace}"
  root_common_dir="$(resolve_gitdir_path "${ROOT_DIR}" "$(git -C "${ROOT_DIR}" rev-parse --git-common-dir)")" \
    || die "could not resolve root Git common directory"
  [[ "${candidate_common_dir}" == "${root_common_dir}" ]] \
    || die "candidate is not registered by the root Git worktree: ${workspace}"
  candidate_head="$(linked_worktree_head_from_gitdir "${candidate_gitdir}")" \
    || die "could not resolve candidate HEAD metadata: ${workspace}"
  registered_head="$(worktree_head_from_root "${workspace}")" \
    || die "candidate is not registered by the root Git worktree: ${workspace}"
  [[ "${candidate_head}" == "${registered_head}" ]] \
    || die "candidate HEAD metadata does not match the root Git worktree: ${workspace}"

  if [[ "${candidate_head}" != "${expected}" ]]; then
    printf 'escrow-devnode-e2e: candidate HEAD mismatch\n' >&2
    printf 'expected: %s\n' "${expected}" >&2
    printf 'actual:   %s\n' "${candidate_head}" >&2
    exit 1
  fi

  printf 'escrow-devnode-e2e: candidate HEAD match\n'
  printf 'expected: %s\n' "${expected}"
  printf 'actual:   %s\n' "${candidate_head}"
  printf 'MATCH\n'
}

backup_test_sources() {
  BASELINE_SOURCE_BACKUP="$(mktemp "${REPORT_DIR}/baseline-main.leo.XXXXXX")"
  BASELINE_PROGRAM_BACKUP="$(mktemp "${REPORT_DIR}/baseline-program.json.XXXXXX")"
  CANDIDATE_SOURCE_BACKUP="$(mktemp "${REPORT_DIR}/candidate-main.leo.XXXXXX")"
  cp -- "${BASELINE_DIR}/leo/bug_proof/src/main.leo" "${BASELINE_SOURCE_BACKUP}"
  cp -- "${BASELINE_DIR}/leo/bug_proof/program.json" "${BASELINE_PROGRAM_BACKUP}"
  cp -- "${CANDIDATE_DIR}/leo/bug_proof/src/main.leo" "${CANDIDATE_SOURCE_BACKUP}"
}

materialize_root_candidate_snapshot() {
  local candidate_source="${CANDIDATE_DIR}/leo/bug_proof/src/main.leo"

  if [[ -n "${V3_CANDIDATE_WORKTREE:-}" ]]; then
    printf '[candidate-source] explicit V3 Candidate worktree\n'
    return 0
  fi

  [[ -f "${ROOT_CANDIDATE_SOURCE}" ]] || die "root Candidate source is missing: ${ROOT_CANDIDATE_SOURCE}"
  [[ -f "${candidate_source}" ]] || die "temporary Candidate source is missing: ${candidate_source}"
  grep -q '^    fn submit_claim(' "${ROOT_CANDIDATE_SOURCE}" \
    || die "root Candidate is missing the preserved submit_claim entry"
  grep -q '^    fn submit_claim_v2(' "${ROOT_CANDIDATE_SOURCE}" \
    || die "root Candidate is missing submit_claim_v2"

  cp -- "${ROOT_CANDIDATE_SOURCE}" "${candidate_source}"
  cmp -s "${ROOT_CANDIDATE_SOURCE}" "${candidate_source}" \
    || die "temporary Candidate source does not match the root Candidate snapshot"
  grep -q '^    fn submit_claim_v2(' "${candidate_source}" \
    || die "temporary Candidate snapshot is missing submit_claim_v2"
  printf '[candidate-source] root Candidate snapshot\n'
}

fixture_sha256() {
  sha256sum "${TESTNET_EDITION_ZERO_FIXTURE}" | awk '{print $1}'
}

assert_fixture_integrity() {
  local fixture_hash=""
  [[ -f "${TESTNET_EDITION_ZERO_FIXTURE}" ]] || die "real Testnet edition 0 fixture is missing: ${TESTNET_EDITION_ZERO_FIXTURE}"
  fixture_hash="$(fixture_sha256)"
  [[ "${fixture_hash}" == "${TESTNET_EDITION_ZERO_FIXTURE_SHA256}" ]] \
    || die "real Testnet edition 0 fixture SHA256 mismatch: ${fixture_hash}"
}

materialize_real_testnet_edition_zero_baseline() {
  local baseline_source="${BASELINE_DIR}/leo/bug_proof/src/main.leo"
  local fixture_hash=""

  assert_fixture_integrity
  [[ -f "${REAL_BASELINE_MATERIALIZER}" ]] || die "edition 0 baseline materializer is missing"
  node "${REAL_BASELINE_MATERIALIZER}" \
    "${ROOT_CANDIDATE_SOURCE}" "${baseline_source}" "${TESTNET_EDITION_ZERO_FIXTURE}" \
    || die "could not materialize the real Testnet edition 0 compatible baseline"
  cp -- "${ROOT_DIR}/leo/bug_proof/program.json" "${BASELINE_DIR}/leo/bug_proof/program.json"
  grep -q '"leo": "4.4.0"' "${BASELINE_DIR}/leo/bug_proof/program.json" \
    || die "local Edition 0 baseline must use the Leo 4.4 compiler manifest"
  [[ -n "${BASELINE_SOURCE_BACKUP}" ]] || die "historical baseline backup is unavailable"
  if cmp -s "${baseline_source}" "${BASELINE_SOURCE_BACKUP}"; then
    die "refusing to use the historical Git baseline source for the full E2E"
  fi
  grep -q '^    fn submit_claim(' "${baseline_source}" \
    || die "real Testnet edition 0 compatible baseline is missing submit_claim"
  grep -q '^    fn submit_claim_v2(' "${baseline_source}" \
    && die "real Testnet edition 0 compatible baseline retains submit_claim_v2"
  fixture_hash="$(fixture_sha256)"
  printf '[baseline-source] real Testnet edition 0 fixture\n'
  printf '[baseline-source] fixture SHA256: %s\n' "${fixture_hash}"
  printf '[baseline-source] historical Git baseline used: no\n'
}

verify_testnet_edition_zero_interface() {
  local workspace="$1"
  local label="$2"
  local constructor_mode="${3:-strict}"
  local build_path="${workspace}/leo/bug_proof/build/zkbugbounty_7f3c92/zkbugbounty_7f3c92.aleo"
  local verifier=(node --experimental-strip-types "${ROOT_DIR}/scripts/verify-aleo-upgrade-compatibility.ts" "${TESTNET_EDITION_ZERO_FIXTURE}" "${build_path}")

  [[ -f "${build_path}" ]] || die "${label} build output is missing: ${build_path}"
  if [[ "${constructor_mode}" == "local-address" ]]; then
    verifier+=(--ignore-constructor)
  fi
  "${verifier[@]}" || die "${label} does not preserve the real Testnet edition 0 interface"
  printf '[%s] real edition 0 interface compatibility: passed\n' "${label}"
}

prepare_real_testnet_edition_zero_sources() {
  backup_test_sources
  materialize_real_testnet_edition_zero_baseline
  materialize_root_candidate_snapshot
  build_program "${BASELINE_DIR}"
  verify_testnet_edition_zero_interface "${BASELINE_DIR}" "baseline-source"
  build_program "${CANDIDATE_DIR}"
  verify_testnet_edition_zero_interface "${CANDIDATE_DIR}" "candidate-source"
  assert_fixture_integrity
}

restore_test_worktrees() {
  if [[ -n "${BASELINE_SOURCE_BACKUP}" && -f "${BASELINE_SOURCE_BACKUP}" ]]; then
    cp -- "${BASELINE_SOURCE_BACKUP}" "${BASELINE_DIR}/leo/bug_proof/src/main.leo"
    rm -f -- "${BASELINE_SOURCE_BACKUP}"
  fi
  if [[ -n "${BASELINE_PROGRAM_BACKUP}" && -f "${BASELINE_PROGRAM_BACKUP}" ]]; then
    cp -- "${BASELINE_PROGRAM_BACKUP}" "${BASELINE_DIR}/leo/bug_proof/program.json"
    rm -f -- "${BASELINE_PROGRAM_BACKUP}"
  fi
  if [[ -n "${CANDIDATE_SOURCE_BACKUP}" && -f "${CANDIDATE_SOURCE_BACKUP}" ]]; then
    cp -- "${CANDIDATE_SOURCE_BACKUP}" "${CANDIDATE_DIR}/leo/bug_proof/src/main.leo"
    rm -f -- "${CANDIDATE_SOURCE_BACKUP}"
  fi
}

cleanup_devnode() {
  local pid="${ALEO_E2E_DEVNODE_PID:-}"

  [[ -n "${pid}" ]] || return 0
  if kill -0 "${pid}" 2>/dev/null; then
    kill "${pid}" 2>/dev/null || true
    for _ in {1..20}; do
      kill -0 "${pid}" 2>/dev/null || break
      sleep 0.25
    done
    if kill -0 "${pid}" 2>/dev/null; then
      kill -9 "${pid}" 2>/dev/null || true
    fi
  fi
  wait "${pid}" 2>/dev/null || true
  ALEO_E2E_DEVNODE_PID=""
}

cleanup_all() {
  if [[ "${CLEANUP_DONE:-0}" == "1" ]]; then
    return 0
  fi
  CLEANUP_DONE=1
  cleanup_devnode
  if [[ -n "${ALEO_E2E_LAUNCH_DIR:-}" && -d "${ALEO_E2E_LAUNCH_DIR}" ]]; then
    rmdir "${ALEO_E2E_LAUNCH_DIR}" 2>/dev/null || true
  fi
  restore_test_worktrees
  DEVNODE_PRIVATE_KEY=""
  OWNER_PRIVATE_KEY=""
  WHITEHAT_PRIVATE_KEY=""
  ARBITER_PRIVATE_KEY=""
  OWNER_ADDRESS=""
  WHITEHAT_ADDRESS=""
  ARBITER_ADDRESS=""
  LAST_OUTPUT=""
  LAST_BROADCAST_OUTPUT=""
  HTTP_RESPONSE_STATUS=""
  HTTP_RESPONSE_BODY=""
  READ_MAPPING_U64_STATUS=""
  READ_MAPPING_U64_VALUE=""
  BOOTSTRAP_WHITEHAT_TX_ID=""
  BOOTSTRAP_WHITEHAT_FEE_ID=""
  BOOTSTRAP_WHITEHAT_FEE_TX_ID=""
  BOOTSTRAP_ARBITER_TX_ID=""
  BOOTSTRAP_ARBITER_FEE_ID=""
  BOOTSTRAP_ARBITER_FEE_TX_ID=""
  BASELINE_DEPLOY_TX_ID=""
  BASELINE_DEPLOY_FEE_ID=""
  BASELINE_DEPLOY_FEE_TX_ID=""
  UPGRADE_TX_ID=""
  UPGRADE_FEE_ID=""
  UPGRADE_FEE_TX_ID=""
  V1_CREATE_BOUNTY_TX_ID=""
  V1_CREATE_BOUNTY_FEE_ID=""
  V1_CREATE_BOUNTY_FEE_TX_ID=""
  V1_SUBMIT_CLAIM_TX_ID=""
  V1_SUBMIT_CLAIM_FEE_ID=""
  V1_SUBMIT_CLAIM_FEE_TX_ID=""
  BOOTSTRAP_OWNER_BALANCE_BEFORE=""
  BOOTSTRAP_WHITEHAT_BALANCE_BEFORE=""
  BOOTSTRAP_ARBITER_BALANCE_BEFORE=""
}

handle_signal() {
  local exit_code="$1"
  trap - INT TERM
  cleanup_all
  exit "${exit_code}"
}

trap cleanup_all EXIT
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

event_log=""
record_event() {
  printf '%s\t%s\n' "$1" "$2" >>"${event_log}"
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-60}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if curl --fail --silent --max-time 1 "${url}" >/dev/null 2>&1; then
      return
    fi

    if [[ -n "${ALEO_E2E_DEVNODE_PID:-}" ]] && ! kill -0 "${ALEO_E2E_DEVNODE_PID}" 2>/dev/null; then
      echo "escrow-devnode-e2e: devnode exited before readiness" >&2
      print_sanitized_devnode_log
      return 1
    fi
    sleep 1
  done

  echo "escrow-devnode-e2e: localhost devnode did not become ready" >&2
  print_sanitized_devnode_log
  return 1
}

print_sanitized_devnode_log() {
  local private_key_prefix="A""Private""Key"

  tail -n 100 "${ALEO_E2E_DEVNODE_LOG:-/dev/null}" 2>/dev/null \
    | sed -E "s/${private_key_prefix}[[:alnum:]_]+/[REDACTED]/g" >&2 || true
}

generate_preflight_devnode_key() {
  local account_output=""
  local key=""
  local private_key_prefix="A""Private""Key"

  account_output="$("${LEO_BIN}" account new --network "${ALEO_E2E_NETWORK}" 2>/dev/null)" || die "could not generate an ephemeral local Devnode key"
  key="$(printf '%s\n' "${account_output}" | tr -cs '[:alnum:]_' '\n' | awk -v prefix="${private_key_prefix}" 'index($0, prefix) == 1 { print; exit }')"
  account_output=""
  validate_local_private_key "generated local Devnode account" "${key}"
  printf '%s' "${key}"
  key=""
}


generate_ephemeral_local_account() {
  local key_variable="$1"
  local address_variable="$2"
  local label="$3"
  local account_output=""
  local key=""
  local public_address=""
  local private_key_prefix="A""Private""Key"

  account_output="$("${LEO_BIN}" account new --network "${ALEO_E2E_NETWORK}" 2>/dev/null)"     || die "could not generate ${label}"
  key="$(printf '%s\n' "${account_output}" | tr -cs '[:alnum:]_' '\n' |
    awk -v prefix="${private_key_prefix}" 'index($0, prefix) == 1 { print; exit }')"
  public_address="$(printf '%s\n' "${account_output}" | tr -cs '[:alnum:]_' '\n' |
    awk 'index($0, "aleo1") == 1 { print; exit }')"
  account_output=""

  validate_local_private_key "${label}" "${key}"
  [[ "${public_address}" =~ ^aleo1[0-9a-z]+$ ]] ||
    die "${label} did not produce a valid public address"
  printf -v "${key_variable}" '%s' "${key}"
  printf -v "${address_variable}" '%s' "${public_address}"
  key=""
  public_address=""
}
start_devnode() {
  local preflight_key=""
  ALEO_E2E_LAUNCH_DIR="$(mktemp -d "${REPORT_DIR}/devnode-launch.XXXXXX")"
  : >"${ALEO_E2E_DEVNODE_LOG}"
  pushd "${ALEO_E2E_LAUNCH_DIR}" >/dev/null
  if is_preflight_only; then
    if ! preflight_key="$(generate_preflight_devnode_key)"; then
      die "could not generate an ephemeral local Devnode key"
    fi
    env \
      "NETWORK=${ALEO_E2E_NETWORK}" \
      "ENDPOINT=${ALEO_E2E_ENDPOINT}" \
      "PRIVATE_KEY=${preflight_key}" \
      "${LEO_BIN}" devnode start --socket-addr 127.0.0.1:3030 \
        --storage "${ALEO_E2E_LEDGER}" --clear-storage --manual-block-creation \
        -q >"${ALEO_E2E_DEVNODE_LOG}" 2>&1 &
    DEVNODE_PRIVATE_KEY="${preflight_key}"
    preflight_key=""
  else
    env \
      "NETWORK=${ALEO_E2E_NETWORK}" \
      "ENDPOINT=${ALEO_E2E_ENDPOINT}" \
      "PRIVATE_KEY=${DEVNODE_PRIVATE_KEY}" \
      "${LEO_BIN}" devnode start --socket-addr 127.0.0.1:3030 \
        --storage "${ALEO_E2E_LEDGER}" --clear-storage --manual-block-creation \
        -q >"${ALEO_E2E_DEVNODE_LOG}" 2>&1 &
  fi
  ALEO_E2E_DEVNODE_PID=$!
  popd >/dev/null

  if ! wait_for_http "${ALEO_E2E_ENDPOINT}/testnet/block/height/latest"; then
    if grep -qi "invalid private key" "${ALEO_E2E_DEVNODE_LOG}"; then
      die "Leo rejected the Devnode startup key before readiness. Re-run with the raw 59-character local-only account private key; do not paste an address, View Key, label, or encrypted export"
    fi
    return 1
  fi
  advance_blocks "${MINIMUM_V9_BLOCK_ADVANCE}"
  wait_for_v9_consensus
  record_event "devnode" "ready"
}

read_devnode_consensus_version() {
  local raw_version=""

  raw_version="$(curl --fail --silent --max-time 3 "${ALEO_E2E_ENDPOINT}/testnet/consensus_version")" || return 1
  parse_public_decimal "${raw_version}" "devnode consensus_version"
}

wait_for_v9_consensus() {
  local attempts="${1:-60}"
  local i
  local consensus_version=""

  for ((i = 1; i <= attempts; i++)); do
    consensus_version="$(read_devnode_consensus_version || true)"
    if [[ -n "${consensus_version}" ]] && ((10#${consensus_version} >= 9)); then
      return 0
    fi
    if [[ -n "${ALEO_E2E_DEVNODE_PID:-}" ]] && ! kill -0 "${ALEO_E2E_DEVNODE_PID}" 2>/dev/null; then
      print_sanitized_devnode_log
      die "local Devnode exited before reaching Leo V9 consensus"
    fi
    sleep 1
  done

  print_sanitized_devnode_log
  die "local Devnode did not reach Leo V9 consensus within ${attempts} seconds"
}

assert_owner_has_deployment_balance() {
  require_public_balance "owner-balance" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_BOOTSTRAP_MICROCREDITS}" \
    || die "local Devnode owner lacks deployment and bootstrap Credits. Use the matching local-only funded Devnode identity. Do not use a Wallet or Testnet account"
  printf '[owner-balance] state confirmation: passed\n'
  record_event "owner-balance-state" "passed"
}

check_bootstrap_whitehat_state() {
  local owner_balance=""
  local whitehat_balance=""
  local expected_whitehat=""

  owner_balance="$(public_credits_balance "${OWNER_ADDRESS}" 2>/dev/null || true)"
  whitehat_balance="$(public_credits_balance "${WHITEHAT_ADDRESS}" 2>/dev/null || true)"
  [[ "${owner_balance}" =~ ^[0-9]+$ && "${whitehat_balance}" =~ ^[0-9]+$ ]] || return 1
  expected_whitehat=$((10#${BOOTSTRAP_WHITEHAT_BALANCE_BEFORE} + BOOTSTRAP_TRANSFER_MICROCREDITS))
  ((10#${whitehat_balance} >= expected_whitehat)) \
    && ((10#${owner_balance} < 10#${BOOTSTRAP_OWNER_BALANCE_BEFORE}))
}

check_bootstrap_arbiter_state() {
  local owner_balance=""
  local arbiter_balance=""
  local expected_arbiter=""

  owner_balance="$(public_credits_balance "${OWNER_ADDRESS}" 2>/dev/null || true)"
  arbiter_balance="$(public_credits_balance "${ARBITER_ADDRESS}" 2>/dev/null || true)"
  [[ "${owner_balance}" =~ ^[0-9]+$ && "${arbiter_balance}" =~ ^[0-9]+$ ]] || return 1
  expected_arbiter=$((10#${BOOTSTRAP_ARBITER_BALANCE_BEFORE} + BOOTSTRAP_TRANSFER_MICROCREDITS))
  ((10#${arbiter_balance} >= expected_arbiter)) \
    && ((10#${owner_balance} < 10#${BOOTSTRAP_OWNER_BALANCE_BEFORE}))
}

bootstrap_account() {
  local label="$1"
  local recipient_address="$2"
  local state_check="$3"
  local tx_variable="$4"
  local fee_id_variable="$5"
  local fee_tx_variable="$6"

  run_leo "${BASELINE_DIR}" "${OWNER_PRIVATE_KEY}" execute credits.aleo::transfer_public \
    "${recipient_address}" "${BOOTSTRAP_TRANSFER_MICROCREDITS}u64" --skip-execute-proof --broadcast --yes
  assert_accepted "${label}" "${tx_variable}" "${fee_id_variable}" "${fee_tx_variable}" \
    "${state_check}" "${OWNER_ADDRESS}" "${recipient_address}"
}

bootstrap_test_accounts() {
  local owner_balance_after=""
  local whitehat_balance_after=""
  local arbiter_balance_after=""

  [[ "${ALEO_E2E_BOOTSTRAP_COMPLETE}" == "0" ]] \
    || die "account bootstrap may not reuse a prior local Devnode ledger"

  BOOTSTRAP_OWNER_BALANCE_BEFORE="$(public_credits_balance "${OWNER_ADDRESS}")" \
    || die "could not read the local Devnode owner balance before bootstrap"
  BOOTSTRAP_WHITEHAT_BALANCE_BEFORE="$(public_credits_balance "${WHITEHAT_ADDRESS}")" \
    || die "could not read the local Devnode Whitehat balance before bootstrap"
  BOOTSTRAP_ARBITER_BALANCE_BEFORE="$(public_credits_balance "${ARBITER_ADDRESS}")" \
    || die "could not read the local Devnode Arbiter balance before bootstrap"

  ((10#${BOOTSTRAP_OWNER_BALANCE_BEFORE} >= MINIMUM_OWNER_BOOTSTRAP_MICROCREDITS)) \
    || die "local Devnode owner lacks Credits for bootstrap"

  bootstrap_account "bootstrap-whitehat" "${WHITEHAT_ADDRESS}" check_bootstrap_whitehat_state \
    BOOTSTRAP_WHITEHAT_TX_ID BOOTSTRAP_WHITEHAT_FEE_ID BOOTSTRAP_WHITEHAT_FEE_TX_ID
  bootstrap_account "bootstrap-arbiter" "${ARBITER_ADDRESS}" check_bootstrap_arbiter_state \
    BOOTSTRAP_ARBITER_TX_ID BOOTSTRAP_ARBITER_FEE_ID BOOTSTRAP_ARBITER_FEE_TX_ID

  owner_balance_after="$(public_credits_balance "${OWNER_ADDRESS}")"
  whitehat_balance_after="$(public_credits_balance "${WHITEHAT_ADDRESS}")"
  arbiter_balance_after="$(public_credits_balance "${ARBITER_ADDRESS}")"
  printf '[bootstrap] public balances: owner=%s whitehat=%s arbiter=%s\n' \
    "${owner_balance_after}" "${whitehat_balance_after}" "${arbiter_balance_after}"
  require_public_balance "bootstrap-whitehat" "Whitehat" "${WHITEHAT_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    || die "bootstrap-whitehat: public balance verification failed"
  require_public_balance "bootstrap-arbiter" "Arbiter" "${ARBITER_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    || die "bootstrap-arbiter: public balance verification failed"
  ALEO_E2E_BOOTSTRAP_COMPLETE=1
  record_event "bootstrap-state" "passed"
  record_event "bootstrap-balances" "owner=${owner_balance_after};whitehat=${whitehat_balance_after};arbiter=${arbiter_balance_after}"
}

run_leo() {
  local workspace="$1"
  local actor_key="$2"
  shift 2
  local output
  if ! output="$(cd "${workspace}/leo/bug_proof" && env "NETWORK=${ALEO_E2E_NETWORK}" "ENDPOINT=${ALEO_E2E_ENDPOINT}" "PRIVATE_KEY=${actor_key}" "DEVNET=1" "${LEO_BIN}" "$@" --endpoint "${ALEO_E2E_ENDPOINT}" --network "${ALEO_E2E_NETWORK}" --devnet 2>&1)"; then
    LAST_OUTPUT="${output}"
    LAST_BROADCAST_OUTPUT="${output}"
    print_sanitized_leo_failure
    return 1
  fi
  LAST_OUTPUT="${output}"
  LAST_BROADCAST_OUTPUT="${output}"
}

print_sanitized_leo_failure() {
  printf 'escrow-devnode-e2e: Leo command failed; sanitized CLI output follows:\n' >&2
  print_sanitized_text "${LAST_OUTPUT}"
}

sanitize_cli_output() {
  local private_key_prefix="A""Private""Key"
  local view_key_prefix="A""View""Key"

  sed -E "s/${private_key_prefix}[[:alnum:]_]+/[REDACTED]/g; s/${view_key_prefix}[[:alnum:]_]+/[REDACTED]/g"
}

print_sanitized_text() {
  printf '%s\n' "$1" | sanitize_cli_output >&2
}

extract_execution_transaction_id() {
  local output="$1"
  local ids=""
  local count=""
  local tx_id=""

  ids="$(printf '%s\n' "${output}" | sed -nE "s/^[[:space:]]*-[[:space:]]*transaction ID:[[:space:]]*'([^']+)'[[:space:]]*.*$/\\1/p")"
  count="$(printf '%s\n' "${ids}" | sed '/^$/d' | wc -l | tr -d ' ')"
  [[ "${count}" == "1" ]] || return 1
  tx_id="$(printf '%s\n' "${ids}" | sed -n '1p')"
  [[ "${tx_id}" =~ ^at1[0-9a-z]+$ ]] || return 1
  printf '%s\n' "${tx_id}"
}

extract_fee_id() {
  local output="$1"
  local ids=""
  local count=""
  local fee_id=""

  ids="$(printf '%s\n' "${output}" | sed -nE "s/^[[:space:]]*-[[:space:]]*fee ID:[[:space:]]*'([^']+)'[[:space:]]*.*$/\\1/p")"
  count="$(printf '%s\n' "${ids}" | sed '/^$/d' | wc -l | tr -d ' ')"
  [[ "${count}" == "1" ]] || return 1
  fee_id="$(printf '%s\n' "${ids}" | sed -n '1p')"
  [[ "${fee_id}" =~ ^au1[0-9a-z]+$ ]] || return 1
  printf '%s\n' "${fee_id}"
}

extract_fee_transaction_id() {
  local output="$1"
  local ids=""
  local count=""
  local fee_tx_id=""

  ids="$(printf '%s\n' "${output}" | sed -nE "s/^[[:space:]]*-[[:space:]]*fee transaction ID:[[:space:]]*'([^']+)'[[:space:]]*.*$/\\1/p")"
  count="$(printf '%s\n' "${ids}" | sed '/^$/d' | wc -l | tr -d ' ')"
  [[ "${count}" == "1" ]] || return 1
  fee_tx_id="$(printf '%s\n' "${ids}" | sed -n '1p')"
  [[ "${fee_tx_id}" =~ ^at1[0-9a-z]+$ ]] || return 1
  printf '%s\n' "${fee_tx_id}"
}

store_step_transaction_ids() {
  local label="$1"
  local tx_variable="$2"
  local fee_id_variable="$3"
  local fee_tx_variable="$4"
  local tx_id=""
  local fee_id=""
  local fee_tx_id=""

  if ! tx_id="$(extract_execution_transaction_id "${LAST_BROADCAST_OUTPUT}")"; then
    printf 'escrow-devnode-e2e: [%s] expected exactly one explicit execution transaction ID; sanitized CLI output follows:\n' "${label}" >&2
    print_sanitized_text "${LAST_BROADCAST_OUTPUT}"
    die "${label} did not return a unique execution transaction ID"
  fi
  if ! fee_id="$(extract_fee_id "${LAST_BROADCAST_OUTPUT}")"; then
    printf 'escrow-devnode-e2e: [%s] expected exactly one explicit fee ID; sanitized CLI output follows:\n' "${label}" >&2
    print_sanitized_text "${LAST_BROADCAST_OUTPUT}"
    die "${label} did not return a unique fee ID"
  fi
  if ! fee_tx_id="$(extract_fee_transaction_id "${LAST_BROADCAST_OUTPUT}")"; then
    printf 'escrow-devnode-e2e: [%s] expected exactly one explicit fee transaction ID; sanitized CLI output follows:\n' "${label}" >&2
    print_sanitized_text "${LAST_BROADCAST_OUTPUT}"
    die "${label} did not return a unique fee transaction ID"
  fi

  printf -v "${tx_variable}" '%s' "${tx_id}"
  printf -v "${fee_id_variable}" '%s' "${fee_id}"
  printf -v "${fee_tx_variable}" '%s' "${fee_tx_id}"
  printf '[%s] transaction submitted: %s\n' "${label}" "${tx_id}"
  printf '[%s] fee ID: %s\n' "${label}" "${fee_id}"
  printf '[%s] fee transaction ID: %s\n' "${label}" "${fee_tx_id}"
}

lookup_confirmed_transaction() {
  local tx_id="$1"
  local response_file=""

  response_file="$(mktemp "${REPORT_DIR}/confirmed-transaction.XXXXXX")"
  HTTP_RESPONSE_STATUS="$(curl --silent --max-time 3 \
    --output "${response_file}" --write-out '%{http_code}' \
    "${ALEO_E2E_ENDPOINT}/testnet/transaction/confirmed/${tx_id}" 2>/dev/null || true)"
  HTTP_RESPONSE_BODY="$(cat "${response_file}")"
  rm -f -- "${response_file}"
  HTTP_RESPONSE_STATUS="${HTTP_RESPONSE_STATUS//$'\r'/}"
  [[ "${HTTP_RESPONSE_STATUS}" =~ ^[0-9]{3}$ ]] || HTTP_RESPONSE_STATUS="000"
  [[ -n "${HTTP_RESPONSE_STATUS}" ]] || HTTP_RESPONSE_STATUS="000"
}

transaction_response_matches() {
  local tx_id="$1"
  [[ "${HTTP_RESPONSE_BODY}" == *"${tx_id}"* ]]
}

trim_aleo_value() {
  local raw="${1:-}"

  raw="${raw#"${raw%%[![:space:]]*}"}"
  raw="${raw%"${raw##*[![:space:]]}"}"
  printf '%s' "${raw}"
}

parse_aleo_u64() {
  local raw="${1:-}"
  local source="${2:-unknown}"

  raw="$(trim_aleo_value "${raw}")"
  if [[ "${raw}" =~ ^\"(.*)\"$ ]]; then
    raw="${BASH_REMATCH[1]}"
    raw="$(trim_aleo_value "${raw}")"
  fi

  if [[ "${raw}" =~ ^([0-9]+)u64$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi

  printf '[balance-parser] expected Aleo u64 literal\n' >&2
  printf '[balance-parser] source: %s\n' "${source}" >&2
  printf '[balance-parser] sanitized value type: string\n' >&2
  return 1
}

parse_public_decimal() {
  local raw="${1:-}"
  local source="${2:-unknown}"

  raw="$(trim_aleo_value "${raw}")"
  if [[ "${raw}" =~ ^\"([0-9]+)\"$ ]]; then
    raw="${BASH_REMATCH[1]}"
  fi
  if [[ "${raw}" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "${raw}"
    return 0
  fi

  printf 'escrow-devnode-e2e: expected decimal response from %s\n' "${source}" >&2
  return 1
}

read_mapping_u64() {
  local source="$1"
  local url="$2"
  local response_file=""
  local http_status=""
  local raw_value=""
  local parsed_value=""

  READ_MAPPING_U64_STATUS="ERROR"
  READ_MAPPING_U64_VALUE=""
  response_file="$(mktemp "${REPORT_DIR}/mapping-u64.XXXXXX")" || return 1
  http_status="$(curl --silent --max-time 3 --output "${response_file}" --write-out '%{http_code}' \
    "${url}" 2>/dev/null || true)"
  raw_value="$(cat "${response_file}")"
  rm -f -- "${response_file}"
  http_status="${http_status//$'\r'/}"

  case "${http_status}" in
    200)
      raw_value="$(trim_aleo_value "${raw_value}")"
      if [[ "${raw_value}" == "null" ]]; then
        READ_MAPPING_U64_STATUS="ABSENT"
        return 0
      fi
      parsed_value="$(parse_aleo_u64 "${raw_value}" "${source}")" || return 1
      READ_MAPPING_U64_STATUS="FOUND"
      READ_MAPPING_U64_VALUE="${parsed_value}"
      return 0
      ;;
    404)
      READ_MAPPING_U64_STATUS="ABSENT"
      return 0
      ;;
    *)
      printf '[balance-parser] mapping request failed\n' >&2
      printf '[balance-parser] source: %s\n' "${source}" >&2
      printf '[balance-parser] HTTP status: %s\n' "${http_status:-000}" >&2
      return 1
      ;;
  esac
}

public_credits_balance() {
  local address="$1"

  read_mapping_u64 "credits.aleo/account" \
    "${ALEO_E2E_ENDPOINT}/testnet/program/credits.aleo/mapping/account/${address}" || return 1
  case "${READ_MAPPING_U64_STATUS}" in
    FOUND)
      printf '%s' "${READ_MAPPING_U64_VALUE}"
      ;;
    ABSENT)
      # A missing public Credits account has no balance; callers make this
      # zero conversion only at this explicit business boundary.
      printf '0'
      ;;
    *)
      return 1
      ;;
  esac
}

format_microcredits() {
  local amount="$1"
  local whole=""
  local fraction=""

  [[ "${amount}" =~ ^[0-9]+$ ]] || return 1
  whole=$((10#${amount} / MICROCREDITS_PER_CREDIT))
  fraction=$((10#${amount} % MICROCREDITS_PER_CREDIT))
  printf '%s.%06d' "${whole}" "${fraction}"
}

require_public_balance() {
  local label="$1"
  local role="$2"
  local address="$3"
  local minimum_microcredits="$4"
  local balance=""
  local formatted_balance=""
  local formatted_minimum=""

  balance="$(public_credits_balance "${address}")" || return 1
  formatted_balance="$(format_microcredits "${balance}")" || return 1
  formatted_minimum="$(format_microcredits "${minimum_microcredits}")" || return 1
  printf '[%s] %s public balance: %s microcredits (%s credits)\n' \
    "${label}" "${role}" "${balance}" "${formatted_balance}"
  printf '[%s] required minimum: %s microcredits (%s credits)\n' \
    "${label}" "${minimum_microcredits}" "${formatted_minimum}"

  if ((10#${balance} < 10#${minimum_microcredits})); then
    printf 'escrow-devnode-e2e: [%s] insufficient local public Credits\n' "${label}" >&2
    printf 'address: %s\n' "${address}" >&2
    printf 'balance: %s\n' "${balance}" >&2
    printf 'minimum: %s\n' "${minimum_microcredits}" >&2
    return 1
  fi
}

assert_bootstrap_complete_for_role() {
  local role="$1"

  case "${role}" in
    Whitehat|Arbiter)
      [[ "${ALEO_E2E_BOOTSTRAP_COMPLETE}" == "1" ]] \
        || die "account bootstrap has not completed before ${role} transaction"
      ;;
  esac
}

prepare_role_transaction() {
  local label="$1"
  local role="$2"
  local address="$3"
  local minimum_microcredits="$4"

  assert_bootstrap_complete_for_role "${role}"
  require_public_balance "${label}" "${role}" "${address}" "${minimum_microcredits}" \
    || die "${label}: insufficient local public Credits"
}

print_transaction_diagnostics() {
  local label="$1"
  local tx_id="$2"
  local sender_address="${3:-}"
  local target_address="${4:-}"
  local height=""
  local sender_balance=""
  local target_balance=""
  local program_status=""

  printf '[%s] Devnode diagnostics for %s:\n' "${label}" "${tx_id}" >&2
  height="$(current_height 2>/dev/null || true)"
  printf '  block height: %s\n' "${height:-unavailable}" >&2
  if [[ -n "${sender_address}" ]]; then
    sender_balance="$(public_credits_balance "${sender_address}" 2>/dev/null || true)"
    printf '  sender public Credits: %s\n' "${sender_balance:-unavailable}" >&2
  fi
  if [[ -n "${target_address}" ]]; then
    target_balance="$(public_credits_balance "${target_address}" 2>/dev/null || true)"
    printf '  target public Credits: %s\n' "${target_balance:-unavailable}" >&2
  fi
  if [[ "${label}" == bootstrap-* ]]; then
    printf '  program endpoint: deferred (Bootstrap does not deploy a program)\n' >&2
  else
    program_status="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 3 "${ALEO_E2E_ENDPOINT}/testnet/program/${PROGRAM_ID}" || true)"
    printf '  program endpoint: HTTP %s\n' "${program_status:-000}" >&2
  fi
  print_sanitized_devnode_log
}

report_fee_transaction_lookup() {
  local label="$1"
  local fee_tx_id="$2"

  [[ -n "${fee_tx_id}" ]] || return 0
  lookup_confirmed_transaction "${fee_tx_id}"
  printf '[%s] fee transaction lookup: HTTP %s\n' "${label}" "${HTTP_RESPONSE_STATUS}" >&2
  if [[ "${HTTP_RESPONSE_STATUS}" == "200" && "${HTTP_RESPONSE_BODY,,}" == *rejected* ]]; then
    printf '[%s] fee transaction lookup indicates rejection\n' "${label}" >&2
  fi
  if [[ "${HTTP_RESPONSE_STATUS}" == "500" ]]; then
    printf '[%s] fee transaction lookup response body:\n' "${label}" >&2
    print_sanitized_text "${HTTP_RESPONSE_BODY}"
  fi
}

wait_for_condition() {
  local label="$1"
  local attempts="$2"
  local check_function="$3"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if "${check_function}"; then
      return 0
    fi
    sleep 1
  done
  printf 'escrow-devnode-e2e: timed out waiting for %s\n' "${label}" >&2
  return 1
}

wait_for_step_confirmation() {
  local label="$1"
  local tx_id="$2"
  local fee_tx_id="$3"
  local state_check="$4"
  local sender_address="${5:-}"
  local target_address="${6:-}"
  local i
  local consecutive_server_errors=0
  local printed_404=0
  local printed_500=0

  printf '[%s] waiting for transaction %s\n' "${label}" "${tx_id}"
  for ((i = 1; i <= TRANSACTION_WAIT_ATTEMPTS; i++)); do
    if [[ -n "${state_check}" ]] && "${state_check}"; then
      printf '[%s] state confirmation: passed\n' "${label}"
      if ((consecutive_server_errors > 0)); then
        record_event "${label}-transaction-lookup" "unavailable_500"
      fi
      record_event "${label}-state" "passed"
      return 0
    fi

    if ((i % 10 == 0)); then
      printf '[%s] waiting for expected public state (%s/%s)\n' "${label}" "${i}" "${TRANSACTION_WAIT_ATTEMPTS}"
    fi

    lookup_confirmed_transaction "${tx_id}"
    case "${HTTP_RESPONSE_STATUS}" in
      200)
        if transaction_response_matches "${tx_id}"; then
          printf '[%s] transaction lookup: confirmed\n' "${label}"
          return 0
        fi
        printf '[%s] transaction lookup returned HTTP 200 with a mismatched transaction ID\n' "${label}" >&2
        print_sanitized_text "${HTTP_RESPONSE_BODY}"
        print_transaction_diagnostics "${label}" "${tx_id}" "${sender_address}" "${target_address}"
        return 1
        ;;
      404)
        consecutive_server_errors=0
        if [[ "${printed_404}" == "0" ]]; then
          printf '[%s] transaction not confirmed yet; checking expected state\n' "${label}"
          printed_404=1
        fi
        ;;
      500)
        consecutive_server_errors=$((consecutive_server_errors + 1))
        printf '[%s] confirmed lookup returned HTTP 500 (attempt %s/%s)\n' "${label}" "${consecutive_server_errors}" "${TRANSACTION_500_ATTEMPTS}" >&2
        if [[ "${printed_500}" == "0" ]]; then
          printf '[%s] confirmed lookup response body:\n' "${label}" >&2
          print_sanitized_text "${HTTP_RESPONSE_BODY}"
          print_transaction_diagnostics "${label}" "${tx_id}" "${sender_address}" "${target_address}"
          printed_500=1
        fi
        if ((consecutive_server_errors >= TRANSACTION_500_ATTEMPTS)); then
          printf '[%s] transaction lookup: unavailable_500\n' "${label}" >&2
          report_fee_transaction_lookup "${label}" "${fee_tx_id}"
          return 1
        fi
        ;;
      *)
        printf '[%s] confirmed lookup returned HTTP %s\n' "${label}" "${HTTP_RESPONSE_STATUS}" >&2
        print_sanitized_text "${HTTP_RESPONSE_BODY}"
        print_transaction_diagnostics "${label}" "${tx_id}" "${sender_address}" "${target_address}"
        report_fee_transaction_lookup "${label}" "${fee_tx_id}"
        return 1
        ;;
    esac
    sleep 1
  done

  printf 'escrow-devnode-e2e: [%s] timed out waiting for transaction %s\n' "${label}" "${tx_id}" >&2
  print_transaction_diagnostics "${label}" "${tx_id}" "${sender_address}" "${target_address}"
  report_fee_transaction_lookup "${label}" "${fee_tx_id}"
  return 1
}

advance_broadcast_block() {
  local label="$1"
  local height_before=""
  local height_after=""

  height_before="$(current_height)" || die "${label}: could not read local Devnode height before block advancement"
  printf '[%s] advancing one local Devnode block for the broadcast\n' "${label}"
  advance_blocks 1
  height_after="$(current_height)" || die "${label}: could not read local Devnode height after block advancement"
  record_event "${label}-block" "${height_before}->${height_after}"
}

assert_accepted() {
  local label="$1"
  local tx_variable="$2"
  local fee_id_variable="$3"
  local fee_tx_variable="$4"
  local state_check="${5:-}"
  local sender_address="${6:-}"
  local target_address="${7:-}"
  local tx_id=""
  local fee_tx_id=""

  store_step_transaction_ids "${label}" "${tx_variable}" "${fee_id_variable}" "${fee_tx_variable}"
  tx_id="${!tx_variable}"
  fee_tx_id="${!fee_tx_variable}"
  advance_broadcast_block "${label}"
  wait_for_step_confirmation "${label}" "${tx_id}" "${fee_tx_id}" "${state_check}" "${sender_address}" "${target_address}" \
    || die "${label} was not confirmed by transaction lookup or expected state"
  record_event "${label}" "${tx_id}"
}

wait_for_rejected_transaction() {
  local label="$1"
  local tx_id="$2"
  local i
  local consecutive_server_errors=0

  printf '[%s] waiting for expected rejection of %s\n' "${label}" "${tx_id}"
  for ((i = 1; i <= TRANSACTION_WAIT_ATTEMPTS; i++)); do
    lookup_confirmed_transaction "${tx_id}"
    case "${HTTP_RESPONSE_STATUS}" in
      200)
        if [[ "${HTTP_RESPONSE_BODY,,}" == *rejected* ]]; then
          return 0
        fi
        return 1
        ;;
      404) consecutive_server_errors=0 ;;
      500)
        consecutive_server_errors=$((consecutive_server_errors + 1))
        if ((consecutive_server_errors >= TRANSACTION_500_ATTEMPTS)); then
          printf '[%s] rejection lookup: unavailable_500\n' "${label}" >&2
          print_sanitized_text "${HTTP_RESPONSE_BODY}"
          print_sanitized_devnode_log
          return 1
        fi
        ;;
      *) return 1 ;;
    esac
    sleep 1
  done
  return 1
}

expect_leo_execution_failure() {
  local label="$1"
  local expected_first="$2"
  local expected_second="$3"
  local expected_third="$4"
  local workspace="$5"
  local actor_key="$6"
  local actor_role="$7"
  local actor_address="$8"
  local minimum_microcredits="$9"
  local exit_code=""
  local sanitized_output=""
  local expected=""
  shift 9

  prepare_role_transaction "${label}" "${actor_role}" "${actor_address}" "${minimum_microcredits}"
  set +e
  run_leo "${workspace}" "${actor_key}" "$@"
  exit_code=$?
  set -e

  sanitized_output="$(printf '%s\n' "${LAST_OUTPUT}" | sanitize_cli_output)"
  ((exit_code != 0)) || die "${label}: expected Leo execution to fail before broadcasting"
  for expected in "${expected_first}" "${expected_second}" "${expected_third}"; do
    printf '%s\n' "${sanitized_output}" | grep -Fq "${expected}" \
      || die "${label}: expected local execution failure output to contain ${expected}"
  done
  if printf '%s\n' "${sanitized_output}" | grep -Eq \
    'Broadcasted transaction|transaction submitted|^[[:space:]]*-[[:space:]]*(fee )?transaction ID:'; then
    die "${label}: local execution failure unexpectedly generated or broadcast a transaction"
  fi

  LAST_BROADCAST_OUTPUT=""
  printf '[%s] expected rejection: passed\n' "${label}"
  printf '[%s] transaction generated: no\n' "${label}"
  printf '[%s] transaction broadcast: no\n' "${label}"
  record_event "${label}" "local_execution_rejection"
}

expect_chain_rejected() {
  local label="$1"
  local tx_variable="$2"
  local fee_id_variable="$3"
  local fee_tx_variable="$4"
  local workspace="$5"
  local actor_key="$6"
  local actor_role="$7"
  local actor_address="$8"
  local minimum_microcredits="$9"
  shift 9
  prepare_role_transaction "${label}" "${actor_role}" "${actor_address}" "${minimum_microcredits}"
  set +e
  run_leo "${workspace}" "${actor_key}" "$@"
  local exit_code=$?
  set -e
  store_step_transaction_ids "${label}" "${tx_variable}" "${fee_id_variable}" "${fee_tx_variable}"
  local tx_id="${!tx_variable}"
  advance_broadcast_block "${label}"
  wait_for_rejected_transaction "${label}" "${tx_id}" \
    || die "${label} rejection was not confirmed (leo exit ${exit_code})"
  record_event "${label}" "rejected:${tx_id}"
}

query_mapping() {
  local mapping="$1"
  local key="$2"
  local value=""

  value="$(curl --fail --silent --max-time 3 \
    "${ALEO_E2E_ENDPOINT}/testnet/program/${PROGRAM_ID}/mapping/${mapping}/${key}")" || return 1
  LAST_OUTPUT="${value}"
  [[ "${LAST_OUTPUT}" != "null" ]]
}

assert_mapping_present() {
  local label="$1"
  local mapping="$2"
  local key="$3"
  query_mapping "${mapping}" "${key}" || die "${label}: mapping query failed"
  [[ -n "${LAST_OUTPUT}" ]] || die "${label}: mapping value missing"
  record_event "${label}" "${mapping}:${key}"
}

capture_mapping() {
  local variable_name="$1"
  local mapping="$2"
  local key="$3"
  local mapping_result=""

  mapping_result="$(curl --fail --silent --max-time 3 \
    "${ALEO_E2E_ENDPOINT}/testnet/program/${PROGRAM_ID}/mapping/${mapping}/${key}")" \
    || die "could not read ${mapping}[${key}]"
  [[ "${mapping_result}" != "null" ]] || die "${mapping}[${key}] is missing"
  printf -v "${variable_name}" '%s' "${mapping_result}"
}

capture_mapping_or_null() {
  local variable_name="$1"
  local mapping="$2"
  local key="$3"
  local mapping_result=""

  mapping_result="$(curl --fail --silent --max-time 3 \
    "${ALEO_E2E_ENDPOINT}/testnet/program/${PROGRAM_ID}/mapping/${mapping}/${key}")" \
    || die "could not read ${mapping}[${key}]"
  printf -v "${variable_name}" '%s' "${mapping_result}"
}

assert_mapping_absent() {
  local label="$1"
  local mapping="$2"
  local key="$3"
  local actual=""

  capture_mapping_or_null actual "${mapping}" "${key}"
  [[ "${actual}" == "null" ]] || die "${label}: ${mapping}[${key}] unexpectedly exists"
  record_event "${label}" "absent"
}

assert_mapping_matches() {
  local label="$1"
  local mapping="$2"
  local key="$3"
  shift 3
  local value=""
  local normalized=""
  local expected=""

  capture_mapping value "${mapping}" "${key}"
  normalized="$(printf '%s' "${value}" | tr -d '[:space:]"{}')"
  for expected in "$@"; do
    [[ "${normalized}" == *"${expected}"* ]] \
      || die "${label}: ${mapping}[${key}] does not contain ${expected}"
  done
  record_event "${label}" "${mapping}:${key}"
}

assert_mapping_unchanged() {
  local label="$1"
  local mapping="$2"
  local key="$3"
  local expected="$4"
  local actual=""

  capture_mapping actual "${mapping}" "${key}"
  [[ "${actual}" == "${expected}" ]] || die "${label}: ${mapping}[${key}] changed"
  record_event "${label}" "unchanged"
}

assert_balance_delta() {
  local label="$1"
  local before="$2"
  local after="$3"
  local expected_delta="$4"
  local actual_delta=""

  [[ "${before}" =~ ^[0-9]+$ && "${after}" =~ ^[0-9]+$ ]] \
    || die "${label}: invalid public Credits balance"
  [[ "${expected_delta}" =~ ^-?[0-9]+$ ]] \
    || die "${label}: invalid expected public Credits delta"
  actual_delta=$((10#${after} - 10#${before}))
  printf '[%s] expected balance delta: %s\n' "${label}" "${expected_delta}"
  printf '[%s] actual balance delta: %s\n' "${label}" "${actual_delta}"
  ((actual_delta == expected_delta)) \
    || die "${label}: expected balance delta ${expected_delta}, got ${actual_delta}"
  record_event "${label}" "${actual_delta}"
}

current_height() {
  local raw_height=""

  raw_height="$(curl -fsS --max-time 3 "${ALEO_E2E_ENDPOINT}/testnet/block/height/latest")" || return 1
  parse_public_decimal "${raw_height}" "devnode block height"
}

advance_blocks() {
  local count="$1"
  local i
  local previous_height="$(current_height)"
  local next_height=""

  for ((i = 1; i <= count; i++)); do
    if ! env "NETWORK=${ALEO_E2E_NETWORK}" "ENDPOINT=${ALEO_E2E_ENDPOINT}" "PRIVATE_KEY=${DEVNODE_PRIVATE_KEY}" \
      "${LEO_BIN}" devnode advance 1 --socket-addr 127.0.0.1:3030 -q >/dev/null; then
      die "local Devnode could not advance block ${i}/${count}"
    fi
    next_height="$(current_height)"
    [[ "${next_height}" =~ ^[0-9]+$ ]] && ((10#${next_height} > 10#${previous_height})) \
      || die "local Devnode did not advance block ${i}/${count}"
    previous_height="${next_height}"
  done
}

patch_local_only_admins() {
  local owner_address="${OWNER_ADDRESS:-}"
  local arbiter_address="${ARBITER_ADDRESS:-}"

  [[ -n "${owner_address}" ]] || die "local owner address is unavailable before source patching"
  [[ -n "${arbiter_address}" ]] || die "local arbiter address is unavailable before source patching"
  node "${ROOT_DIR}/scripts/patch-devnode-admins.mjs" \
    "${BASELINE_DIR}/leo/bug_proof/src/main.leo" \
    "${CANDIDATE_DIR}/leo/bug_proof/src/main.leo" \
    "${owner_address}" \
    "${arbiter_address}"
}

build_program() {
  local workspace="$1"
  local output=""

  if ! output="$(cd "${workspace}/leo/bug_proof" && "${LEO_BIN}" build 2>&1)"; then
    LAST_OUTPUT="${output}"
    print_sanitized_leo_failure
    die "Leo build failed: ${workspace}"
  fi
}

assert_full_e2e_inputs() {
  [[ -n "${OWNER_PRIVATE_KEY:-}" ]] || die "local owner private key is unavailable"
  [[ -n "${OWNER_ADDRESS:-}" ]] || die "local owner address is unavailable"
  [[ -n "${WHITEHAT_PRIVATE_KEY:-}" ]] || die "local Whitehat private key is unavailable"
  [[ -n "${WHITEHAT_ADDRESS:-}" ]] || die "local Whitehat address is unavailable"
  [[ -n "${ARBITER_PRIVATE_KEY:-}" ]] || die "local Arbiter private key is unavailable"
  [[ -n "${ARBITER_ADDRESS:-}" ]] || die "local Arbiter address is unavailable"
}

deploy_baseline() {
  prepare_role_transaction "baseline-deploy" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}"
  run_leo "${BASELINE_DIR}" "${OWNER_PRIVATE_KEY}" deploy --broadcast --yes --skip-deploy-certificate
  assert_accepted "baseline-deploy" BASELINE_DEPLOY_TX_ID BASELINE_DEPLOY_FEE_ID BASELINE_DEPLOY_FEE_TX_ID \
    check_baseline_program_state "${OWNER_ADDRESS}"
}

upgrade_candidate() {
  prepare_role_transaction "candidate-upgrade" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}"
  run_leo "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" upgrade --broadcast --yes --skip-deploy-certificate
  assert_accepted "candidate-upgrade" UPGRADE_TX_ID UPGRADE_FEE_ID UPGRADE_FEE_TX_ID "" "${OWNER_ADDRESS}"
}

execute_accepted() {
  local label="$1"
  local tx_variable="$2"
  local fee_id_variable="$3"
  local fee_tx_variable="$4"
  local workspace="$5"
  local actor_key="$6"
  local actor_role="$7"
  local actor_address="$8"
  local minimum_microcredits="$9"
  shift 9
  prepare_role_transaction "${label}" "${actor_role}" "${actor_address}" "${minimum_microcredits}"
  run_leo "${workspace}" "${actor_key}" execute "$@" --skip-execute-proof --broadcast --yes
  assert_accepted "${label}" "${tx_variable}" "${fee_id_variable}" "${fee_tx_variable}" ""
}

check_baseline_program_state() {
  curl --fail --silent --max-time 3 "${ALEO_E2E_ENDPOINT}/testnet/program/${PROGRAM_ID}" >/dev/null
}

field_from_output() {
  local field_name="$1"
  printf '%s\n' "${LAST_OUTPUT}" | grep -Eo "${field_name}: [0-9]+field" | tail -n 1 | awk '{print $2}'
}

write_public_report() {
  node --input-type=module - "${event_log}" "${REPORT_FILE}" "${PROGRAM_ID}" "${ALEO_E2E_ENDPOINT}" <<'NODE'
import fs from "node:fs";
const [eventsPath, reportPath, programId, endpoint] = process.argv.slice(2);
const events = fs.readFileSync(eventsPath, "utf8").trim().split("\n").filter(Boolean).map((line) => {
  const [name, value] = line.split("\t", 2);
  return { name, value };
});
fs.writeFileSync(reportPath, JSON.stringify({
  kind: "local-devnode-e2e",
  endpoint,
  network: "testnet-devnode",
  programId,
  events,
  privateInputsPersisted: false,
  localKeysPersisted: false,
  testnetBroadcast: false,
}, null, 2) + "\n");
NODE
}

main() {
  assert_local_endpoint
  assert_supported_stage
  require_tool "${LEO_BIN}"
  require_tool curl
  require_tool node
  assert_no_direct_network_mutation
  require_directory "${BASELINE_DIR}/leo/bug_proof"
  require_directory "${CANDIDATE_DIR}/leo/bug_proof"
  assert_worktree_ref "${CANDIDATE_DIR}" "${CANDIDATE_REF}"

  mkdir -p "${REPORT_DIR}"
  rm -f -- "${REPORT_FILE}"
  event_log="$(mktemp "${REPORT_DIR}/devnode-events.XXXXXX")"
  prepare_real_testnet_edition_zero_sources

  if is_preflight_only; then
    OWNER_ADDRESS="${PREFLIGHT_OWNER_ADDRESS}"
    ARBITER_ADDRESS="${PREFLIGHT_ARBITER_ADDRESS}"
    clean_local_ledger
    patch_local_only_admins
    assert_fixture_integrity
    start_devnode
    printf 'Local Devnode preflight passed. No user-provided accounts, deployments, or transactions were used.\n'
    return 0
  fi

  provision_local_accounts

  clean_local_ledger
  start_devnode
  assert_owner_has_deployment_balance
  bootstrap_test_accounts

  if is_bootstrap_stage; then
    write_public_report
    printf 'Local Devnode bootstrap passed. No program deployment, upgrade, or Escrow transition was run.\n'
    return 0
  fi

  patch_local_only_admins
  build_program "${BASELINE_DIR}"
  verify_testnet_edition_zero_interface "${BASELINE_DIR}" "baseline-local-admin" "local-address"
  build_program "${CANDIDATE_DIR}"
  verify_testnet_edition_zero_interface "${CANDIDATE_DIR}" "candidate-local-admin" "local-address"
  assert_fixture_integrity
  deploy_baseline

  local height deadline_v1 bounty_v1 scope_v1
  height="$(current_height)"
  deadline_v1="$((height + 200))u32"
  bounty_v1="$(date +%s%N)field"
  scope_v1="$(( $(date +%s%N) + 1 ))field"
  execute_accepted "v1-create-bounty" V1_CREATE_BOUNTY_TX_ID V1_CREATE_BOUNTY_FEE_ID V1_CREATE_BOUNTY_FEE_TX_ID "${BASELINE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" create_bounty "${bounty_v1}" "${scope_v1}" 1field 300u64 200u64 100u64 0u64 "${deadline_v1}"
  execute_accepted "v1-submit-claim" V1_SUBMIT_CLAIM_TX_ID V1_SUBMIT_CLAIM_FEE_ID V1_SUBMIT_CLAIM_FEE_TX_ID "${BASELINE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" submit_claim "${bounty_v1}" "${scope_v1}" 1field 1000u64 1000u64 100u64 0u64 1000u64 1000u64 0u64 200u64 800u64 0u64 0u64 0u64 "$(( $(date +%s%N) + 2 ))field"
  local v1_claim_hash v1_nullifier
  v1_claim_hash="$(field_from_output claim_hash)"
  v1_nullifier="$(field_from_output nullifier)"
  [[ -n "${v1_claim_hash}" && -n "${v1_nullifier}" ]] || die "could not derive public v1 claim identifiers"
  assert_mapping_present "v1_bounty_before_upgrade" bounties "${bounty_v1}"
  assert_mapping_present "v1_nullifier_before_upgrade" nullifiers "${v1_nullifier}"
  assert_mapping_present "v1_receipt_before_upgrade" claim_receipts "${v1_claim_hash}"

  build_program "${CANDIDATE_DIR}"
  upgrade_candidate
  assert_mapping_present "v1_bounty_after_upgrade" bounties "${bounty_v1}"
  assert_mapping_present "v1_nullifier_after_upgrade" nullifiers "${v1_nullifier}"
  assert_mapping_present "v1_receipt_after_upgrade" claim_receipts "${v1_claim_hash}"

  # Legacy economic entries are deliberately fail-closed in the candidate.
  # The contradictory transition guard fails while Leo evaluates the stack, so
  # no execution transaction exists to parse, broadcast, or confirm.
  local legacy_funding_marker=""
  local owner_balance_before_v1_fund="" owner_balance_after_v1_fund=""
  local program_balance_before_v1_fund="" program_balance_after_v1_fund=""
  local v1_bounty_before_legacy_fund="" v1_nullifier_before_legacy_fund=""
  local v1_receipt_before_legacy_fund=""
  legacy_funding_marker="$(( $(date +%s%N) + 3 ))field"
  owner_balance_before_v1_fund="$(public_credits_balance "${OWNER_ADDRESS}")" \
    || die "could not read Owner public Credits before legacy funding"
  program_balance_before_v1_fund="$(public_credits_balance "${PROGRAM_ID}")" \
    || die "could not read Program public Credits before legacy funding"
  capture_mapping v1_bounty_before_legacy_fund bounties "${bounty_v1}"
  capture_mapping v1_nullifier_before_legacy_fund nullifiers "${v1_nullifier}"
  capture_mapping v1_receipt_before_legacy_fund claim_receipts "${v1_claim_hash}"
  assert_mapping_absent "fund-v1-before-escrow" bounty_escrows "${bounty_v1}"
  assert_mapping_absent "fund-v1-before-protocol-version" bounty_protocol_versions "${bounty_v1}"
  assert_mapping_absent "fund-v1-before-payout" claim_payouts "${v1_claim_hash}"
  assert_mapping_absent "fund-v1-before-triage" claim_triage_states "${v1_claim_hash}"
  assert_mapping_absent "fund-v1-before-operation-marker" escrow_operation_markers "${legacy_funding_marker}"

  expect_leo_execution_failure "fund-v1-bounty" "Stack evaluation failed" "assert.eq" "failed" \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" execute fund_bounty "${bounty_v1}" 100u64 \
    "${legacy_funding_marker}" --skip-execute-proof --broadcast --yes

  owner_balance_after_v1_fund="$(public_credits_balance "${OWNER_ADDRESS}")" \
    || die "could not read Owner public Credits after legacy funding"
  program_balance_after_v1_fund="$(public_credits_balance "${PROGRAM_ID}")" \
    || die "could not read Program public Credits after legacy funding"
  assert_balance_delta "fund-v1-owner-balance" "${owner_balance_before_v1_fund}" \
    "${owner_balance_after_v1_fund}" 0
  assert_balance_delta "fund-v1-program-balance" "${program_balance_before_v1_fund}" \
    "${program_balance_after_v1_fund}" 0
  assert_mapping_unchanged "fund-v1-bounty-state" bounties "${bounty_v1}" \
    "${v1_bounty_before_legacy_fund}"
  assert_mapping_unchanged "fund-v1-nullifier-state" nullifiers "${v1_nullifier}" \
    "${v1_nullifier_before_legacy_fund}"
  assert_mapping_unchanged "fund-v1-receipt-state" claim_receipts "${v1_claim_hash}" \
    "${v1_receipt_before_legacy_fund}"
  assert_mapping_absent "fund-v1-no-v2-escrow" bounty_escrows "${bounty_v1}"
  assert_mapping_absent "fund-v1-no-v2-protocol-version" bounty_protocol_versions "${bounty_v1}"
  assert_mapping_absent "fund-v1-no-v2-payout" claim_payouts "${v1_claim_hash}"
  assert_mapping_absent "fund-v1-no-v2-triage" claim_triage_states "${v1_claim_hash}"
  assert_mapping_absent "fund-v1-no-operation-marker" escrow_operation_markers "${legacy_funding_marker}"
  printf '[fund-v1-bounty] Owner balance unchanged: passed\n'
  printf '[fund-v1-bounty] Program balance unchanged: passed\n'
  printf '[fund-v1-bounty] mappings unchanged: passed\n'
  printf '[fund-v1-bounty] legacy funding disabled: passed\n'

  expect_leo_execution_failure "lock-v1-claim" "Stack evaluation failed" "assert.eq" "failed" \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" execute lock_reward "${bounty_v1}" "${v1_claim_hash}" \
    "${WHITEHAT_ADDRESS}" 300u64 --skip-execute-proof --broadcast --yes
  expect_leo_execution_failure "refund-v1-bounty" "Stack evaluation failed" "assert.eq" "failed" \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" execute refund_bounty "${bounty_v1}" 100u64 \
    "$(( $(date +%s%N) + 5 ))field" --skip-execute-proof --broadcast --yes

  local STEP_TX_ID="" STEP_FEE_ID="" STEP_FEE_TX_ID=""
  local deadline_height_v2="" deadline_v2="" bounty_v2="" scope_v2=""
  local claim_hash_paid="" claim_hash_rejected=""
  local funding_marker="" lock_marker_paid="" request_marker="" share_marker=""
  local patch_marker="" release_marker="" lock_marker_rejected="" rejection_marker=""
  local refund_marker="" package_hash=""
  local program_balance_before_fund="" program_balance_after_fund=""
  local program_balance_before_release="" program_balance_after_release=""
  local program_balance_before_refund="" program_balance_after_refund=""
  local program_balance_after_refund_replay=""
  local whitehat_balance_before_release="" whitehat_balance_after_release=""
  local funded_escrow="" locked_payout="" locked_escrow=""
  local paid_payout="" paid_escrow="" rejected_payout="" rejected_escrow=""
  local closed_bounty="" refunded_escrow="" current_block="" blocks_to_advance=""

  height="$(current_height)"
  deadline_height_v2=$((10#${height} + 100))
  deadline_v2="${deadline_height_v2}u32"
  bounty_v2="$(( $(date +%s%N) + 101 ))field"
  scope_v2="$(( $(date +%s%N) + 102 ))field"
  funding_marker="$(( $(date +%s%N) + 103 ))field"
  lock_marker_paid="$(( $(date +%s%N) + 104 ))field"
  request_marker="$(( $(date +%s%N) + 105 ))field"
  share_marker="$(( $(date +%s%N) + 106 ))field"
  patch_marker="$(( $(date +%s%N) + 107 ))field"
  release_marker="$(( $(date +%s%N) + 108 ))field"
  lock_marker_rejected="$(( $(date +%s%N) + 109 ))field"
  rejection_marker="$(( $(date +%s%N) + 110 ))field"
  refund_marker="$(( $(date +%s%N) + 111 ))field"
  package_hash="$(( $(date +%s%N) + 112 ))field"

  execute_accepted "v2-create-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" create_bounty "${bounty_v2}" "${scope_v2}" \
    1field 3000000u64 2000000u64 1000000u64 0u64 "${deadline_v2}"
  assert_mapping_matches "v2-bounty" bounties "${bounty_v2}" \
    "owner_address:${OWNER_ADDRESS}" "scope_hash:${scope_v2}" "rule_id:1field" \
    "critical_reward:3000000u64" "status:1u8"
  assert_mapping_matches "v2-protocol-version" bounty_protocol_versions "${bounty_v2}" "2u8"
  assert_mapping_matches "v2-initial-claim-count" bounty_claim_counts "${bounty_v2}" "0u64"

  program_balance_before_fund="$(public_credits_balance "${PROGRAM_ID}")" \
    || die "could not read Program public Credits before funding"
  execute_accepted "fund-v2-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" fund_bounty_v2 "${bounty_v2}" 10000000u64 \
    "${funding_marker}"
  program_balance_after_fund="$(public_credits_balance "${PROGRAM_ID}")" \
    || die "could not read Program public Credits after funding"
  assert_balance_delta "v2-funding-credits" "${program_balance_before_fund}" \
    "${program_balance_after_fund}" 10000000
  assert_mapping_matches "v2-funded-escrow" bounty_escrows "${bounty_v2}" \
    "total_funded:10000000u64" "available_balance:10000000u64" \
    "locked_amount:0u64" "status:1u8"
  capture_mapping funded_escrow bounty_escrows "${bounty_v2}"

  expect_chain_rejected "v2-fund-replay" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" execute fund_bounty_v2 "${bounty_v2}" \
    10000000u64 "${funding_marker}" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v2-fund-replay-state" bounty_escrows "${bounty_v2}" \
    "${funded_escrow}"
  program_balance_before_release="$(public_credits_balance "${PROGRAM_ID}")"
  assert_balance_delta "v2-fund-replay-credits" "${program_balance_after_fund}" \
    "${program_balance_before_release}" 0

  execute_accepted "v2-submit-paid-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" \
    "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" submit_claim_v2 "${bounty_v2}" \
    "${scope_v2}" 1field 1000u64 1000u64 100u64 0u64 1000u64 1000u64 \
    0u64 200u64 800u64 0u64 0u64 0u64 \
    "$(( $(date +%s%N) + 201 ))field"
  claim_hash_paid="$(field_from_output claim_hash)"
  [[ -n "${claim_hash_paid}" ]] || die "could not derive the paid v2 Claim Hash"
  assert_mapping_matches "v2-paid-receipt" claim_receipts "${claim_hash_paid}" \
    "claim_hash:${claim_hash_paid}" "bounty_id:${bounty_v2}" "severity:3u8" \
    "proof_status:1u8" "protocol_version:2u8"
  assert_mapping_matches "v2-paid-reporter" claim_reporters "${claim_hash_paid}" \
    "${WHITEHAT_ADDRESS}"
  assert_mapping_matches "v2-paid-count-open" bounty_claim_counts "${bounty_v2}" "1u64"

  execute_accepted "v2-lock-paid-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" lock_reward_v2 "${bounty_v2}" \
    "${claim_hash_paid}" "${WHITEHAT_ADDRESS}" 3000000u64 "${lock_marker_paid}"
  assert_mapping_matches "v2-paid-locked-payout" claim_payouts "${claim_hash_paid}" \
    "reward_amount:3000000u64" "status:1u8"
  assert_mapping_matches "v2-paid-locked-triage" claim_triage_states "${claim_hash_paid}" \
    "status:1u8"
  capture_mapping locked_payout claim_payouts "${claim_hash_paid}"
  capture_mapping locked_escrow bounty_escrows "${bounty_v2}"

  expect_chain_rejected "v2-lock-replay" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" execute lock_reward_v2 "${bounty_v2}" \
    "${claim_hash_paid}" "${WHITEHAT_ADDRESS}" 3000000u64 "${lock_marker_paid}" \
    --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v2-lock-replay-payout" claim_payouts "${claim_hash_paid}" \
    "${locked_payout}"
  assert_mapping_unchanged "v2-lock-replay-escrow" bounty_escrows "${bounty_v2}" \
    "${locked_escrow}"

  execute_accepted "v2-request-details" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" request_disclosure "${bounty_v2}" \
    "${claim_hash_paid}" "${request_marker}"
  assert_mapping_matches "v2-details-requested" claim_triage_states "${claim_hash_paid}" \
    "status:2u8"

  execute_accepted "v2-share-details" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" \
    "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" attest_encrypted_details "${bounty_v2}" \
    "${claim_hash_paid}" "${package_hash}" "${share_marker}"
  assert_mapping_matches "v2-details-shared" claim_triage_states "${claim_hash_paid}" \
    "status:3u8" "package_hash:${package_hash}"

  execute_accepted "v2-mark-patched" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" mark_patched "${bounty_v2}" \
    "${claim_hash_paid}" "${patch_marker}"
  assert_mapping_matches "v2-patched" claim_triage_states "${claim_hash_paid}" "status:4u8"

  program_balance_before_release="$(public_credits_balance "${PROGRAM_ID}")"
  whitehat_balance_before_release="$(public_credits_balance "${WHITEHAT_ADDRESS}")"
  execute_accepted "v2-release-reward" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" release_reward_v2 "${bounty_v2}" \
    "${claim_hash_paid}" "${WHITEHAT_ADDRESS}" 3000000u64 "${release_marker}"
  program_balance_after_release="$(public_credits_balance "${PROGRAM_ID}")"
  whitehat_balance_after_release="$(public_credits_balance "${WHITEHAT_ADDRESS}")"
  assert_balance_delta "v2-release-program-credits" "${program_balance_before_release}" \
    "${program_balance_after_release}" -3000000
  assert_balance_delta "v2-release-whitehat-credits" "${whitehat_balance_before_release}" \
    "${whitehat_balance_after_release}" 3000000
  assert_mapping_matches "v2-paid-payout" claim_payouts "${claim_hash_paid}" \
    "status:2u8"
  assert_mapping_matches "v2-paid-triage" claim_triage_states "${claim_hash_paid}" \
    "status:5u8"
  assert_mapping_matches "v2-paid-count-resolved" bounty_claim_counts "${bounty_v2}" "0u64"
  capture_mapping paid_payout claim_payouts "${claim_hash_paid}"
  capture_mapping paid_escrow bounty_escrows "${bounty_v2}"

  expect_chain_rejected "v2-release-replay" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" execute release_reward_v2 "${bounty_v2}" \
    "${claim_hash_paid}" "${WHITEHAT_ADDRESS}" 3000000u64 "${release_marker}" \
    --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v2-release-replay-payout" claim_payouts "${claim_hash_paid}" \
    "${paid_payout}"
  assert_mapping_unchanged "v2-release-replay-escrow" bounty_escrows "${bounty_v2}" \
    "${paid_escrow}"

  execute_accepted "v2-submit-rejected-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" \
    "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" submit_claim_v2 "${bounty_v2}" \
    "${scope_v2}" 1field 1000u64 1000u64 100u64 0u64 1000u64 1000u64 \
    0u64 200u64 800u64 0u64 0u64 0u64 \
    "$(( $(date +%s%N) + 202 ))field"
  claim_hash_rejected="$(field_from_output claim_hash)"
  [[ -n "${claim_hash_rejected}" && "${claim_hash_rejected}" != "${claim_hash_paid}" ]] \
    || die "could not derive a distinct rejected v2 Claim Hash"
  assert_mapping_matches "v2-rejected-receipt" claim_receipts "${claim_hash_rejected}" \
    "protocol_version:2u8" "proof_status:1u8"

  execute_accepted "v2-lock-rejected-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" lock_reward_v2 "${bounty_v2}" \
    "${claim_hash_rejected}" "${WHITEHAT_ADDRESS}" 3000000u64 \
    "${lock_marker_rejected}"
  assert_mapping_matches "v2-reject-count-open" bounty_claim_counts "${bounty_v2}" "1u64"

  expect_chain_rejected "v2-owner-cannot-reject" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" execute reject_claim "${bounty_v2}" \
    "${claim_hash_rejected}" "${rejection_marker}" --skip-execute-proof --broadcast --yes

  execute_accepted "v2-arbiter-reject" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${ARBITER_PRIVATE_KEY}" "Arbiter" "${ARBITER_ADDRESS}" \
    "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" reject_claim "${bounty_v2}" \
    "${claim_hash_rejected}" "${rejection_marker}"
  assert_mapping_matches "v2-rejected-payout" claim_payouts "${claim_hash_rejected}" \
    "status:3u8"
  assert_mapping_matches "v2-rejected-triage" claim_triage_states "${claim_hash_rejected}" \
    "status:6u8"
  assert_mapping_matches "v2-reject-count-resolved" bounty_claim_counts "${bounty_v2}" "0u64"
  capture_mapping rejected_payout claim_payouts "${claim_hash_rejected}"
  capture_mapping rejected_escrow bounty_escrows "${bounty_v2}"

  execute_accepted "v2-close-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" close_bounty "${bounty_v2}"
  assert_mapping_matches "v2-closed-bounty" bounties "${bounty_v2}" "status:3u8"
  capture_mapping closed_bounty bounties "${bounty_v2}"

  current_block="$(current_height)"
  if ((10#${current_block} <= deadline_height_v2)); then
    blocks_to_advance=$((deadline_height_v2 - 10#${current_block} + 1))
    advance_blocks "${blocks_to_advance}"
  fi

  program_balance_before_refund="$(public_credits_balance "${PROGRAM_ID}")"
  execute_accepted "v2-refund-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" refund_bounty_v2 "${bounty_v2}" \
    7000000u64 "${refund_marker}"
  program_balance_after_refund="$(public_credits_balance "${PROGRAM_ID}")"
  assert_balance_delta "v2-refund-program-credits" "${program_balance_before_refund}" \
    "${program_balance_after_refund}" -7000000
  assert_mapping_matches "v2-refunded-escrow" bounty_escrows "${bounty_v2}" \
    "available_balance:0u64" "locked_amount:0u64" "paid_amount:3000000u64" \
    "refunded_amount:7000000u64" "status:3u8"
  capture_mapping refunded_escrow bounty_escrows "${bounty_v2}"

  expect_chain_rejected "v2-refund-replay" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" execute refund_bounty_v2 "${bounty_v2}" \
    7000000u64 "${refund_marker}" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v2-refund-replay-state" bounty_escrows "${bounty_v2}" \
    "${refunded_escrow}"
  program_balance_after_refund_replay="$(public_credits_balance "${PROGRAM_ID}")"
  assert_balance_delta "v2-refund-replay-credits" "${program_balance_after_refund}" \
    "${program_balance_after_refund_replay}" 0
  assert_balance_delta "v2-program-conservation" "${program_balance_before_fund}" \
    "${program_balance_after_refund_replay}" 0
  assert_mapping_unchanged "v2-closed-bounty-preserved" bounties "${bounty_v2}" \
    "${closed_bounty}"
  assert_mapping_unchanged "v2-paid-receipt-preserved" claim_payouts \
    "${claim_hash_paid}" "${paid_payout}"
  assert_mapping_unchanged "v2-rejected-receipt-preserved" claim_payouts \
    "${claim_hash_rejected}" "${rejected_payout}"
  assert_mapping_unchanged "v2-rejected-escrow-accounting" bounty_escrows \
    "${bounty_v2}" "${refunded_escrow}"


  if [[ "${ZKBB_RUN_PROTOCOL_V3:-0}" == "1" ]]; then
    local arbiter_two_key="" arbiter_two_address=""
    local arbiter_three_key="" arbiter_three_address=""
    local v3_height="" v3_deadline_height="" v3_deadline=""
    local v3_bounty="" v3_scope="" v3_claim_award="" v3_claim_reject=""
    local v3_target_system="" v3_target_code="" v3_panel=""
    local v3_binding_award="" v3_binding_reject="" v3_witness_award=""
    local v3_witness_reject="" v3_policy=""
    local v3_program_before_fund="" v3_program_after_refund=""
    local v3_program_before_award="" v3_program_after_award=""
    local v3_whitehat_before_award="" v3_whitehat_after_award=""
    local v3_program_before_rejection="" v3_program_after_rejection=""
    local v3_owner_before_rejection="" v3_owner_after_rejection=""
    local v3_current_block="" v3_blocks_to_advance=""

    generate_ephemeral_local_account arbiter_two_key arbiter_two_address       "ephemeral V3 Arbiter 2"
    generate_ephemeral_local_account arbiter_three_key arbiter_three_address       "ephemeral V3 Arbiter 3"
    [[ "${arbiter_two_address}" != "${ARBITER_ADDRESS}" ]]       || die "V3 Arbiter 2 duplicates Arbiter 1"
    [[ "${arbiter_three_address}" != "${ARBITER_ADDRESS}" &&
       "${arbiter_three_address}" != "${arbiter_two_address}" ]]       || die "V3 Arbiter 3 is not distinct"

    execute_accepted "v3-bootstrap-arbiter-two" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" credits.aleo::transfer_public       "${arbiter_two_address}" 500000000u64
    execute_accepted "v3-bootstrap-arbiter-three" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" credits.aleo::transfer_public       "${arbiter_three_address}" 500000000u64
    require_public_balance "v3-arbiter-two" "Arbiter 2" "${arbiter_two_address}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" ||
      die "V3 Arbiter 2 bootstrap failed"
    require_public_balance "v3-arbiter-three" "Arbiter 3" "${arbiter_three_address}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" ||
      die "V3 Arbiter 3 bootstrap failed"

    v3_height="$(current_height)"
    v3_deadline_height=$((10#${v3_height} + 250))
    v3_deadline="${v3_deadline_height}u32"
    v3_bounty="$(( $(date +%s%N) + 501 ))field"
    v3_scope="$(( $(date +%s%N) + 502 ))field"
    v3_target_system="$(( $(date +%s%N) + 503 ))field"
    v3_target_code="$(( $(date +%s%N) + 504 ))field"
    v3_panel="$(( $(date +%s%N) + 505 ))field"
    v3_policy="{ disclosure_key_commitment: $(( $(date +%s%N) + 506 ))field, target_system_commitment: ${v3_target_system}, target_code_hash: ${v3_target_code}, panel_id: ${v3_panel}, arbiter_one: ${ARBITER_ADDRESS}, arbiter_two: ${arbiter_two_address}, arbiter_three: ${arbiter_three_address}, quorum: 2u8, review_window_blocks: 20u32, decision_window_blocks: 30u32, arbitration_fee_microcredits: 1000000u64, payment_condition: 1u8 }"

    execute_accepted "v3-create-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" create_bounty_v3 "${v3_bounty}"       "${v3_scope}" 1field 3000000u64 2000000u64 1000000u64 0u64       "${v3_deadline}" "${v3_policy}"
    assert_mapping_matches "v3-bounty" bounties "${v3_bounty}"       "owner_address:${OWNER_ADDRESS}" "scope_hash:${v3_scope}" "status:1u8"
    assert_mapping_matches "v3-protocol-version" bounty_protocol_versions       "${v3_bounty}" "3u8"
    assert_mapping_matches "v3-policy" bounty_v3_configs "${v3_bounty}"       "target_system_commitment:${v3_target_system}"       "target_code_hash:${v3_target_code}" "panel_id:${v3_panel}"       "arbiter_one:${ARBITER_ADDRESS}" "arbiter_two:${arbiter_two_address}"       "arbiter_three:${arbiter_three_address}" "quorum:2u8"       "arbitration_fee_microcredits:1000000u64"

    v3_program_before_fund="$(public_credits_balance "${PROGRAM_ID}")"
    execute_accepted "v3-fund-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" fund_bounty_v3 "${v3_bounty}"       10000000u64 "$(( $(date +%s%N) + 507 ))field"
    assert_mapping_matches "v3-funded-escrow" bounty_escrows "${v3_bounty}"       "total_funded:10000000u64" "available_balance:10000000u64"       "locked_amount:0u64"

    v3_binding_award="{ target_system_commitment: ${v3_target_system}, target_state_commitment: $(( $(date +%s%N) + 508 ))field, target_code_hash: ${v3_target_code}, execution_commitment: $(( $(date +%s%N) + 509 ))field, report_commitment: $(( $(date +%s%N) + 510 ))field }"
    v3_witness_award="{ vault_balance_before: 1000u64, total_deposits_before: 1000u64, total_claims_before: 100u64, reserved_rewards_before: 0u64, withdraw_limit_before: 1000u64, user_balance_before: 1000u64, requested_withdraw_before: 0u64, hidden_delta_balance: 200u64, hidden_delta_claims: 800u64, hidden_delta_reserved_rewards: 0u64, hidden_delta_withdraw_amount: 0u64, hidden_delta_user_balance: 0u64, reporter_secret: $(( $(date +%s%N) + 511 ))field }"
    execute_accepted "v3-submit-award-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" submit_claim_v3 "${v3_bounty}"       "${v3_scope}" 1field "${v3_binding_award}" "${v3_witness_award}"
    v3_claim_award="$(field_from_output claim_hash)"
    [[ -n "${v3_claim_award}" ]] || die "could not derive V3 award Claim hash"
    v3_binding_award=""
    v3_witness_award=""
    assert_mapping_matches "v3-award-receipt" claim_receipts "${v3_claim_award}"       "bounty_id:${v3_bounty}" "severity:3u8" "protocol_version:3u8"
    assert_mapping_matches "v3-award-evidence" claim_v3_evidence "${v3_claim_award}"       "target_system_commitment:${v3_target_system}"       "target_code_hash:${v3_target_code}"
    assert_mapping_matches "v3-award-submitted" claim_v3_states "${v3_claim_award}"       "whitehat_address:${WHITEHAT_ADDRESS}" "status:1u8"

    execute_accepted "v3-begin-review" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" review_claim_v3 "${v3_bounty}"       "${v3_claim_award}" 1u8 0u8 "$(( $(date +%s%N) + 512 ))field"       "$(( $(date +%s%N) + 513 ))field"
    assert_mapping_matches "v3-owner-reviewing" claim_v3_states "${v3_claim_award}"       "status:2u8"

    execute_accepted "v3-accept-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" review_claim_v3 "${v3_bounty}"       "${v3_claim_award}" 2u8 3u8 "$(( $(date +%s%N) + 514 ))field"       "$(( $(date +%s%N) + 515 ))field"
    execute_accepted "v3-lock-award" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" lock_reward_v3 "${v3_bounty}"       "${v3_claim_award}" 3000000u64 "$(( $(date +%s%N) + 516 ))field"
    assert_mapping_matches "v3-award-locked" claim_v3_states "${v3_claim_award}"       "status:4u8"
    assert_mapping_matches "v3-award-payout-locked" claim_v3_payouts       "${v3_claim_award}" "reserved_amount:3000000u64" "status:1u8"

    execute_accepted "v3-deliver-disclosure" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" disclosure_action_v3       "${v3_bounty}" "${v3_claim_award}" 1u8       "$(( $(date +%s%N) + 517 ))field" "$(( $(date +%s%N) + 518 ))field"
    execute_accepted "v3-acknowledge-disclosure" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" disclosure_action_v3 "${v3_bounty}"       "${v3_claim_award}" 2u8 "$(( $(date +%s%N) + 519 ))field"       "$(( $(date +%s%N) + 520 ))field"
    assert_mapping_matches "v3-disclosure-acknowledged" claim_v3_states       "${v3_claim_award}" "status:6u8"
    assert_mapping_present "v3-acknowledgement" claim_v3_acknowledgements       "${v3_claim_award}"

    execute_accepted "v3-reproduction-rejected" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" resolution_action_v3 "${v3_bounty}"       "${v3_claim_award}" 2u8 "$(( $(date +%s%N) + 521 ))field"       "$(( $(date +%s%N) + 522 ))field"
    execute_accepted "v3-open-dispute" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" dispute_claim_v3 "${v3_bounty}"       "${v3_claim_award}" 5u8 0u8 "$(( $(date +%s%N) + 523 ))field"       1000000u64 "$(( $(date +%s%N) + 524 ))field"
    assert_mapping_matches "v3-award-disputed" claim_v3_states "${v3_claim_award}"       "status:11u8" "pre_dispute_status:8u8"
    assert_mapping_matches "v3-award-bond" claim_v3_dispute_bonds       "${v3_claim_award}" "payer:${WHITEHAT_ADDRESS}" "amount:1000000u64"       "status:1u8"

    execute_accepted "v3-arbiter-one-high-vote" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" cast_arbitration_vote_v3       "${v3_bounty}" "${v3_claim_award}" 2u8       "$(( $(date +%s%N) + 525 ))field"
    execute_accepted "v3-arbiter-two-high-vote" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${arbiter_two_key}" "Arbiter 2" "${arbiter_two_address}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" cast_arbitration_vote_v3       "${v3_bounty}" "${v3_claim_award}" 2u8       "$(( $(date +%s%N) + 526 ))field"
    assert_mapping_matches "v3-high-quorum" claim_v3_arbitration_tallies       "${v3_claim_award}" "high_votes:2u8"

    v3_program_before_award="$(public_credits_balance "${PROGRAM_ID}")"
    v3_whitehat_before_award="$(public_credits_balance "${WHITEHAT_ADDRESS}")"
    execute_accepted "v3-settle-high-award" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" settle_reward_v3       "${v3_bounty}" "${v3_claim_award}" "${WHITEHAT_ADDRESS}" 2000000u64       1000000u64 2u8 "$(( $(date +%s%N) + 527 ))field"
    v3_program_after_award="$(public_credits_balance "${PROGRAM_ID}")"
    v3_whitehat_after_award="$(public_credits_balance "${WHITEHAT_ADDRESS}")"
    assert_balance_delta "v3-award-program-credits" "${v3_program_before_award}"       "${v3_program_after_award}" -3000000
    assert_balance_delta "v3-award-whitehat-credits" "${v3_whitehat_before_award}"       "${v3_whitehat_after_award}" 3000000
    assert_mapping_matches "v3-award-paid-state" claim_v3_states       "${v3_claim_award}" "status:12u8"
    assert_mapping_matches "v3-award-paid-payout" claim_v3_payouts       "${v3_claim_award}" "reserved_amount:3000000u64"       "paid_amount:2000000u64" "status:2u8"
    assert_mapping_matches "v3-award-bond-settled" claim_v3_dispute_bonds       "${v3_claim_award}" "status:2u8"
    assert_mapping_matches "v3-award-count-resolved" bounty_claim_counts       "${v3_bounty}" "0u64"

    v3_binding_reject="{ target_system_commitment: ${v3_target_system}, target_state_commitment: $(( $(date +%s%N) + 528 ))field, target_code_hash: ${v3_target_code}, execution_commitment: $(( $(date +%s%N) + 529 ))field, report_commitment: $(( $(date +%s%N) + 530 ))field }"
    v3_witness_reject="{ vault_balance_before: 1000u64, total_deposits_before: 1000u64, total_claims_before: 100u64, reserved_rewards_before: 0u64, withdraw_limit_before: 1000u64, user_balance_before: 1000u64, requested_withdraw_before: 0u64, hidden_delta_balance: 200u64, hidden_delta_claims: 800u64, hidden_delta_reserved_rewards: 0u64, hidden_delta_withdraw_amount: 0u64, hidden_delta_user_balance: 0u64, reporter_secret: $(( $(date +%s%N) + 531 ))field }"
    execute_accepted "v3-submit-reject-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" submit_claim_v3 "${v3_bounty}"       "${v3_scope}" 1field "${v3_binding_reject}" "${v3_witness_reject}"
    v3_claim_reject="$(field_from_output claim_hash)"
    [[ -n "${v3_claim_reject}" && "${v3_claim_reject}" != "${v3_claim_award}" ]]       || die "could not derive distinct V3 rejection Claim hash"
    v3_binding_reject=""
    v3_witness_reject=""

    execute_accepted "v3-accept-reject-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" review_claim_v3 "${v3_bounty}"       "${v3_claim_reject}" 2u8 3u8 "$(( $(date +%s%N) + 532 ))field"       "$(( $(date +%s%N) + 533 ))field"
    execute_accepted "v3-lock-reject-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" lock_reward_v3 "${v3_bounty}"       "${v3_claim_reject}" 3000000u64 "$(( $(date +%s%N) + 534 ))field"
    execute_accepted "v3-deliver-reject-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" disclosure_action_v3       "${v3_bounty}" "${v3_claim_reject}" 1u8       "$(( $(date +%s%N) + 535 ))field" "$(( $(date +%s%N) + 536 ))field"
    execute_accepted "v3-ack-reject-claim" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" disclosure_action_v3 "${v3_bounty}"       "${v3_claim_reject}" 2u8 "$(( $(date +%s%N) + 537 ))field"       "$(( $(date +%s%N) + 538 ))field"
    execute_accepted "v3-reject-reproduction-two" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" resolution_action_v3 "${v3_bounty}"       "${v3_claim_reject}" 2u8 "$(( $(date +%s%N) + 539 ))field"       "$(( $(date +%s%N) + 540 ))field"
    execute_accepted "v3-open-rejection-dispute" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" dispute_claim_v3 "${v3_bounty}"       "${v3_claim_reject}" 5u8 0u8 "$(( $(date +%s%N) + 541 ))field"       1000000u64 "$(( $(date +%s%N) + 542 ))field"
    execute_accepted "v3-arbiter-one-reject-vote" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" cast_arbitration_vote_v3       "${v3_bounty}" "${v3_claim_reject}" 0u8       "$(( $(date +%s%N) + 543 ))field"

    expect_chain_rejected "v3-duplicate-arbiter-vote" STEP_TX_ID STEP_FEE_ID       STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${ARBITER_PRIVATE_KEY}" "Arbiter 1"       "${ARBITER_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" execute       cast_arbitration_vote_v3 "${v3_bounty}" "${v3_claim_reject}" 0u8       "$(( $(date +%s%N) + 544 ))field" --skip-execute-proof --broadcast --yes

    execute_accepted "v3-arbiter-two-reject-vote" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${arbiter_two_key}" "Arbiter 2" "${arbiter_two_address}"       "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" cast_arbitration_vote_v3       "${v3_bounty}" "${v3_claim_reject}" 0u8       "$(( $(date +%s%N) + 545 ))field"
    assert_mapping_matches "v3-reject-quorum" claim_v3_arbitration_tallies       "${v3_claim_reject}" "reject_votes:2u8"

    v3_program_before_rejection="$(public_credits_balance "${PROGRAM_ID}")"
    v3_owner_before_rejection="$(public_credits_balance "${OWNER_ADDRESS}")"
    execute_accepted "v3-finalize-rejection" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3"       "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}"       finalize_rejection_v3 "${v3_bounty}" "${v3_claim_reject}"       "${OWNER_ADDRESS}" 1000000u64 0u8 "$(( $(date +%s%N) + 546 ))field"
    v3_program_after_rejection="$(public_credits_balance "${PROGRAM_ID}")"
    v3_owner_after_rejection="$(public_credits_balance "${OWNER_ADDRESS}")"
    assert_balance_delta "v3-reject-program-bond" "${v3_program_before_rejection}"       "${v3_program_after_rejection}" -1000000
    assert_balance_delta "v3-reject-owner-bond" "${v3_owner_before_rejection}"       "${v3_owner_after_rejection}" 1000000
    assert_mapping_matches "v3-rejected-state" claim_v3_states       "${v3_claim_reject}" "status:14u8"
    assert_mapping_matches "v3-rejected-payout" claim_v3_payouts       "${v3_claim_reject}" "status:3u8"
    assert_mapping_matches "v3-rejected-bond" claim_v3_dispute_bonds       "${v3_claim_reject}" "status:2u8"
    assert_mapping_matches "v3-all-claims-resolved" bounty_claim_counts       "${v3_bounty}" "0u64"
    assert_mapping_matches "v3-escrow-after-arbitration" bounty_escrows       "${v3_bounty}" "available_balance:8000000u64"       "locked_amount:0u64" "paid_amount:2000000u64"

    execute_accepted "v3-close-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" close_bounty "${v3_bounty}"
    v3_current_block="$(current_height)"
    if ((10#${v3_current_block} <= v3_deadline_height)); then
      v3_blocks_to_advance=$((v3_deadline_height - 10#${v3_current_block} + 1))
      advance_blocks "${v3_blocks_to_advance}"
    fi
    execute_accepted "v3-refund-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID       "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}"       "${MINIMUM_OWNER_MICROCREDITS}" refund_bounty_v3 "${v3_bounty}"       8000000u64 "$(( $(date +%s%N) + 547 ))field"
    v3_program_after_refund="$(public_credits_balance "${PROGRAM_ID}")"
    assert_balance_delta "v3-program-conservation" "${v3_program_before_fund}"       "${v3_program_after_refund}" 0
    assert_mapping_matches "v3-refunded-escrow" bounty_escrows "${v3_bounty}"       "available_balance:0u64" "locked_amount:0u64"       "paid_amount:2000000u64" "refunded_amount:8000000u64" "status:3u8"

    arbiter_two_key=""
    arbiter_three_key=""
    record_event "protocol-v3-award-flow" "passed"
    record_event "protocol-v3-rejection-flow" "passed"
    record_event "protocol-v3-credits-conservation" "passed"
    printf 'Local Devnode Protocol V3 accepted and rejected arbitration flows passed.\n'
  fi
  record_event "credits-conservation" "passed"
  record_event "status" "COMPLETED"
  write_public_report
  printf 'Local Devnode Escrow v2 E2E passed with Credits conservation and replay protection.\n'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
