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
EXPECTED_CURRENT_EDITION="1"
EXPECTED_TARGET_EDITION="2"
NETWORK="testnet"
ENDPOINT="https://api.explorer.provable.com/v1"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
LEO_PROJECT_DIR="${PROJECT_ROOT}/leo/bug_proof"
COMPILED_PROGRAM="${LEO_PROJECT_DIR}/build/zkbugbounty_7f3c92/zkbugbounty_7f3c92.aleo"
ABI_PATH="${LEO_PROJECT_DIR}/build/zkbugbounty_7f3c92/abi.json"
RESULT_DIR="${PROJECT_ROOT}/local-upgrade-results"
TEMP_DIR=""
PRIVATE_KEY=""

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    unset -v PRIVATE_KEY 2>/dev/null || true
    if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
        rm -f -- "${TEMP_DIR}/leo-result.json"
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
        --connect-timeout 10 \
        --max-time 30 \
        "${ENDPOINT}/${NETWORK}/program/${EXPECTED_PROGRAM_ID}/latest_edition" |
        tr -d '[:space:]"'
}

extract_transaction_ids() {
    python3 - "$1" <<'PY'
import json
import re
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    payload = json.load(source)

transaction_pattern = re.compile(r"^at1[0-9a-z]{50,80}$")
candidates = []

def walk(value, path=()):
    if isinstance(value, dict):
        for key, child in value.items():
            walk(child, path + (str(key),))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            walk(child, path + (str(index),))
    elif isinstance(value, str) and transaction_pattern.fullmatch(value):
        candidates.append((path, value))

walk(payload)
upgrade = None
fee = None
for path, value in candidates:
    label = ".".join(path).lower()
    if fee is None and "fee" in label:
        fee = value
    elif upgrade is None and ("transaction" in label or "deployment" in label or "upgrade" in label):
        upgrade = value

if upgrade is None and candidates:
    upgrade = candidates[0][1]
if fee is None:
    remaining = [value for _, value in candidates if value != upgrade]
    if remaining:
        fee = remaining[0]

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

    python3 - \
        "${output_path}" \
        "${MODE}" \
        "${result_status}" \
        "${upgrade_transaction_id}" \
        "${fee_transaction_id}" \
        "${source_sha}" \
        "${compiled_sha}" \
        "${abi_sha}" \
        "${git_commit}" <<'PY'
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
) = sys.argv[1:]

evidence = {
    "schema": "zkbugbounty.testnet-upgrade-evidence.v1",
    "recorded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "network": "testnet",
    "program_id": "zkbugbounty_7f3c92.aleo",
    "previous_edition": 1,
    "target_edition": 2,
    "mode": mode,
    "status": status,
    "upgrade_transaction_id": upgrade_transaction_id or None,
    "fee_transaction_id": fee_transaction_id or None,
    "source_sha256": source_sha,
    "compiled_program_sha256": compiled_sha,
    "abi_sha256": abi_sha,
    "git_commit": git_commit or None,
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
)
for function_name in "${required_functions[@]}"; do
    grep -F -q "function ${function_name}:" "${COMPILED_PROGRAM}" ||
        fail "Compiled Program is missing V3 function: ${function_name}"
done
for mapping_name in "${required_mappings[@]}"; do
    grep -F -q "mapping ${mapping_name}:" "${COMPILED_PROGRAM}" ||
        fail "Compiled Program is missing V3 mapping: ${mapping_name}"
done
printf 'V3 ABI surface: 13 functions and 11 mappings present\n'

SOURCE_SHA="$(sha256sum "${LEO_PROJECT_DIR}/src/main.leo" | awk '{print $1}')"
COMPILED_SHA="$(sha256sum "${COMPILED_PROGRAM}" | awk '{print $1}')"
ABI_SHA="$(sha256sum "${ABI_PATH}" | awk '{print $1}')"
GIT_COMMIT="$(git -C "${PROJECT_ROOT}" rev-parse HEAD 2>/dev/null || true)"

mkdir -p -- "${RESULT_DIR}"
TEMP_DIR="$(mktemp -d)"
RAW_RESULT="${TEMP_DIR}/leo-result.json"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PUBLIC_EVIDENCE="${RESULT_DIR}/edition-2-${MODE}-${TIMESTAMP}.json"

