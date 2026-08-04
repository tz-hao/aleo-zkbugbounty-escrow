#!/usr/bin/env bash
set -euo pipefail

LEO_BIN="${LEO_BIN:-leo}"

cd "$(dirname "$0")/.."

expect_pass() {
  local label="$1"
  shift
  if ! "${LEO_BIN}" run prove_vault_invariant_break "$@" >/dev/null; then
    echo "Expected ${label} to verify." >&2
    exit 1
  fi
}

expect_reject() {
  local label="$1"
  shift
  if "${LEO_BIN}" run prove_vault_invariant_break "$@" >/dev/null 2>&1; then
    echo "Expected ${label} to be rejected." >&2
    exit 1
  fi
}

# Rule 1: vault_balance >= total_claims.
expect_pass "vault valid" 1001field 2002field 1field 100u64 100u64 80u64 20u64 50u64 50u64 20u64 90u64 30u64 0u64 0u64 0u64 9201field
expect_reject "vault invalid" 1001field 2002field 1field 100u64 100u64 80u64 20u64 50u64 50u64 20u64 5u64 5u64 0u64 0u64 0u64 9202field
expect_reject "vault low impact" 1001field 2002field 1field 100u64 100u64 95u64 20u64 50u64 50u64 20u64 5u64 5u64 0u64 0u64 0u64 9203field
expect_pass "vault boundary" 1001field 2002field 1field 100u64 100u64 90u64 20u64 50u64 50u64 20u64 10u64 10u64 0u64 0u64 0u64 9204field

# Rule 2: total_claims <= total_deposits.
expect_pass "claims valid" 1001field 2002field 2field 100u64 100u64 80u64 20u64 50u64 50u64 20u64 0u64 120u64 0u64 0u64 0u64 9211field
expect_reject "claims invalid" 1001field 2002field 2field 100u64 100u64 80u64 20u64 50u64 50u64 20u64 0u64 5u64 0u64 0u64 0u64 9212field
expect_reject "claims low impact" 1001field 2002field 2field 100u64 100u64 95u64 20u64 50u64 50u64 20u64 0u64 10u64 0u64 0u64 0u64 9213field
expect_pass "claims boundary" 1001field 2002field 2field 100u64 100u64 90u64 20u64 50u64 50u64 20u64 0u64 20u64 0u64 0u64 0u64 9214field

# Rule 3: reserved_rewards <= vault_balance.
expect_pass "reserve valid" 1001field 2002field 3field 100u64 100u64 80u64 20u64 50u64 50u64 20u64 0u64 0u64 180u64 0u64 0u64 9221field
expect_reject "reserve invalid" 1001field 2002field 3field 100u64 100u64 80u64 20u64 50u64 50u64 20u64 0u64 0u64 10u64 0u64 0u64 9222field
expect_reject "reserve low impact" 1001field 2002field 3field 100u64 100u64 80u64 95u64 50u64 50u64 20u64 0u64 0u64 10u64 0u64 0u64 9223field
expect_pass "reserve boundary" 1001field 2002field 3field 100u64 100u64 80u64 90u64 50u64 50u64 20u64 0u64 0u64 20u64 0u64 0u64 9224field

# Rule 4: requested withdrawal stays within both limit and user balance.
expect_pass "withdraw valid" 1001field 2002field 4field 100u64 100u64 80u64 20u64 50u64 50u64 20u64 0u64 0u64 0u64 130u64 0u64 9231field
expect_reject "withdraw invalid" 1001field 2002field 4field 100u64 100u64 80u64 20u64 50u64 50u64 20u64 0u64 0u64 0u64 5u64 0u64 9232field
expect_reject "withdraw low impact" 1001field 2002field 4field 100u64 100u64 80u64 20u64 50u64 50u64 45u64 0u64 0u64 0u64 10u64 0u64 9233field
expect_pass "withdraw boundary" 1001field 2002field 4field 100u64 100u64 80u64 20u64 50u64 50u64 40u64 0u64 0u64 0u64 20u64 0u64 9234field

echo "All four DemoVault Leo rule matrices passed."
