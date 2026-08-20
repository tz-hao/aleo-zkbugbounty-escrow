#!/usr/bin/env bash
set -euo pipefail
set +x

LEO_BIN="${LEO_BIN:-leo}"
MODE="preview"
if [[ "${1:-}" == "--broadcast" ]]; then
    MODE="broadcast"
elif [[ -n "${1:-}" ]]; then
    printf 'Usage: bash scripts/upgrade-aleo-testnet-v3.sh [--broadcast]\n' >&2
    exit 2
fi

umask 077

EXPECTED_PROGRAM_ID="zkbugbounty_7f3c92.aleo"
EXPECTED_ADMIN_ADDRESS="aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6"
EXPECTED_CURRENT_EDITION="2"
EXPECTED_TARGET_EDITION="3"
NETWORK="testnet"
ENDPOINT="https://api.explorer.provable.com/v1"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
LEO_PROJECT_DIR="${PROJECT_ROOT}/leo/bug_proof"
COMPILED_PROGRAM="${LEO_PROJECT_DIR}/build/zkbugbounty_7f3c92/zkbugbounty_7f3c92.aleo"
ABI_PATH="${LEO_PROJECT_DIR}/build/zkbugbounty_7f3c92/abi.json"
RESULT_DIR="${PROJECT_ROOT}/local-upgrade-results"
TEMP_DIR=""
LEO_UPGRADE_LOG=""

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
        rm -f -- "${TEMP_DIR}/testnet-interface.aleo"
        rm -f -- "${TEMP_DIR}/leo-upgrade.log"
        rmdir -- "${TEMP_DIR}" 2>/dev/null || true
    fi
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command is unavailable: $1"
}

http_status() {
    curl \
        --silent \
        --show-error \
        --location \
        --retry 3 \
        --retry-delay 2 \
        --retry-all-errors \
        --output /dev/null \
        --write-out '%{http_code}' \
        --connect-timeout 10 \
        --max-time 30 \
        "$1"
}

