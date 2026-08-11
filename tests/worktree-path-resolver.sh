#!/usr/bin/env bash
set -euo pipefail

TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_PARENT="${TEST_ROOT}/local-e2e-results"
mkdir -p "${TEST_PARENT}"
TEST_DIR="$(mktemp -d "${TEST_PARENT}/worktree-path-resolver.XXXXXX")"
export V3_CANDIDATE_WORKTREE="${TEST_DIR}/candidate-protocol-v3"
export CANDIDATE_REF="HEAD"
source "${TEST_ROOT}/scripts/escrow-v2-devnode-e2e.sh"
trap - EXIT INT TERM


cleanup() {
  rm -rf -- "${TEST_DIR}"
}
trap cleanup EXIT

assert_equal() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  [[ "${actual}" == "${expected}" ]] || {
    printf 'worktree-path-resolver: %s\nexpected: %s\nactual:   %s\n' "${label}" "${expected}" "${actual}" >&2
    exit 1
  }
}

assert_equal "${CANDIDATE_DIR}" "${V3_CANDIDATE_WORKTREE}" "explicit V3 Candidate worktree"
[[ "${CANDIDATE_DIR}" != "${ROOT_DIR}/local-devnode/candidate-escrow-v2" ]] || {
  printf 'worktree-path-resolver: old V2 Candidate must be ignored when V3 Candidate is explicit\n' >&2
  exit 1
}

mkdir -p "${TEST_DIR}/linux-gitdir" "${TEST_DIR}/workspace"
LINUX_GITDIR="$(realpath "${TEST_DIR}/linux-gitdir")"

assert_equal "$(resolve_gitdir_path "${TEST_DIR}/workspace" "${LINUX_GITDIR}")" "${LINUX_GITDIR}" "Linux absolute path"
assert_equal "$(resolve_gitdir_path "${TEST_DIR}/workspace" "../linux-gitdir")" "${LINUX_GITDIR}" "relative path"

if command -v wslpath >/dev/null 2>&1; then
  WINDOWS_GITDIR="$(wslpath -w "${LINUX_GITDIR}" | tr '\\' '/')"
  assert_equal "$(resolve_gitdir_path "${TEST_DIR}/workspace" "${WINDOWS_GITDIR}")" "${LINUX_GITDIR}" "Windows drive-letter path"
fi

if resolve_gitdir_path "${TEST_DIR}/workspace" "" >/dev/null 2>&1; then
  printf 'worktree-path-resolver: missing path should fail\n' >&2
  exit 1
fi

if resolve_gitdir_path "${TEST_DIR}/workspace" "missing-gitdir" >/dev/null 2>&1; then
  printf 'worktree-path-resolver: invalid path should fail\n' >&2
  exit 1
fi

printf 'worktree-path-resolver: PASS\n'
