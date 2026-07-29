#!/usr/bin/env bash

set -euo pipefail
set +x

# This harness only exercises a disposable localhost Devnode. It never accepts a
# live endpoint, persists a local-only key, or emits private witness inputs.

readonly PROGRAM_ID="zkbugbounty_7f3c92.aleo"
readonly NETWORK="testnet"
readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly BASELINE_DIR="${ZKBB_DEVNODE_BASELINE_DIR:-${ROOT_DIR}/../aleo-devnode-baseline}"
readonly CANDIDATE_DIR="${ZKBB_DEVNODE_CANDIDATE_DIR:-${ROOT_DIR}/../aleo-devnode-candidate}"
readonly LEDGER_DIR="${ZKBB_DEVNODE_LEDGER_DIR:-${ROOT_DIR}/../aleo-devnode-ledger}"
readonly ENDPOINT="${ZKBB_DEVNODE_ENDPOINT:-http://127.0.0.1:3030}"
readonly REPORT_DIR="${ROOT_DIR}/local-e2e-results"
readonly REPORT_FILE="${REPORT_DIR}/escrow-v2-devnode-report.json"

DEVNODE_PID=""
OWNER_KEY=""
WHITEHAT_KEY=""
ARBITER_KEY=""
OWNER_ADDRESS=""
WHITEHAT_ADDRESS=""
ARBITER_ADDRESS=""
LAST_OUTPUT=""
LAST_TX=""

die() {
  printf 'escrow-devnode-e2e: %s\n' "$*" >&2
  exit 1
}

assert_local_endpoint() {
  case "${ENDPOINT}" in
    http://127.0.0.1:3030|http://localhost:3030) ;;
    *) die "refusing non-local endpoint: ${ENDPOINT}" ;;
  esac
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || die "required tool unavailable: $1"
}

require_directory() {
  [[ -d "$1" ]] || die "required directory unavailable: $1"
}

prompt_secret() {
  local variable_name="$1"
  local prompt="$2"
  local value=""
  read -r -s -p "${prompt}: " value
  printf '\n'
  [[ -n "${value}" ]] || die "${prompt} is required"
  printf -v "${variable_name}" '%s' "${value}"
  unset value
}

prompt_address() {
  local variable_name="$1"
  local prompt="$2"
  local value=""
  read -r -p "${prompt}: " value
  [[ "${value}" =~ ^aleo1[0-9a-z]+$ ]] || die "${prompt} is not an Aleo address"
  printf -v "${variable_name}" '%s' "${value}"
  unset value
}

clean_local_ledger() {
  local expected
  expected="$(realpath -m "${ROOT_DIR}/../aleo-devnode-ledger")"
  [[ "$(realpath -m "${LEDGER_DIR}")" == "${expected}" ]] || die "ledger must be the isolated sibling directory"
  rm -rf -- "${expected}"
  mkdir -p "${expected}"
}

restore_test_worktrees() {
  git -C "${BASELINE_DIR}" checkout -- leo/bug_proof/src/main.leo >/dev/null 2>&1 || true
  git -C "${CANDIDATE_DIR}" checkout -- leo/bug_proof/src/main.leo >/dev/null 2>&1 || true
}

cleanup() {
  local code=$?
  if [[ -n "${DEVNODE_PID}" ]] && kill -0 "${DEVNODE_PID}" >/dev/null 2>&1; then
    kill "${DEVNODE_PID}" >/dev/null 2>&1 || true
    wait "${DEVNODE_PID}" >/dev/null 2>&1 || true
  fi
  restore_test_worktrees
  unset PRIVATE_KEY OWNER_KEY WHITEHAT_KEY ARBITER_KEY
  unset OWNER_ADDRESS WHITEHAT_ADDRESS ARBITER_ADDRESS LAST_OUTPUT LAST_TX
  exit "${code}"
}
trap cleanup EXIT INT TERM

event_log=""
record_event() {
  printf '%s\t%s\n' "$1" "$2" >>"${event_log}"
}

start_devnode() {
  PRIVATE_KEY="${OWNER_KEY}" NETWORK="${NETWORK}" \
    leo devnode start --devnet --network "${NETWORK}" \
      --socket-addr 127.0.0.1:3030 --home "${LEDGER_DIR}" -q >/dev/null 2>&1 &
  DEVNODE_PID=$!

  for _ in $(seq 1 30); do
    if curl -fsS --max-time 1 "${ENDPOINT}/testnet/block/height/latest" >/dev/null 2>&1; then
      record_event "devnode" "ready"
      return
    fi
    sleep 1
  done
  die "localhost devnode did not become ready"
}