printf 'Source SHA256: %s\n' "${SOURCE_SHA}"
printf 'Compiled Program SHA256: %s\n' "${COMPILED_SHA}"
printf 'ABI SHA256: %s\n' "${ABI_SHA}"
printf 'Mode: %s\n' "${MODE}"

[[ -t 0 && -t 1 ]] ||
    fail "An interactive WSL terminal is required for private-key entry."
read -rsp "Aleo Testnet administrator private key (input is not echoed): " PRIVATE_KEY
printf '\n'

KEY_PREFIX="A""PrivateKey1"
[[ -n "${PRIVATE_KEY}" ]] || fail "No private key was entered."
[[ "${PRIVATE_KEY}" == "${KEY_PREFIX}"* ]] ||
    fail "The entered value does not have the expected Aleo private-key format."
[[ ${#PRIVATE_KEY} -ge 40 ]] || fail "The entered value is too short."

if [[ "${MODE}" == "broadcast" ]]; then
    printf 'WARNING: this will request an irreversible Aleo Testnet Edition 2 upgrade.\n'
    read -rp 'Type UPGRADE EDITION 2 to continue: ' CONFIRMATION
    [[ "${CONFIRMATION}" == "UPGRADE EDITION 2" ]] ||
        fail "Broadcast confirmation did not match. Nothing was broadcast."
fi

upgrade_args=(
    upgrade
    --network "${NETWORK}"
    --endpoint "${ENDPOINT}"
    --network-retries 6
    --json-output "${RAW_RESULT}"
)
if [[ "${MODE}" == "broadcast" ]]; then
    upgrade_args+=(--broadcast)
else
    upgrade_args+=(--print)
fi

if ! (
    cd "${LEO_PROJECT_DIR}"
    PRIVATE_KEY="${PRIVATE_KEY}" "${LEO_BIN}" "${upgrade_args[@]}"
); then
    fail "Leo upgrade ${MODE} failed or was declined."
fi
unset -v PRIVATE_KEY

[[ -f "${RAW_RESULT}" ]] || fail "Leo did not produce its JSON result."
if grep -I -E -q -- "A""PrivateKey1[[:alnum:]_]{20,}" "${RAW_RESULT}"; then
    fail "Sensitive material was detected in the Leo result. It will not be copied or printed."
fi

mapfile -t TRANSACTION_IDS < <(extract_transaction_ids "${RAW_RESULT}")
UPGRADE_TRANSACTION_ID="${TRANSACTION_IDS[0]:-}"
FEE_TRANSACTION_ID="${TRANSACTION_IDS[1]:-}"

if [[ "${MODE}" == "preview" ]]; then
    write_public_evidence         "${PUBLIC_EVIDENCE}"         "PREVIEW_ONLY_NOT_BROADCAST"         ""         ""         "${SOURCE_SHA}"         "${COMPILED_SHA}"         "${ABI_SHA}"         "${GIT_COMMIT}"
    printf 'Preview complete. No transaction was broadcast.\n'
else
    [[ -n "${UPGRADE_TRANSACTION_ID}" ]] ||
        fail "Broadcast may have occurred, but the public upgrade transaction ID could not be parsed. Do not rebroadcast; inspect public chain state."
    write_public_evidence         "${PUBLIC_EVIDENCE}"         "BROADCAST_UNVERIFIED"         "${UPGRADE_TRANSACTION_ID}"         "${FEE_TRANSACTION_ID}"         "${SOURCE_SHA}"         "${COMPILED_SHA}"         "${ABI_SHA}"         "${GIT_COMMIT}"
    printf 'Upgrade Transaction ID: %s\n' "${UPGRADE_TRANSACTION_ID}"
    if [[ -n "${FEE_TRANSACTION_ID}" ]]; then
        printf 'Fee Transaction ID: %s\n' "${FEE_TRANSACTION_ID}"
    else
        printf 'Fee Transaction ID: not parsed; do not rebroadcast. Verify the public transaction first.\n'
    fi
    printf 'Status: broadcast recorded, not yet claimed as confirmed\n'
fi

printf 'Public-only evidence: %s\n' "${PUBLIC_EVIDENCE}"
printf 'Raw Leo result was kept only in a temporary directory and will now be removed.\n'
