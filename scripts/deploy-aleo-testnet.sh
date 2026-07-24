#!/usr/bin/env bash
set -euo pipefail
set +x

umask 077

EXPECTED_PROGRAM_ID="zkbugbounty_7f3c92.aleo"
EXPECTED_ADMIN_ADDRESS="aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6"
NETWORK="testnet"
ENDPOINT="https://api.explorer.provable.com/v1"
HEIGHT_URL="${ENDPOINT}/${NETWORK}/block/height/latest"
STATE_ROOT_URL="${ENDPOINT}/${NETWORK}/stateRoot/latest"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
LEO_PROJECT_DIR="${PROJECT_ROOT}/leo/bug_proof"
RESULT_FILENAME="deployment_result.json"
RESULT_PATH="${LEO_PROJECT_DIR}/${RESULT_FILENAME}"

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    unset -v PRIVATE_KEY 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command is unavailable: $1"
}

json_program_id() {
    python3 -c 'import json, sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["program"])' "$1"
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
    local key_marker
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

    key_marker="A""PrivateKey"

    for root in "${scan_roots[@]}"; do
        if [[ -d "$root" ]]; then
            while IFS= read -r -d '' path; do
                scan_files+=("$path")
            done < <(find "$root" -type f -print0)
        fi
    done

    for path in \
        "${PROJECT_ROOT}/.env" \
        "${PROJECT_ROOT}/.env.local" \
        "${LEO_PROJECT_DIR}/.env" \
        "${LEO_PROJECT_DIR}/.env.local" \
        "${PROJECT_ROOT}/package.json" \
        "${PROJECT_ROOT}/next.config.ts" \
        "${PROJECT_ROOT}/tsconfig.json" \
        "${LEO_PROJECT_DIR}/program.json"; do
        if [[ -f "$path" ]]; then
            scan_files+=("$path")
        fi
    done

    if ((${#scan_files[@]} == 0)); then
        fail "No project files were available for the private-key safety scan."
    fi

    while IFS= read -r path; do
        suspect_files+=("$path")
    done < <(grep -I -l -- "$key_marker" "${scan_files[@]}" || true)

    if ((${#suspect_files[@]} > 0)); then
        printf 'ERROR: Potential Aleo private-key literals were found in these project files:\n' >&2
        for path in "${suspect_files[@]}"; do
            printf '  %s\n' "${path#"${PROJECT_ROOT}/"}" >&2
        done
        exit 1
    fi
}

[[ "$(pwd -P)" == "$PROJECT_ROOT" ]] || fail "Run this script from the project root: ${PROJECT_ROOT}"
[[ -f "${PROJECT_ROOT}/package.json" ]] || fail "Project root is missing package.json."
[[ -d "$LEO_PROJECT_DIR" ]] || fail "Canonical Leo project directory is missing: ${LEO_PROJECT_DIR}"
[[ -f "${LEO_PROJECT_DIR}/program.json" ]] || fail "Canonical Leo program.json is missing."
[[ -f "${LEO_PROJECT_DIR}/src/main.leo" ]] || fail "Canonical Leo main.leo is missing."
[[ ! -d "${PROJECT_ROOT}/aleo" ]] || fail "A second Aleo project container exists at ${PROJECT_ROOT}/aleo."
[[ ! -e "$RESULT_PATH" ]] || fail "A previous ${RESULT_FILENAME} exists. Move it before starting a new deployment."

require_command leo
require_command curl
require_command python3
require_command grep
require_command find

LEO_VERSION="$(leo --version)"
[[ "$LEO_VERSION" == "leo 4.0.2"* ]] || fail "Leo 4.0.2 is required; found: ${LEO_VERSION}"
printf 'Leo CLI: %s\n' "$LEO_VERSION"

mapfile -d '' SOURCE_MANIFESTS < <(
    find "${PROJECT_ROOT}/leo" \
        -path '*/build' -prune -o \
        -type f -name program.json -print0
)
[[ ${#SOURCE_MANIFESTS[@]} -eq 1 ]] || fail "Expected exactly one canonical Leo source manifest."
[[ "${SOURCE_MANIFESTS[0]}" == "${LEO_PROJECT_DIR}/program.json" ]] || fail "Unexpected Leo source manifest path."

scan_for_private_key_literals
printf 'Private-key project scan: clear\n'

(
    cd "$LEO_PROJECT_DIR"
    leo clean
    leo build
)

SOURCE_PROGRAM_ID="$(json_program_id "${LEO_PROJECT_DIR}/program.json")"
BUILD_PROGRAM_ID="$(json_program_id "${LEO_PROJECT_DIR}/build/program.json")"
ABI_PROGRAM_ID="$(json_program_id "${LEO_PROJECT_DIR}/build/abi.json")"

[[ "$SOURCE_PROGRAM_ID" == "$EXPECTED_PROGRAM_ID" ]] || fail "Source Program ID mismatch."
[[ "$BUILD_PROGRAM_ID" == "$EXPECTED_PROGRAM_ID" ]] || fail "Build Program ID mismatch."
[[ "$ABI_PROGRAM_ID" == "$EXPECTED_PROGRAM_ID" ]] || fail "ABI Program ID mismatch."
grep -F -q "program ${EXPECTED_PROGRAM_ID} {" "${LEO_PROJECT_DIR}/src/main.leo" || fail "main.leo Program ID mismatch."
grep -F -q "@admin(address = \"${EXPECTED_ADMIN_ADDRESS}\")" "${LEO_PROJECT_DIR}/src/main.leo" || fail "Admin constructor address mismatch."
if grep -F -q '@noupgrade' "${LEO_PROJECT_DIR}/src/main.leo"; then
    fail "The canonical program unexpectedly contains @noupgrade."
fi
grep -F -q "assert.eq program_owner ${EXPECTED_ADMIN_ADDRESS};" "${LEO_PROJECT_DIR}/build/main.aleo" || fail "Compiled admin constructor guard mismatch."
printf 'Program and constructor checks: clear\n'

HEIGHT_STATUS="$(http_status "$HEIGHT_URL")" || fail "Unable to query the Testnet block-height endpoint."
[[ "$HEIGHT_STATUS" == "200" ]] || fail "Testnet block-height endpoint returned HTTP ${HEIGHT_STATUS}."

STATE_ROOT_STATUS="$(http_status "$STATE_ROOT_URL")" || fail "Unable to query the Testnet state-root endpoint."
[[ "$STATE_ROOT_STATUS" == "200" ]] || fail "Testnet state-root endpoint returned HTTP ${STATE_ROOT_STATUS}."

PROGRAM_URL="${ENDPOINT}/${NETWORK}/program/${EXPECTED_PROGRAM_ID}"
PROGRAM_STATUS="$(http_status "$PROGRAM_URL")" || fail "Unable to query the Testnet program endpoint."
case "$PROGRAM_STATUS" in
    404)
        ;;
    200)
        fail "Program ${EXPECTED_PROGRAM_ID} already exists on Aleo Testnet. Deployment stopped."
        ;;
    *)
        fail "Testnet program endpoint returned HTTP ${PROGRAM_STATUS}."
        ;;
esac

printf 'Aleo Testnet public endpoint checks: clear\n'
printf 'Program availability check: clear\n'

[[ -t 0 && -t 1 ]] || fail "An interactive WSL terminal is required for private-key entry and deployment confirmation."
read -rsp "Aleo Testnet deployer private key: " PRIVATE_KEY
echo

KEY_PREFIX="A""PrivateKey1"
[[ -n "$PRIVATE_KEY" ]] || fail "No private key was entered."
[[ "$PRIVATE_KEY" == "$KEY_PREFIX"* ]] || fail "The entered value does not have the expected Aleo private-key format."
[[ ${#PRIVATE_KEY} -ge 40 ]] || fail "The entered value is too short to be a valid Aleo private key."

if ! (
    cd "$LEO_PROJECT_DIR"
    PRIVATE_KEY="$PRIVATE_KEY" \
    NETWORK="$NETWORK" \
    ENDPOINT="$ENDPOINT" \
    leo deploy \
        --broadcast \
        --network-retries 6 \
        --json-output="$RESULT_FILENAME"
); then
    fail "Aleo Testnet deployment failed or was declined. No success result was accepted."
fi

unset -v PRIVATE_KEY

[[ -f "$RESULT_PATH" ]] || fail "Deployment did not create ${RESULT_PATH}. Do not redeploy until the network status is checked."

if grep -I -l -- "A""PrivateKey" "$RESULT_PATH" >/dev/null; then
    fail "Sensitive material was detected in ${RESULT_PATH}. The file contents were not printed."
fi

TRANSACTION_ID="$(python3 - "$RESULT_PATH" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as result_file:
    payload = json.load(result_file)

preferred_keys = (
    "transaction_id",
    "transactionId",
    "deployment_transaction_id",
    "deploymentTransactionId",
)

def find_transaction_id(value):
    if isinstance(value, dict):
        for key in preferred_keys:
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.startswith("at1"):
                return candidate
        for key, candidate in value.items():
            if "transaction" in key.lower() and isinstance(candidate, str) and candidate.startswith("at1"):
                return candidate
        for candidate in value.values():
            found = find_transaction_id(candidate)
            if found:
                return found
    elif isinstance(value, list):
        for candidate in value:
            found = find_transaction_id(candidate)
            if found:
                return found
    return None

transaction_id = find_transaction_id(payload)
if not transaction_id:
    raise SystemExit(1)
print(transaction_id)
PY
)" || fail "Deployment may have succeeded, but its public transaction ID could not be parsed. Do not redeploy until ${RESULT_PATH} is checked."

printf 'Program ID: %s\n' "$EXPECTED_PROGRAM_ID"
printf 'Deployment Transaction ID: %s\n' "$TRANSACTION_ID"
printf 'Network: %s\n' "$NETWORK"
printf 'Result: %s\n' "$RESULT_PATH"