run_leo() {
  local workspace="$1"
  local actor_key="$2"
  shift 2
  local output
  if ! output="$(cd "${workspace}/leo/bug_proof" && PRIVATE_KEY="${actor_key}" NETWORK="${NETWORK}" ENDPOINT="${ENDPOINT}" DEVNET=1 leo "$@" --endpoint "${ENDPOINT}" --network "${NETWORK}" --devnet 2>&1)"; then
    LAST_OUTPUT="${output}"
    return 1
  fi
  LAST_OUTPUT="${output}"
}

extract_transaction_id() {
  printf '%s' "${LAST_OUTPUT}" | grep -Eo 'at1[0-9a-z]+' | tail -n 1 || true
}

query_transaction() {
  local tx_id="$1"
  run_leo "${CANDIDATE_DIR}" "${OWNER_KEY}" query transaction "${tx_id}" --confirmed
}

assert_accepted() {
  local label="$1"
  LAST_TX="$(extract_transaction_id)"
  [[ -n "${LAST_TX}" ]] || die "${label} did not return a local transaction id"
  for _ in $(seq 1 12); do
    if query_transaction "${LAST_TX}"; then
      if [[ "${LAST_OUTPUT,,}" == *rejected* || "${LAST_OUTPUT,,}" == *aborted* ]]; then
        die "${label} was not accepted"
      fi
      record_event "${label}" "${LAST_TX}"
      return
    fi
    sleep 1
  done
  die "${label} transaction was not queryable"
}

expect_rejected() {
  local label="$1"
  shift
  set +e
  run_leo "$@"
  local exit_code=$?
  set -e
  LAST_TX="$(extract_transaction_id)"
  [[ -n "${LAST_TX}" ]] || die "${label} failed before producing a local transaction; rejection was not proven on Devnode"
  for _ in $(seq 1 12); do
    if query_transaction "${LAST_TX}"; then
      if [[ "${LAST_OUTPUT,,}" == *rejected* ]]; then
        record_event "${label}" "rejected:${LAST_TX}"
        return
      fi
      die "${label} was expected to be rejected"
    fi
    sleep 1
  done
  die "${label} rejection was not queryable (leo exit ${exit_code})"
}

query_mapping() {
  local mapping="$1"
  local key="$2"
  run_leo "${CANDIDATE_DIR}" "${OWNER_KEY}" query program "${PROGRAM_ID}" --mapping-value "${mapping}" "${key}"
}

assert_mapping_present() {
  local label="$1"
  local mapping="$2"
  local key="$3"
  query_mapping "${mapping}" "${key}" || die "${label}: mapping query failed"
  [[ -n "${LAST_OUTPUT}" ]] || die "${label}: mapping value missing"
  record_event "${label}" "${mapping}:${key}"
}

current_height() {
  curl -fsS --max-time 3 "${ENDPOINT}/testnet/block/height/latest" | tr -dc '0-9'
}

advance_blocks() {
  local count="$1"
  PRIVATE_KEY="${OWNER_KEY}" NETWORK="${NETWORK}" leo devnode advance "${count}" \
    --endpoint "${ENDPOINT}" --network "${NETWORK}" --devnet -q >/dev/null
}

patch_local_only_admins() {
  node --input-type=module - "${BASELINE_DIR}/leo/bug_proof/src/main.leo" "${CANDIDATE_DIR}/leo/bug_proof/src/main.leo" "${OWNER_ADDRESS}" "${ARBITER_ADDRESS}" <<'NODE'
import fs from "node:fs";
const [baselineFile, candidateFile, owner, arbiter] = process.argv.slice(2);
const productionAdmin = "aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6";
for (const file of [baselineFile, candidateFile]) {
  let source = fs.readFileSync(file, "utf8");
  source = source.replaceAll(`@admin(address = "${productionAdmin}")`, `@admin(address = "${owner}")`);
  if (file === candidateFile) {
    source = source.replaceAll(`signer,\n                ${productionAdmin}`, `signer,\n                ${arbiter}`);
  }
  if (source.includes(productionAdmin)) throw new Error(`local admin patch incomplete: ${file}`);
  fs.writeFileSync(file, source);
}
NODE
}

build_program() {
  local workspace="$1"
  (cd "${workspace}/leo/bug_proof" && leo build >/dev/null)
}

deploy_baseline() {
  run_leo "${BASELINE_DIR}" "${OWNER_KEY}" deploy --broadcast --yes --skip-deploy-certificate
  assert_accepted "baseline_deployment"
}

upgrade_candidate() {
  run_leo "${CANDIDATE_DIR}" "${OWNER_KEY}" upgrade --broadcast --yes --skip-deploy-certificate
  assert_accepted "candidate_upgrade"
}