scan_for_private_key_literals() {
    local private_key_pattern
    local path
    local root
    local -a scan_files=()
    local -a suspect_files=()
    local -a scan_roots=(
        "${PROJECT_ROOT}/app"
        "${PROJECT_ROOT}/components"
        "${PROJECT_ROOT}/lib"
        "${PROJECT_ROOT}/scripts"
        "${PROJECT_ROOT}/tests"
        "${LEO_PROJECT_DIR}/src"
        "${LEO_PROJECT_DIR}/scripts"
        "${LEO_PROJECT_DIR}/inputs"
    )

    # Match an actual Aleo private-key-shaped literal, not the harmless
    # `APrivateKey` marker used by client-side redaction code.
    private_key_pattern="A""PrivateKey1[[:alnum:]_]{20,}"
    for root in "${scan_roots[@]}"; do
        if [[ -d "${root}" ]]; then
            while IFS= read -r -d '' path; do
                scan_files+=("${path}")
            done < <(find "${root}" -type f -print0)
        fi
    done
    while IFS= read -r path; do
        suspect_files+=("${path}")
    done < <(grep -I -E -l -- "${private_key_pattern}" "${scan_files[@]}" || true)

    if ((${#suspect_files[@]} > 0)); then
        printf 'ERROR: Potential Aleo private-key literals were found:\n' >&2
        for path in "${suspect_files[@]}"; do
            printf '  %s\n' "${path#"${PROJECT_ROOT}/"}" >&2
        done
        exit 1
    fi
}

read_public_edition() {
    curl \
        --silent \
        --show-error \
        --location \
        --retry 3 \
        --retry-delay 2 \
        --retry-all-errors \
        --connect-timeout 10 \
        --max-time 30 \
        "${ENDPOINT}/${NETWORK}/program/${EXPECTED_PROGRAM_ID}/latest_edition" |
        tr -d '[:space:]"'
}

read_public_credits_balance() {
    curl \
        --silent \
        --show-error \
        --location \
        --retry 3 \
        --retry-delay 2 \
        --retry-all-errors \
        --connect-timeout 10 \
        --max-time 30 \
        "${ENDPOINT}/${NETWORK}/program/credits.aleo/mapping/account/${EXPECTED_ADMIN_ADDRESS}"
}

read_public_program_owner() {
    grep -Eo 'assert\.eq program_owner aleo1[0-9a-z]+' "$1" |
        awk '{print $3}' |
        head -n 1
}

extract_transaction_ids() {
    python3 - "$1" <<'PY'
import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()
transaction_pattern = re.compile(r"\bat1[0-9a-z]{50,80}\b")
fee_pattern = re.compile(r"(?im)^.*\bfee\b.*?(at1[0-9a-z]{50,80})\b")
upgrade_pattern = re.compile(r"(?im)^.*\b(?:upgrade|deployment|transaction)\b.*?(at1[0-9a-z]{50,80})\b")

fee_match = fee_pattern.search(text)
fee = fee_match.group(1) if fee_match else None
upgrade_match = upgrade_pattern.search(text)
upgrade = upgrade_match.group(1) if upgrade_match else None
candidates = transaction_pattern.findall(text)
if upgrade is None and candidates:
    upgrade = next((value for value in candidates if value != fee), candidates[0])
if fee is None:
    fee = next((value for value in candidates if value != upgrade), None)

print(upgrade or "")
print(fee or "")
PY
}

write_public_evidence() {
    local output_path="$1"
    local result_status="$2"
    local upgrade_transaction_id="${3:-}"
    local fee_transaction_id="${4:-}"
    local source_sha="$5"
    local compiled_sha="$6"
    local abi_sha="$7"
    local git_commit="$8"
    local public_admin_address="$9"
    local public_balance_microcredits="${10}"
    local fee_estimate_microcredits="${11}"

    python3 - \
        "${output_path}" \
        "${MODE}" \
        "${result_status}" \
        "${upgrade_transaction_id}" \
        "${fee_transaction_id}" \
        "${source_sha}" \
        "${compiled_sha}" \
        "${abi_sha}" \
        "${git_commit}" \
        "${public_admin_address}" \
        "${public_balance_microcredits}" \
        "${fee_estimate_microcredits}" <<'PY'
import datetime
import json
import sys

(
    output_path,
    mode,
    status,
    upgrade_transaction_id,
    fee_transaction_id,
    source_sha,
    compiled_sha,
    abi_sha,
    git_commit,
    public_admin_address,
    public_balance_microcredits,
    fee_estimate_microcredits,
) = sys.argv[1:]

evidence = {
    "schema": "zkbugbounty.testnet-upgrade-evidence.v1",
    "recorded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "network": "testnet",
    "program_id": "zkbugbounty_7f3c92.aleo",
    "previous_edition": 2,
    "target_edition": 3,
    "mode": mode,
    "status": status,
    "upgrade_transaction_id": upgrade_transaction_id or None,
    "fee_transaction_id": fee_transaction_id or None,
    "source_sha256": source_sha,
    "compiled_program_sha256": compiled_sha,
    "abi_sha256": abi_sha,
    "git_commit": git_commit or None,
    "public_administrator_address": public_admin_address,
    "public_balance_microcredits": None if public_balance_microcredits == "UNAVAILABLE" else public_balance_microcredits,
    "fee_estimate_microcredits": None if fee_estimate_microcredits == "UNAVAILABLE" else fee_estimate_microcredits,
    "contains_signed_payload": False,
    "contains_private_key": False,
}
with open(output_path, "w", encoding="utf-8") as target:
    json.dump(evidence, target, ensure_ascii=False, indent=2)
    target.write("\n")
PY
}

[[ "$(pwd -P)" == "${PROJECT_ROOT}" ]] ||
    fail "Run this script from the project root: ${PROJECT_ROOT}"
[[ -f "${LEO_PROJECT_DIR}/program.json" ]] || fail "Canonical Leo program.json is missing."
[[ -f "${LEO_PROJECT_DIR}/src/main.leo" ]] || fail "Canonical Leo source is missing."

require_command "${LEO_BIN}"
require_command curl
require_command python3
require_command grep
require_command find
require_command sha256sum
require_command git
require_command mktemp
require_command node

LEO_VERSION="$("${LEO_BIN}" --version)"
[[ "${LEO_VERSION}" == "leo 4.4.0"* ]] ||
    fail "Leo 4.4.0 is required; found: ${LEO_VERSION}"
printf 'Leo CLI: %s\n' "${LEO_VERSION}"

scan_for_private_key_literals
printf 'Private-key project scan: clear\n'

PROGRAM_STATUS="$(http_status "${ENDPOINT}/${NETWORK}/program/${EXPECTED_PROGRAM_ID}")" ||
    fail "Unable to query the Testnet Program endpoint."
[[ "${PROGRAM_STATUS}" == "200" ]] ||
    fail "Expected the existing Program to return HTTP 200; received ${PROGRAM_STATUS}."

CURRENT_EDITION="$(read_public_edition)" ||
    fail "Unable to read the current Testnet Program edition."
[[ "${CURRENT_EDITION}" == "${EXPECTED_CURRENT_EDITION}" ]] ||
    fail "Expected Testnet Edition ${EXPECTED_CURRENT_EDITION}; observed ${CURRENT_EDITION}. Stop and verify public state before continuing."
printf 'Current Testnet edition: %s\n' "${CURRENT_EDITION}"

(
    cd "${LEO_PROJECT_DIR}"
    "${LEO_BIN}" clean
    "${LEO_BIN}" build
)

[[ -f "${COMPILED_PROGRAM}" ]] || fail "Compiled Program was not produced."
[[ -f "${ABI_PATH}" ]] || fail "ABI was not produced."

TEMP_DIR="$(mktemp -d)"
TESTNET_INTERFACE_BASELINE="${TEMP_DIR}/testnet-interface.aleo"
if ! "${LEO_BIN}" query program "${EXPECTED_PROGRAM_ID}" \
    --edition "${CURRENT_EDITION}" \
    --network "${NETWORK}" \
    --endpoint "${ENDPOINT}" >"${TESTNET_INTERFACE_BASELINE}"; then
    fail "Unable to read the current Testnet Program interface."
fi

PUBLIC_ADMIN_ADDRESS="$(read_public_program_owner "${TESTNET_INTERFACE_BASELINE}")"
[[ -n "${PUBLIC_ADMIN_ADDRESS}" ]] ||
    fail "Unable to read the public Program administrator address."
[[ "${PUBLIC_ADMIN_ADDRESS}" == "${EXPECTED_ADMIN_ADDRESS}" ]] ||
    fail "Public Program administrator does not match the expected administrator address."
printf 'Public administrator address: %s\n' "${PUBLIC_ADMIN_ADDRESS}"

node --experimental-strip-types \
    "${PROJECT_ROOT}/scripts/check-aleo-upgrade-interface.mjs" \
    "${TESTNET_INTERFACE_BASELINE}" \
    "${COMPILED_PROGRAM}" ||
    fail "Compiled Program changes a preserved Testnet interface."

grep -F -q "program ${EXPECTED_PROGRAM_ID};" "${COMPILED_PROGRAM}" ||
    fail "Compiled Program ID mismatch."
grep -F -q "assert.eq program_owner ${EXPECTED_ADMIN_ADDRESS};" "${COMPILED_PROGRAM}" ||
    fail "Compiled admin constructor guard mismatch."

required_functions=(
    create_bounty_v3
    submit_claim_v3
    fund_bounty_v3
    review_claim_v3
    lock_reward_v3
    disclosure_action_v3
    resolution_action_v3
    dispute_claim_v3
    cast_arbitration_vote_v3
    settle_reward_v3
    finalize_arbitration_prelock_v3
    finalize_rejection_v3
    refund_bounty_v3
)
required_mappings=(
    bounty_v3_configs
    claim_v3_evidence
    claim_v3_states
    claim_v3_payouts
    claim_v3_arbitration_tallies
    claim_v3_arbitration_votes
    v3_operation_markers
    claim_v3_acknowledgements
    claim_v3_dispute_bonds
    claim_v3_project_decisions
    claim_v3_dispute_metadata
    claim_v3_dispute_rounds
    claim_v3_active_disputes
)
for function_name in "${required_functions[@]}"; do
    grep -F -q "function ${function_name}:" "${COMPILED_PROGRAM}" ||
        fail "Compiled Program is missing V3 function: ${function_name}"
done
for mapping_name in "${required_mappings[@]}"; do
    grep -F -q "mapping ${mapping_name}:" "${COMPILED_PROGRAM}" ||
        fail "Compiled Program is missing V3 mapping: ${mapping_name}"
done
printf 'V3 Edition 3 hardening surface: 13 functions and 13 mappings present\n'

SOURCE_SHA="$(sha256sum "${LEO_PROJECT_DIR}/src/main.leo" | awk '{print $1}')"
COMPILED_SHA="$(sha256sum "${COMPILED_PROGRAM}" | awk '{print $1}')"
ABI_SHA="$(sha256sum "${ABI_PATH}" | awk '{print $1}')"
GIT_COMMIT="$(git -C "${PROJECT_ROOT}" rev-parse HEAD 2>/dev/null || true)"

mkdir -p -- "${RESULT_DIR}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PUBLIC_EVIDENCE="${RESULT_DIR}/edition-3-${MODE}-${TIMESTAMP}.json"

printf 'Source SHA256: %s\n' "${SOURCE_SHA}"
printf 'Compiled Program SHA256: %s\n' "${COMPILED_SHA}"
printf 'ABI SHA256: %s\n' "${ABI_SHA}"
printf 'Mode: %s\n' "${MODE}"

PUBLIC_BALANCE_RAW=""
PUBLIC_BALANCE_MICROCREDITS="UNAVAILABLE"
if PUBLIC_BALANCE_RAW="$(read_public_credits_balance 2>/dev/null)"; then
    if [[ "${PUBLIC_BALANCE_RAW}" =~ ^\"?([0-9]+)u64\"?$ ]]; then
        PUBLIC_BALANCE_MICROCREDITS="${BASH_REMATCH[1]}"
    fi
fi
printf 'Public administrator balance (microcredits): %s\n' "${PUBLIC_BALANCE_MICROCREDITS}"

# Leo 4.4.0 has no public, unsigned upgrade fee-estimation command. Constructing
# one would require a private key, so preview reports this boundary explicitly.
FEE_ESTIMATE_MICROCREDITS="UNAVAILABLE"
printf 'Public fee estimate (microcredits): %s (no signing performed)\n' "${FEE_ESTIMATE_MICROCREDITS}"

if [[ "${MODE}" == "preview" ]]; then
    write_public_evidence         "${PUBLIC_EVIDENCE}"         "PREVIEW_ONLY_NOT_BROADCAST"         ""         ""         "${SOURCE_SHA}"         "${COMPILED_SHA}"         "${ABI_SHA}"         "${GIT_COMMIT}"         "${PUBLIC_ADMIN_ADDRESS}"         "${PUBLIC_BALANCE_MICROCREDITS}"         "${FEE_ESTIMATE_MICROCREDITS}"
    printf 'Preview complete. No private key was requested, no transaction was signed, and no transaction was broadcast.\n'
    printf 'Public-only evidence: %s\n' "${PUBLIC_EVIDENCE}"
    exit 0
fi

[[ -t 0 && -t 1 ]] ||
    fail "An interactive WSL terminal is required for private-key entry."
read -rsp "Aleo Testnet administrator private key (input is not echoed): " PRIVATE_KEY
printf '\n'

KEY_PREFIX="A""PrivateKey1"
[[ -n "${PRIVATE_KEY}" ]] || fail "No private key was entered."
[[ "${PRIVATE_KEY}" == "${KEY_PREFIX}"* ]] ||
    fail "The entered value does not have the expected Aleo private-key format."
[[ ${#PRIVATE_KEY} -ge 40 ]] || fail "The entered value is too short."

printf 'WARNING: this will request an irreversible Aleo Testnet Edition 3 hardening upgrade.\n'
read -rp 'Type UPGRADE EDITION 3 to continue: ' CONFIRMATION
[[ "${CONFIRMATION}" == "UPGRADE EDITION 3" ]] ||
    fail "Broadcast confirmation did not match. Nothing was broadcast."

upgrade_args=(
    upgrade
    --network "${NETWORK}"
    --endpoint "${ENDPOINT}"
    --network-retries 6
    --broadcast
)
LEO_UPGRADE_LOG="${TEMP_DIR}/leo-upgrade.log"
set +e
(
    cd "${LEO_PROJECT_DIR}"
    PRIVATE_KEY="${PRIVATE_KEY}" "${LEO_BIN}" "${upgrade_args[@]}"
) 2>&1 | node "${SCRIPT_DIR}/redact-aleo-cli-output.mjs" >"${LEO_UPGRADE_LOG}"
PIPE_RESULTS=("${PIPESTATUS[@]}")
LEO_EXIT="${PIPE_RESULTS[0]}"
REDACTOR_EXIT="${PIPE_RESULTS[1]}"
set -e
unset -v PRIVATE_KEY
[[ "${REDACTOR_EXIT}" == "0" ]] || fail "Leo output redaction failed; no raw Leo output was written or printed."
if [[ "${LEO_EXIT}" != "0" ]]; then
    printf 'Leo upgrade broadcast failed or was declined. Sanitized diagnostics follow:\n' >&2
    tail -n 12 "${LEO_UPGRADE_LOG}" >&2 || true
    fail "Leo upgrade broadcast failed or was declined."
fi

cat "${LEO_UPGRADE_LOG}"
mapfile -t TRANSACTION_IDS < <(extract_transaction_ids "${LEO_UPGRADE_LOG}")
UPGRADE_TRANSACTION_ID="${TRANSACTION_IDS[0]:-}"
FEE_TRANSACTION_ID="${TRANSACTION_IDS[1]:-}"
[[ -n "${UPGRADE_TRANSACTION_ID}" ]] ||
    fail "Broadcast may have occurred, but the public upgrade transaction ID could not be parsed. Do not rebroadcast; inspect public chain state."
write_public_evidence         "${PUBLIC_EVIDENCE}"         "BROADCAST_UNVERIFIED"         "${UPGRADE_TRANSACTION_ID}"         "${FEE_TRANSACTION_ID}"         "${SOURCE_SHA}"         "${COMPILED_SHA}"         "${ABI_SHA}"         "${GIT_COMMIT}"         "${PUBLIC_ADMIN_ADDRESS}"         "${PUBLIC_BALANCE_MICROCREDITS}"         "${FEE_ESTIMATE_MICROCREDITS}"
printf 'Upgrade Transaction ID: %s\n' "${UPGRADE_TRANSACTION_ID}"
if [[ -n "${FEE_TRANSACTION_ID}" ]]; then
    printf 'Fee Transaction ID: %s\n' "${FEE_TRANSACTION_ID}"
else
    printf 'Fee Transaction ID: not parsed; do not rebroadcast. Verify the public transaction first.\n'
fi
printf 'Status: broadcast recorded, not yet claimed as confirmed\n'

printf 'Public-only evidence: %s\n' "${PUBLIC_EVIDENCE}"
printf 'Only sanitized Leo output was written to a temporary log and will now be removed.\n'