execute_accepted() {
  local label="$1"
  local workspace="$2"
  local actor_key="$3"
  shift 3
  run_leo "${workspace}" "${actor_key}" execute "$@" --skip-execute-proof --broadcast --yes
  assert_accepted "${label}"
}

field_from_output() {
  local field_name="$1"
  printf '%s\n' "${LAST_OUTPUT}" | grep -Eo "${field_name}: [0-9]+field" | tail -n 1 | awk '{print $2}'
}

write_public_report() {
  node --input-type=module - "${event_log}" "${REPORT_FILE}" "${PROGRAM_ID}" "${ENDPOINT}" <<'NODE'
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
  require_tool leo
  require_tool curl
  require_tool node
  require_directory "${BASELINE_DIR}/leo/bug_proof"
  require_directory "${CANDIDATE_DIR}/leo/bug_proof"
  [[ "$(git -C "${BASELINE_DIR}" rev-parse HEAD)" == "$(git -C "${ROOT_DIR}" rev-parse pre-escrow-upgrade)" ]] || die "baseline worktree is not pre-escrow-upgrade"
  [[ "$(git -C "${CANDIDATE_DIR}" rev-parse HEAD)" == "$(git -C "${ROOT_DIR}" rev-parse escrow-v2-upgrade-candidate)" ]] || die "candidate worktree is not escrow-v2-upgrade-candidate"

  prompt_secret OWNER_KEY "Local-only Devnode owner private key"
  prompt_address OWNER_ADDRESS "Local-only Devnode owner public address"
  prompt_secret WHITEHAT_KEY "Local-only Whitehat private key"
  prompt_address WHITEHAT_ADDRESS "Local-only Whitehat public address"
  prompt_secret ARBITER_KEY "Local-only Arbiter private key"
  prompt_address ARBITER_ADDRESS "Local-only Arbiter public address"

  mkdir -p "${REPORT_DIR}"
  event_log="$(mktemp "${REPORT_DIR}/devnode-events.XXXXXX")"
  clean_local_ledger
  patch_local_only_admins
  start_devnode
  build_program "${BASELINE_DIR}"
  deploy_baseline

  local height deadline_v1 bounty_v1 scope_v1
  height="$(current_height)"
  deadline_v1="$((height + 200))u32"
  bounty_v1="$(date +%s%N)field"
  scope_v1="$(( $(date +%s%N) + 1 ))field"
  execute_accepted "v1_create_bounty" "${BASELINE_DIR}" "${OWNER_KEY}" create_bounty "${bounty_v1}" "${scope_v1}" 1field 300u64 200u64 100u64 0u64 "${deadline_v1}"
  execute_accepted "v1_submit_claim" "${BASELINE_DIR}" "${WHITEHAT_KEY}" submit_claim "${bounty_v1}" "${scope_v1}" 1field 1000u64 1000u64 100u64 0u64 1000u64 1000u64 0u64 200u64 800u64 0u64 0u64 0u64 "$(( $(date +%s%N) + 2 ))field"
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

  # A v1 receipt cannot satisfy the protocol-v2 guard. This must produce a real
  # rejected Devnode transaction and must not move Credits.
  expect_rejected "fund_v1_bounty" "${CANDIDATE_DIR}" "${OWNER_KEY}" execute fund_bounty "${bounty_v1}" 100u64 "$(( $(date +%s%N) + 3 ))field" --skip-execute-proof --broadcast --yes
  expect_rejected "lock_v1_claim" "${CANDIDATE_DIR}" "${OWNER_KEY}" execute lock_reward "${bounty_v1}" "${v1_claim_hash}" "${WHITEHAT_ADDRESS}" 300u64 "$(( $(date +%s%N) + 4 ))field" --skip-execute-proof --broadcast --yes
  expect_rejected "refund_v1_bounty" "${CANDIDATE_DIR}" "${OWNER_KEY}" execute refund_bounty "${bounty_v1}" 100u64 "$(( $(date +%s%N) + 5 ))field" --skip-execute-proof --broadcast --yes

  # The remainder of the script deliberately stops here until the Devnode
  # command output format is captured once with local-only accounts. Claim hashes
  # are derived by Leo's Poseidon circuit and must be parsed from the confirmed
  # local execution, never reconstructed by a TypeScript mock.
  record_event "status" "BLOCKED_LOCAL_KEY_EXECUTION_REQUIRED"
  write_public_report
  printf 'Local Devnode harness prepared. Provide only local-only accounts in this terminal to continue full Credits E2E.\n'
}

main "$@"
