#!/usr/bin/env bash

# Final V3 dynamic coverage. This file is sourced by the disposable localhost
# Devnode harness only; it never reads credentials or targets a public network.

V3_FINAL_NONCE=7000
V3_FINAL_COVERAGE_STARTED=0
V3_FINAL_COVERAGE_PASSED=0

v3_final_field() {
  V3_FINAL_NONCE=$((V3_FINAL_NONCE + 1))
  printf '%sfield' "$(( $(date +%s%N) + V3_FINAL_NONCE ))"
}

v3_fixture_run() {
  local output=""

  output="$(cd "${ROOT_DIR}/scripts/fixtures/v3-public-key-deriver" && env "NETWORK=${ALEO_E2E_NETWORK}" "ENDPOINT=${ALEO_E2E_ENDPOINT}" "${LEO_BIN}" run "$@" --offline --disable-update-check --network "${ALEO_E2E_NETWORK}" --endpoint "${ALEO_E2E_ENDPOINT}" 2>&1)" \
    || die "V3 public key derivation fixture failed"
  printf '%s\n' "${output}" | grep -Eo '[0-9]+field' | tail -n 1
}

v3_vote_mapping_key() {
  v3_fixture_run derive_vote_key "$1" "$2" "$3"
}

v3_operation_mapping_key() {
  v3_fixture_run derive_operation_marker "$1" "$2" "$3" "$4" "$5" "$6" "$7"
}

assert_mapping_or_null_unchanged() {
  local label="$1"
  local mapping="$2"
  local key="$3"
  local expected="$4"
  local actual=""

  capture_mapping_or_null actual "${mapping}" "${key}"
  [[ "${actual}" == "${expected}" ]] \
    || die "${label}: ${mapping}[${key}] changed"
  record_event "${label}" "unchanged"
}

assert_v3_dispute_persistence() {
  local label="$1"
  local bounty_id="$2"
  local claim_hash="$3"
  local dispute_type="$4"
  local commitment="$5"
  local opener="$6"
  local pre_status="$7"
  local decision="$8"

  assert_mapping_matches "${label}-metadata" claim_v3_dispute_metadata "${claim_hash}" \
    "claim_hash:${claim_hash}" "bounty_id:${bounty_id}" \
    "dispute_type:${dispute_type}u8" "dispute_commitment:${commitment}" \
    "opener:${opener}" "status:1u8"
  assert_mapping_matches "${label}-state" claim_v3_states "${claim_hash}" \
    "claim_hash:${claim_hash}" "bounty_id:${bounty_id}" "status:11u8" \
    "pre_dispute_status:${pre_status}u8" "dispute_commitment:${commitment}"
  assert_mapping_matches "${label}-decision" claim_v3_project_decisions "${claim_hash}" \
    "claim_hash:${claim_hash}" "bounty_id:${bounty_id}" "decision:${decision}u8"
  printf '%s dispute persistence: PASS\n' "${label}"
  printf '%s dispute: PASS\n' "${label}"
  record_event "v3-${label,,}-dispute-persistence" "passed"
}

v3_submit_final_claim() {
  local label="$1"
  local result_variable="$2"
  local bounty_id="$3"
  local scope_hash="$4"
  local target_system="$5"
  local target_code="$6"
  local binding=""
  local witness=""
  local claim_hash=""

  binding="{ target_system_commitment: ${target_system}, target_state_commitment: $(v3_final_field), target_code_hash: ${target_code}, execution_commitment: $(v3_final_field), report_commitment: $(v3_final_field) }"
  witness="{ vault_balance_before: 1000u64, total_deposits_before: 1000u64, total_claims_before: 100u64, reserved_rewards_before: 0u64, withdraw_limit_before: 1000u64, user_balance_before: 1000u64, requested_withdraw_before: 0u64, hidden_delta_balance: 200u64, hidden_delta_claims: 800u64, hidden_delta_reserved_rewards: 0u64, hidden_delta_withdraw_amount: 0u64, hidden_delta_user_balance: 0u64, reporter_secret: $(v3_final_field) }"
  execute_accepted "${label}-submit" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" \
    "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" submit_claim_v3 "${bounty_id}" \
    "${scope_hash}" 1field "${binding}" "${witness}"
  claim_hash="$(field_from_output claim_hash)"
  [[ -n "${claim_hash}" ]] || die "${label}: V3 Claim hash is missing"
  assert_mapping_matches "${label}-receipt" claim_receipts "${claim_hash}" \
    "claim_hash:${claim_hash}" "bounty_id:${bounty_id}" "severity:3u8" "protocol_version:3u8"
  assert_mapping_matches "${label}-submitted" claim_v3_states "${claim_hash}" \
    "whitehat_address:${WHITEHAT_ADDRESS}" "status:1u8"
  printf -v "${result_variable}" '%s' "${claim_hash}"
}

v3_review_final_claim() {
  local label="$1"
  local bounty_id="$2"
  local claim_hash="$3"
  local action="$4"
  local project_severity="$5"

  execute_accepted "${label}" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" review_claim_v3 "${bounty_id}" "${claim_hash}" \
    "${action}u8" "${project_severity}u8" "$(v3_final_field)" "$(v3_final_field)"
}

v3_open_final_dispute() {
  local label="$1"
  local bounty_id="$2"
  local claim_hash="$3"
  local dispute_type="$4"
  local requested_severity="$5"
  local opener_key="$6"
  local opener_role="$7"
  local opener_address="$8"
  local commitment="$9"
  local marker="${10}"

  execute_accepted "${label}" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${opener_key}" "${opener_role}" "${opener_address}" \
    "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" dispute_claim_v3 "${bounty_id}" \
    "${claim_hash}" "${dispute_type}u8" "${requested_severity}u8" "${commitment}" \
    1000000u64 "${marker}"
}

v3_cast_vote() {
  local label="$1"
  local key="$2"
  local role="$3"
  local address="$4"
  local bounty_id="$5"
  local claim_hash="$6"
  local verdict="$7"
  local marker="$8"

  print_v3_vote_preflight_snapshot "${label}" "${bounty_id}" "${claim_hash}" "${address}" "${verdict}u8" "${marker}"
  execute_accepted "${label}" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${key}" "${role}" "${address}" \
    "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" cast_arbitration_vote_v3 \
    "${bounty_id}" "${claim_hash}" "${verdict}u8" "${marker}"
}

v3_disclose_and_reproduce() {
  local label="$1"
  local bounty_id="$2"
  local claim_hash="$3"

  execute_accepted "${label}-deliver" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" \
    "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" disclosure_action_v3 \
    "${bounty_id}" "${claim_hash}" 1u8 "$(v3_final_field)" "$(v3_final_field)"
  execute_accepted "${label}-ack" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" disclosure_action_v3 \
    "${bounty_id}" "${claim_hash}" 2u8 "$(v3_final_field)" "$(v3_final_field)"
  execute_accepted "${label}-reproduce" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" resolution_action_v3 \
    "${bounty_id}" "${claim_hash}" 1u8 "$(v3_final_field)" "$(v3_final_field)"
  assert_mapping_matches "${label}-reproduced" claim_v3_states "${claim_hash}" "status:7u8"
}

v3_close_and_refund() {
  local label="$1"
  local bounty_id="$2"
  local deadline_height="$3"
  local refund_amount="$4"
  local refund_marker="$5"
  local refund_value="" refund_operation=""
  local program_before=""
  local owner_before=""
  local escrow_before=""
  local marker_before=""
  local program_after=""
  local owner_after=""
  local escrow_after=""
  local marker_after=""
  local height=""
  local refund_fee=""
  local refund_replay_fee=""

  refund_value="${refund_amount%u64}"
  [[ "${refund_value}" =~ ^[0-9]+$ ]] || die "${label}: invalid refund amount"

  execute_accepted "${label}-close" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" close_bounty "${bounty_id}"
  height="$(current_height)"
  if ((10#${height} <= 10#${deadline_height})); then
    advance_blocks "$((10#${deadline_height} - 10#${height} + 1))"
  fi
  refund_operation="$(v3_operation_mapping_key 332field "${bounty_id}" 0field "${OWNER_ADDRESS}" "${OWNER_ADDRESS}" "${refund_value}u64" "${refund_marker}")"
  program_before="$(public_credits_balance "${PROGRAM_ID}")"
  owner_before="$(public_credits_balance "${OWNER_ADDRESS}")"
  execute_accepted "${label}-refund" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" refund_bounty_v3 "${bounty_id}" "${refund_value}u64" "${refund_marker}"
  refund_fee="$(confirmed_public_fee_microcredits "${label}-refund-fee" "${STEP_TX_ID}" execute)"
  program_after="$(public_credits_balance "${PROGRAM_ID}")"
  owner_after="$(public_credits_balance "${OWNER_ADDRESS}")"
  assert_balance_delta "${label}-refund-program" "${program_before}" "${program_after}" "-$((10#${refund_value}))"
  assert_balance_delta "${label}-refund-owner" "${owner_before}" "${owner_after}" "$((10#${refund_value} - 10#${refund_fee}))"
  capture_mapping escrow_before bounty_escrows "${bounty_id}"
  capture_mapping marker_before v3_operation_markers "${refund_operation}"
  expect_chain_rejected "${label}-refund-replay" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" execute refund_bounty_v3 "${bounty_id}" "${refund_value}u64" "${refund_marker}" --skip-execute-proof --broadcast --yes
  refund_replay_fee="$(confirmed_public_fee_microcredits "${label}-refund-replay-fee" "${STEP_FEE_TX_ID}" fee)"
  capture_mapping escrow_after bounty_escrows "${bounty_id}"
  capture_mapping marker_after v3_operation_markers "${refund_operation}"
  assert_balance_delta "${label}-refund-replay-program" "${program_after}" "$(public_credits_balance "${PROGRAM_ID}")" 0
  assert_balance_delta "${label}-refund-replay-owner" "${owner_after}" "$(public_credits_balance "${OWNER_ADDRESS}")" "-$((10#${refund_replay_fee}))"
  [[ "${escrow_after}" == "${escrow_before}" ]] || die "${label}: refund replay changed escrow"
  [[ "${marker_after}" == "${marker_before}" ]] || die "${label}: refund replay changed marker"
  printf 'V3 refund replay: PASS\n'
  record_event "v3-refund-replay" "passed"
}

run_protocol_v3_final_dynamic_coverage() {
  local shard="${ZKBB_FINAL_SHARD:-all}"
  local non_arbiter_key="" non_arbiter_address=""
  local v3_two_bounty="" v3_two_scope="" v3_two_target_system="" v3_two_target_code="" v3_two_panel="" v3_two_policy="" v3_two_deadline_height="" v3_two_deadline=""
  local v3_two_panel_before="" v3_two_panel_after="" v3_two_program_before="" v3_two_program_after=""
  local claim_rejection="" claim_duplicate="" claim_scope="" claim_severity="" claim_reproduction="" claim_remediation=""
  local rejection_commitment="" duplicate_commitment="" scope_commitment="" severity_commitment="" reproduction_commitment="" remediation_commitment=""
  local rejection_marker="" duplicate_marker="" scope_marker="" severity_marker="" reproduction_marker="" remediation_marker=""
  local non_vote_nonce="" non_vote_key="" non_vote_operation="" vote_one_nonce="" vote_one_key="" vote_one_operation="" duplicate_vote_nonce="" duplicate_vote_operation="" prelock_nonce="" prelock_operation="" settlement_nonce="" settlement_operation=""
  local tally_before="" state_before="" dispute_before="" bond_before="" escrow_before="" vote_before="" vote_marker_before="" prelock_before=""
  local program_before="" owner_before="" whitehat_before="" program_after="" owner_after="" whitehat_after=""
  local v3_three_bounty="" v3_three_scope="" v3_three_target_system="" v3_three_target_code="" v3_three_panel="" v3_three_policy="" v3_three_deadline_height="" v3_three_deadline="" v3_three_claim="" v3_three_commitment="" v3_three_marker=""
  local all_program_before="" v3_two_refund_amount="9000000u64"

  case "${shard}" in
    all|two-core|duplicate-scope|severity|reproduction-remediation|three-of-three) ;;
    *) die "unsupported Protocol V3 final dynamic shard: ${shard}" ;;
  esac

  V3_FINAL_COVERAGE_STARTED=1
  all_program_before="$(public_credits_balance "${PROGRAM_ID}")"
  if [[ "${shard}" == "all" || "${shard}" == "two-core" ]]; then
  generate_ephemeral_local_account non_arbiter_key non_arbiter_address "ephemeral V3 non-arbiter"
  [[ "${non_arbiter_address}" != "${ARBITER_ADDRESS}" && "${non_arbiter_address}" != "${arbiter_two_address}" && "${non_arbiter_address}" != "${arbiter_three_address}" ]] \
    || die "generated non-arbiter unexpectedly belongs to the panel"
  execute_accepted "v3-final-bootstrap-non-arbiter" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" credits.aleo::transfer_public "${non_arbiter_address}" 500000000u64
  require_public_balance "v3-final-non-arbiter" "Non-arbiter" "${non_arbiter_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    || die "V3 non-arbiter bootstrap failed"
  fi

  if [[ "${shard}" != "three-of-three" ]]; then
  case "${shard}" in
    all) v3_two_refund_amount="9000000u64" ;;
    two-core) v3_two_refund_amount="17000000u64" ;;
    duplicate-scope) v3_two_refund_amount="20000000u64" ;;
    severity) v3_two_refund_amount="18000000u64" ;;
    reproduction-remediation) v3_two_refund_amount="14000000u64" ;;
  esac
  v3_two_program_before="$(public_credits_balance "${PROGRAM_ID}")"
  v3_two_deadline_height=$((10#$(current_height) + 250))
  v3_two_deadline="${v3_two_deadline_height}u32"
  v3_two_bounty="$(v3_final_field)"
  v3_two_scope="$(v3_final_field)"
  v3_two_target_system="$(v3_final_field)"
  v3_two_target_code="$(v3_final_field)"
  v3_two_panel="$(v3_final_field)"
  v3_two_policy="{ disclosure_key_commitment: $(v3_final_field), target_system_commitment: ${v3_two_target_system}, target_code_hash: ${v3_two_target_code}, panel_id: ${v3_two_panel}, arbiter_one: ${ARBITER_ADDRESS}, arbiter_two: ${arbiter_two_address}, arbiter_three: ${arbiter_three_address}, quorum: 2u8, review_window_blocks: 4u32, decision_window_blocks: 60u32, arbitration_fee_microcredits: 1000000u64, payment_condition: 1u8 }"
  execute_accepted "v3-final-2of3-create-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" create_bounty_v3 "${v3_two_bounty}" "${v3_two_scope}" 1field \
    3000000u64 2000000u64 1000000u64 0u64 "${v3_two_deadline}" "${v3_two_policy}"
  assert_mapping_matches "v3-final-2of3-config" bounty_v3_configs "${v3_two_bounty}" \
    "panel_id:${v3_two_panel}" "arbiter_one:${ARBITER_ADDRESS}" "arbiter_two:${arbiter_two_address}" \
    "arbiter_three:${arbiter_three_address}" "quorum:2u8"
  capture_mapping v3_two_panel_before bounty_v3_configs "${v3_two_bounty}"
  execute_accepted "v3-final-2of3-fund" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" fund_bounty_v3 "${v3_two_bounty}" 20000000u64 "$(v3_final_field)"

  if [[ "${shard}" == "all" || "${shard}" == "two-core" ]]; then
  harness_time_track_begin quorum-2
  if [[ "${shard}" == "all" ]]; then
    harness_time_track_begin six-disputes
  fi
  # Type 1 REJECTION also drives the independent 2-of-3 negative, non-panel,
  # duplicate-vote, real transfer-final rollback, and settlement replay gates.
  v3_submit_final_claim "v3-final-rejection" claim_rejection "${v3_two_bounty}" "${v3_two_scope}" "${v3_two_target_system}" "${v3_two_target_code}"
  v3_review_final_claim "v3-final-rejection-review" "${v3_two_bounty}" "${claim_rejection}" 3 0
  rejection_commitment="$(v3_final_field)"; rejection_marker="$(v3_final_field)"
  v3_open_final_dispute "v3-final-rejection-open" "${v3_two_bounty}" "${claim_rejection}" 1 0 \
    "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${rejection_commitment}" "${rejection_marker}"
  assert_v3_dispute_persistence "REJECTION" "${v3_two_bounty}" "${claim_rejection}" 1 "${rejection_commitment}" "${WHITEHAT_ADDRESS}" 13 2

  non_vote_nonce="$(v3_final_field)"
  non_vote_key="$(v3_vote_mapping_key "${v3_two_bounty}" "${claim_rejection}" "${non_arbiter_address}")"
  non_vote_operation="$(v3_operation_mapping_key 328field "${v3_two_bounty}" "${claim_rejection}" "${non_arbiter_address}" "${WHITEHAT_ADDRESS}" 3u64 "${non_vote_nonce}")"
  capture_mapping tally_before claim_v3_arbitration_tallies "${claim_rejection}"
  capture_mapping state_before claim_v3_states "${claim_rejection}"
  capture_mapping dispute_before claim_v3_dispute_metadata "${claim_rejection}"
  capture_mapping bond_before claim_v3_dispute_bonds "${claim_rejection}"
  capture_mapping escrow_before bounty_escrows "${v3_two_bounty}"
  capture_mapping_or_null vote_before claim_v3_arbitration_votes "${non_vote_key}"
  capture_mapping_or_null vote_marker_before v3_operation_markers "${non_vote_operation}"
  program_before="$(public_credits_balance "${PROGRAM_ID}")"; owner_before="$(public_credits_balance "${OWNER_ADDRESS}")"; whitehat_before="$(public_credits_balance "${WHITEHAT_ADDRESS}")"
  expect_chain_rejected "v3-final-non-arbiter-vote" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${non_arbiter_key}" "Non-arbiter" "${non_arbiter_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute cast_arbitration_vote_v3 "${v3_two_bounty}" "${claim_rejection}" 3u8 "${non_vote_nonce}" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-final-non-arbiter-tally" claim_v3_arbitration_tallies "${claim_rejection}" "${tally_before}"
  assert_mapping_unchanged "v3-final-non-arbiter-state" claim_v3_states "${claim_rejection}" "${state_before}"
  assert_mapping_unchanged "v3-final-non-arbiter-dispute" claim_v3_dispute_metadata "${claim_rejection}" "${dispute_before}"
  assert_mapping_unchanged "v3-final-non-arbiter-bond" claim_v3_dispute_bonds "${claim_rejection}" "${bond_before}"
  assert_mapping_unchanged "v3-final-non-arbiter-escrow" bounty_escrows "${v3_two_bounty}" "${escrow_before}"
  assert_mapping_or_null_unchanged "v3-final-non-arbiter-vote" claim_v3_arbitration_votes "${non_vote_key}" "${vote_before}"
  assert_mapping_or_null_unchanged "v3-final-non-arbiter-marker" v3_operation_markers "${non_vote_operation}" "${vote_marker_before}"
  assert_balance_delta "v3-final-non-arbiter-program" "${program_before}" "$(public_credits_balance "${PROGRAM_ID}")" 0
  assert_balance_delta "v3-final-non-arbiter-owner" "${owner_before}" "$(public_credits_balance "${OWNER_ADDRESS}")" 0
  assert_balance_delta "v3-final-non-arbiter-whitehat" "${whitehat_before}" "$(public_credits_balance "${WHITEHAT_ADDRESS}")" 0
  printf 'non-arbiter rejection: PASS\n'; record_event "v3-non-arbiter-rejection" "passed"

  vote_one_nonce="$(v3_final_field)"
  vote_one_key="$(v3_vote_mapping_key "${v3_two_bounty}" "${claim_rejection}" "${ARBITER_ADDRESS}")"
  vote_one_operation="$(v3_operation_mapping_key 328field "${v3_two_bounty}" "${claim_rejection}" "${ARBITER_ADDRESS}" "${WHITEHAT_ADDRESS}" 3u64 "${vote_one_nonce}")"
  v3_cast_vote "v3-final-rejection-arbiter-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${v3_two_bounty}" "${claim_rejection}" 3 "${vote_one_nonce}"
  capture_mapping tally_before claim_v3_arbitration_tallies "${claim_rejection}"
  capture_mapping state_before claim_v3_states "${claim_rejection}"
  capture_mapping dispute_before claim_v3_dispute_metadata "${claim_rejection}"
  capture_mapping bond_before claim_v3_dispute_bonds "${claim_rejection}"
  capture_mapping escrow_before bounty_escrows "${v3_two_bounty}"
  capture_mapping vote_before claim_v3_arbitration_votes "${vote_one_key}"
  capture_mapping vote_marker_before v3_operation_markers "${vote_one_operation}"
  prelock_nonce="$(v3_final_field)"
  prelock_operation="$(v3_operation_mapping_key 331field "${v3_two_bounty}" "${claim_rejection}" "${arbiter_three_address}" "${WHITEHAT_ADDRESS}" 1000000u64 "${prelock_nonce}")"
  capture_mapping_or_null prelock_before v3_operation_markers "${prelock_operation}"
  program_before="$(public_credits_balance "${PROGRAM_ID}")"; owner_before="$(public_credits_balance "${OWNER_ADDRESS}")"; whitehat_before="$(public_credits_balance "${WHITEHAT_ADDRESS}")"
  harness_time_track_begin atomicity
  expect_chain_rejected "v3-final-2of3-one-vote-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute finalize_arbitration_prelock_v3 "${v3_two_bounty}" "${claim_rejection}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "${prelock_nonce}" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-final-2of3-atomic-tally" claim_v3_arbitration_tallies "${claim_rejection}" "${tally_before}"
  assert_mapping_unchanged "v3-final-2of3-atomic-state" claim_v3_states "${claim_rejection}" "${state_before}"
  assert_mapping_unchanged "v3-final-2of3-atomic-dispute" claim_v3_dispute_metadata "${claim_rejection}" "${dispute_before}"
  assert_mapping_unchanged "v3-final-2of3-atomic-bond" claim_v3_dispute_bonds "${claim_rejection}" "${bond_before}"
  assert_mapping_unchanged "v3-final-2of3-atomic-escrow" bounty_escrows "${v3_two_bounty}" "${escrow_before}"
  assert_mapping_unchanged "v3-final-2of3-atomic-vote" claim_v3_arbitration_votes "${vote_one_key}" "${vote_before}"
  assert_mapping_unchanged "v3-final-2of3-atomic-vote-marker" v3_operation_markers "${vote_one_operation}" "${vote_marker_before}"
  assert_mapping_or_null_unchanged "v3-final-2of3-atomic-prelock-marker" v3_operation_markers "${prelock_operation}" "${prelock_before}"
  assert_balance_delta "v3-final-2of3-atomic-program" "${program_before}" "$(public_credits_balance "${PROGRAM_ID}")" 0
  assert_balance_delta "v3-final-2of3-atomic-owner" "${owner_before}" "$(public_credits_balance "${OWNER_ADDRESS}")" 0
  assert_balance_delta "v3-final-2of3-atomic-whitehat" "${whitehat_before}" "$(public_credits_balance "${WHITEHAT_ADDRESS}")" 0
  printf '2/3 one-vote settlement rejection: PASS\n'; printf 'V3 failed-finalize atomic rollback: PASS\n'
  record_event "v3-2of3-one-vote-rejection" "passed"; record_event "v3-failed-finalize-atomic-rollback" "passed"
  harness_time_track_end atomicity

  duplicate_vote_nonce="$(v3_final_field)"
  duplicate_vote_operation="$(v3_operation_mapping_key 328field "${v3_two_bounty}" "${claim_rejection}" "${ARBITER_ADDRESS}" "${WHITEHAT_ADDRESS}" 3u64 "${duplicate_vote_nonce}")"
  capture_mapping tally_before claim_v3_arbitration_tallies "${claim_rejection}"; capture_mapping state_before claim_v3_states "${claim_rejection}"
  capture_mapping dispute_before claim_v3_dispute_metadata "${claim_rejection}"; capture_mapping bond_before claim_v3_dispute_bonds "${claim_rejection}"
  capture_mapping escrow_before bounty_escrows "${v3_two_bounty}"; capture_mapping vote_before claim_v3_arbitration_votes "${vote_one_key}"
  capture_mapping_or_null vote_marker_before v3_operation_markers "${duplicate_vote_operation}"; program_before="$(public_credits_balance "${PROGRAM_ID}")"; owner_before="$(public_credits_balance "${OWNER_ADDRESS}")"; whitehat_before="$(public_credits_balance "${WHITEHAT_ADDRESS}")"
  expect_chain_rejected "v3-final-duplicate-vote" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute cast_arbitration_vote_v3 "${v3_two_bounty}" "${claim_rejection}" 3u8 "${duplicate_vote_nonce}" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-final-duplicate-vote-tally" claim_v3_arbitration_tallies "${claim_rejection}" "${tally_before}"
  assert_mapping_unchanged "v3-final-duplicate-vote-state" claim_v3_states "${claim_rejection}" "${state_before}"
  assert_mapping_unchanged "v3-final-duplicate-vote-dispute" claim_v3_dispute_metadata "${claim_rejection}" "${dispute_before}"
  assert_mapping_unchanged "v3-final-duplicate-vote-bond" claim_v3_dispute_bonds "${claim_rejection}" "${bond_before}"
  assert_mapping_unchanged "v3-final-duplicate-vote-escrow" bounty_escrows "${v3_two_bounty}" "${escrow_before}"
  assert_mapping_unchanged "v3-final-duplicate-vote-entry" claim_v3_arbitration_votes "${vote_one_key}" "${vote_before}"
  assert_mapping_or_null_unchanged "v3-final-duplicate-vote-marker" v3_operation_markers "${duplicate_vote_operation}" "${vote_marker_before}"
  assert_balance_delta "v3-final-duplicate-vote-program" "${program_before}" "$(public_credits_balance "${PROGRAM_ID}")" 0
  assert_balance_delta "v3-final-duplicate-vote-owner" "${owner_before}" "$(public_credits_balance "${OWNER_ADDRESS}")" 0
  assert_balance_delta "v3-final-duplicate-vote-whitehat" "${whitehat_before}" "$(public_credits_balance "${WHITEHAT_ADDRESS}")" 0
  printf 'duplicate vote rollback: PASS\n'; record_event "v3-duplicate-vote-rollback" "passed"

  v3_cast_vote "v3-final-rejection-arbiter-two" "${arbiter_two_key}" "Arbiter 2" "${arbiter_two_address}" "${v3_two_bounty}" "${claim_rejection}" 3 "$(v3_final_field)"
  execute_accepted "v3-final-2of3-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    finalize_arbitration_prelock_v3 "${v3_two_bounty}" "${claim_rejection}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "$(v3_final_field)"
  printf '2/3 two-vote settlement acceptance: PASS\n'; record_event "v3-2of3-two-vote-acceptance" "passed"
  v3_disclose_and_reproduce "v3-final-rejection" "${v3_two_bounty}" "${claim_rejection}"
  settlement_nonce="$(v3_final_field)"
  settlement_operation="$(v3_operation_mapping_key 329field "${v3_two_bounty}" "${claim_rejection}" "${arbiter_three_address}" "${WHITEHAT_ADDRESS}" 3000000u64 "${settlement_nonce}")"
  execute_accepted "v3-final-rejection-settle" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    settle_reward_v3 "${v3_two_bounty}" "${claim_rejection}" "${WHITEHAT_ADDRESS}" 3000000u64 0u64 3u8 "${settlement_nonce}"
  assert_mapping_matches "v3-final-rejection-paid" claim_v3_states "${claim_rejection}" "status:12u8"
  assert_mapping_matches "v3-final-rejection-payout" claim_v3_payouts "${claim_rejection}" "reserved_amount:3000000u64" "paid_amount:3000000u64" "status:2u8"
  assert_mapping_matches "v3-final-rejection-bond" claim_v3_dispute_bonds "${claim_rejection}" "status:2u8"
  assert_mapping_matches "v3-final-rejection-metadata" claim_v3_dispute_metadata "${claim_rejection}" "dispute_type:1u8" "status:2u8" "final_severity:3u8"
  assert_mapping_matches "v3-final-rejection-escrow" bounty_escrows "${v3_two_bounty}" "available_balance:17000000u64" "locked_amount:0u64" "paid_amount:3000000u64"
  capture_mapping escrow_before bounty_escrows "${v3_two_bounty}"; capture_mapping state_before claim_v3_states "${claim_rejection}"
  capture_mapping dispute_before claim_v3_dispute_metadata "${claim_rejection}"; capture_mapping bond_before claim_v3_dispute_bonds "${claim_rejection}"
  capture_mapping vote_marker_before v3_operation_markers "${settlement_operation}"; program_before="$(public_credits_balance "${PROGRAM_ID}")"; owner_before="$(public_credits_balance "${OWNER_ADDRESS}")"; whitehat_before="$(public_credits_balance "${WHITEHAT_ADDRESS}")"
  harness_time_track_begin replay
  expect_chain_rejected "v3-final-settlement-replay" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute settle_reward_v3 "${v3_two_bounty}" "${claim_rejection}" "${WHITEHAT_ADDRESS}" 3000000u64 0u64 3u8 "${settlement_nonce}" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-final-replay-escrow" bounty_escrows "${v3_two_bounty}" "${escrow_before}"
  assert_mapping_unchanged "v3-final-replay-state" claim_v3_states "${claim_rejection}" "${state_before}"
  assert_mapping_unchanged "v3-final-replay-dispute" claim_v3_dispute_metadata "${claim_rejection}" "${dispute_before}"
  assert_mapping_unchanged "v3-final-replay-bond" claim_v3_dispute_bonds "${claim_rejection}" "${bond_before}"
  assert_mapping_unchanged "v3-final-replay-marker" v3_operation_markers "${settlement_operation}" "${vote_marker_before}"
  assert_balance_delta "v3-final-replay-program" "${program_before}" "$(public_credits_balance "${PROGRAM_ID}")" 0
  assert_balance_delta "v3-final-replay-owner" "${owner_before}" "$(public_credits_balance "${OWNER_ADDRESS}")" 0
  assert_balance_delta "v3-final-replay-whitehat" "${whitehat_before}" "$(public_credits_balance "${WHITEHAT_ADDRESS}")" 0
  printf 'finalized dispute replay rejection: PASS\n'; record_event "v3-finalized-dispute-replay" "passed"
  harness_time_track_end replay
  harness_time_track_end quorum-2
  fi

  if [[ "${shard}" == "all" || "${shard}" == "duplicate-scope" ]]; then
  # Type 2 DUPLICATE: first prove the submitted state is not appealable, then
  # exercise owner authorization and the real adverse-decision route.
  v3_submit_final_claim "v3-final-duplicate" claim_duplicate "${v3_two_bounty}" "${v3_two_scope}" "${v3_two_target_system}" "${v3_two_target_code}"
  expect_chain_rejected "v3-final-duplicate-invalid-state" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute dispute_claim_v3 "${v3_two_bounty}" "${claim_duplicate}" 2u8 0u8 "$(v3_final_field)" 1000000u64 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  v3_review_final_claim "v3-final-duplicate-review" "${v3_two_bounty}" "${claim_duplicate}" 4 0
  expect_chain_rejected "v3-final-duplicate-wrong-caller" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" \
    execute dispute_claim_v3 "${v3_two_bounty}" "${claim_duplicate}" 2u8 0u8 "$(v3_final_field)" 1000000u64 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  duplicate_commitment="$(v3_final_field)"; duplicate_marker="$(v3_final_field)"
  v3_open_final_dispute "v3-final-duplicate-open" "${v3_two_bounty}" "${claim_duplicate}" 2 0 "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${duplicate_commitment}" "${duplicate_marker}"
  assert_v3_dispute_persistence "DUPLICATE" "${v3_two_bounty}" "${claim_duplicate}" 2 "${duplicate_commitment}" "${WHITEHAT_ADDRESS}" 13 3
  v3_cast_vote "v3-final-duplicate-arbiter-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${v3_two_bounty}" "${claim_duplicate}" 0 "$(v3_final_field)"
  v3_cast_vote "v3-final-duplicate-arbiter-two" "${arbiter_two_key}" "Arbiter 2" "${arbiter_two_address}" "${v3_two_bounty}" "${claim_duplicate}" 0 "$(v3_final_field)"
  execute_accepted "v3-final-duplicate-finalize" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" finalize_rejection_v3 "${v3_two_bounty}" "${claim_duplicate}" "${OWNER_ADDRESS}" 1000000u64 0u8 "$(v3_final_field)"

  # Type 3 SCOPE has both wrong-state and wrong-caller guards before its valid route.
  v3_submit_final_claim "v3-final-scope" claim_scope "${v3_two_bounty}" "${v3_two_scope}" "${v3_two_target_system}" "${v3_two_target_code}"
  expect_chain_rejected "v3-final-scope-wrong-state" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" execute dispute_claim_v3 "${v3_two_bounty}" "${claim_scope}" 3u8 0u8 "$(v3_final_field)" 1000000u64 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  v3_review_final_claim "v3-final-scope-review" "${v3_two_bounty}" "${claim_scope}" 5 0
  expect_chain_rejected "v3-final-scope-wrong-caller" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" execute dispute_claim_v3 "${v3_two_bounty}" "${claim_scope}" 3u8 0u8 "$(v3_final_field)" 1000000u64 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  scope_commitment="$(v3_final_field)"; scope_marker="$(v3_final_field)"
  v3_open_final_dispute "v3-final-scope-open" "${v3_two_bounty}" "${claim_scope}" 3 0 "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${scope_commitment}" "${scope_marker}"
  assert_v3_dispute_persistence "SCOPE" "${v3_two_bounty}" "${claim_scope}" 3 "${scope_commitment}" "${WHITEHAT_ADDRESS}" 13 4
  v3_cast_vote "v3-final-scope-arbiter-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${v3_two_bounty}" "${claim_scope}" 0 "$(v3_final_field)"
  v3_cast_vote "v3-final-scope-arbiter-two" "${arbiter_two_key}" "Arbiter 2" "${arbiter_two_address}" "${v3_two_bounty}" "${claim_scope}" 0 "$(v3_final_field)"
  execute_accepted "v3-final-scope-finalize" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" finalize_rejection_v3 "${v3_two_bounty}" "${claim_scope}" "${OWNER_ADDRESS}" 1000000u64 0u8 "$(v3_final_field)"
  fi

  if [[ "${shard}" == "all" || "${shard}" == "severity" ]]; then
  # Type 4 proves the arbitrary requested amount cannot bypass final panel severity.
  v3_submit_final_claim "v3-final-severity" claim_severity "${v3_two_bounty}" "${v3_two_scope}" "${v3_two_target_system}" "${v3_two_target_code}"
  v3_review_final_claim "v3-final-severity-review" "${v3_two_bounty}" "${claim_severity}" 6 1
  assert_mapping_matches "v3-final-severity-project-decision" claim_v3_project_decisions "${claim_severity}" "decision:5u8" "project_severity:1u8"
  severity_commitment="$(v3_final_field)"; severity_marker="$(v3_final_field)"
  v3_open_final_dispute "v3-final-severity-open" "${v3_two_bounty}" "${claim_severity}" 4 2 "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${severity_commitment}" "${severity_marker}"
  assert_v3_dispute_persistence "SEVERITY" "${v3_two_bounty}" "${claim_severity}" 4 "${severity_commitment}" "${WHITEHAT_ADDRESS}" 3 5
  v3_cast_vote "v3-final-severity-arbiter-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${v3_two_bounty}" "${claim_severity}" 2 "$(v3_final_field)"
  v3_cast_vote "v3-final-severity-arbiter-two" "${arbiter_two_key}" "Arbiter 2" "${arbiter_two_address}" "${v3_two_bounty}" "${claim_severity}" 2 "$(v3_final_field)"
  execute_accepted "v3-final-severity-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" finalize_arbitration_prelock_v3 "${v3_two_bounty}" "${claim_severity}" "${WHITEHAT_ADDRESS}" 2000000u64 1000000u64 2u8 "$(v3_final_field)"
  v3_disclose_and_reproduce "v3-final-severity" "${v3_two_bounty}" "${claim_severity}"
  execute_accepted "v3-final-severity-settle" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" settle_reward_v3 "${v3_two_bounty}" "${claim_severity}" "${WHITEHAT_ADDRESS}" 2000000u64 0u64 2u8 "$(v3_final_field)"
  assert_mapping_matches "v3-final-severity-final" claim_v3_dispute_metadata "${claim_severity}" "requested_severity:2u8" "final_severity:2u8" "status:2u8"
  assert_mapping_matches "v3-final-severity-payout" claim_v3_payouts "${claim_severity}" "reserved_amount:2000000u64" "paid_amount:2000000u64" "status:2u8"
  fi

  if [[ "${shard}" == "all" || "${shard}" == "reproduction-remediation" ]]; then
  # Type 5 is deliberately distinct from a type-1 rejection: the owner first
  # rejects reproduction after acknowledged encrypted delivery, and the panel
  # may only return reject or the receipt severity.
  v3_submit_final_claim "v3-final-reproduction" claim_reproduction "${v3_two_bounty}" "${v3_two_scope}" "${v3_two_target_system}" "${v3_two_target_code}"
  v3_review_final_claim "v3-final-reproduction-accept" "${v3_two_bounty}" "${claim_reproduction}" 2 3
  execute_accepted "v3-final-reproduction-lock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" lock_reward_v3 "${v3_two_bounty}" "${claim_reproduction}" 3000000u64 "$(v3_final_field)"
  execute_accepted "v3-final-reproduction-deliver" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" disclosure_action_v3 "${v3_two_bounty}" "${claim_reproduction}" 1u8 "$(v3_final_field)" "$(v3_final_field)"
  execute_accepted "v3-final-reproduction-ack" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" disclosure_action_v3 "${v3_two_bounty}" "${claim_reproduction}" 2u8 "$(v3_final_field)" "$(v3_final_field)"
  execute_accepted "v3-final-reproduction-reject" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" resolution_action_v3 "${v3_two_bounty}" "${claim_reproduction}" 2u8 "$(v3_final_field)" "$(v3_final_field)"
  reproduction_commitment="$(v3_final_field)"; reproduction_marker="$(v3_final_field)"
  v3_open_final_dispute "v3-final-reproduction-open" "${v3_two_bounty}" "${claim_reproduction}" 5 0 "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${reproduction_commitment}" "${reproduction_marker}"
  assert_v3_dispute_persistence "REPRODUCTION" "${v3_two_bounty}" "${claim_reproduction}" 5 "${reproduction_commitment}" "${WHITEHAT_ADDRESS}" 8 6
  capture_mapping tally_before claim_v3_arbitration_tallies "${claim_reproduction}"
  expect_chain_rejected "v3-final-reproduction-illegal-severity" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" execute cast_arbitration_vote_v3 "${v3_two_bounty}" "${claim_reproduction}" 2u8 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-final-reproduction-illegal-tally" claim_v3_arbitration_tallies "${claim_reproduction}" "${tally_before}"
  v3_cast_vote "v3-final-reproduction-arbiter-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${v3_two_bounty}" "${claim_reproduction}" 3 "$(v3_final_field)"
  v3_cast_vote "v3-final-reproduction-arbiter-two" "${arbiter_two_key}" "Arbiter 2" "${arbiter_two_address}" "${v3_two_bounty}" "${claim_reproduction}" 3 "$(v3_final_field)"
  execute_accepted "v3-final-reproduction-settle" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" settle_reward_v3 "${v3_two_bounty}" "${claim_reproduction}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "$(v3_final_field)"
  assert_mapping_matches "v3-final-reproduction-paid" claim_v3_states "${claim_reproduction}" "status:12u8"
  # Type 6 REMEDIATION: open only after the patch-review window, then accept
  # the panel result and release the already locked reward.
  v3_submit_final_claim "v3-final-remediation" claim_remediation "${v3_two_bounty}" "${v3_two_scope}" "${v3_two_target_system}" "${v3_two_target_code}"
  v3_review_final_claim "v3-final-remediation-accept" "${v3_two_bounty}" "${claim_remediation}" 2 3
  execute_accepted "v3-final-remediation-lock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" lock_reward_v3 "${v3_two_bounty}" "${claim_remediation}" 3000000u64 "$(v3_final_field)"
  v3_disclose_and_reproduce "v3-final-remediation" "${v3_two_bounty}" "${claim_remediation}"
  execute_accepted "v3-final-remediation-patch" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" resolution_action_v3 "${v3_two_bounty}" "${claim_remediation}" 3u8 "$(v3_final_field)" "$(v3_final_field)"
  expect_chain_rejected "v3-final-remediation-invalid-lifecycle" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" execute dispute_claim_v3 "${v3_two_bounty}" "${claim_remediation}" 6u8 0u8 "$(v3_final_field)" 1000000u64 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  advance_blocks 5
  remediation_commitment="$(v3_final_field)"; remediation_marker="$(v3_final_field)"
  v3_open_final_dispute "v3-final-remediation-open" "${v3_two_bounty}" "${claim_remediation}" 6 0 "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${remediation_commitment}" "${remediation_marker}"
  assert_v3_dispute_persistence "REMEDIATION" "${v3_two_bounty}" "${claim_remediation}" 6 "${remediation_commitment}" "${OWNER_ADDRESS}" 9 7
  v3_cast_vote "v3-final-remediation-arbiter-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${v3_two_bounty}" "${claim_remediation}" 3 "$(v3_final_field)"
  v3_cast_vote "v3-final-remediation-arbiter-two" "${arbiter_two_key}" "Arbiter 2" "${arbiter_two_address}" "${v3_two_bounty}" "${claim_remediation}" 3 "$(v3_final_field)"
  execute_accepted "v3-final-remediation-finalize" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" finalize_rejection_v3 "${v3_two_bounty}" "${claim_remediation}" "${OWNER_ADDRESS}" 1000000u64 3u8 "$(v3_final_field)"
  execute_accepted "v3-final-remediation-settle" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" settle_reward_v3 "${v3_two_bounty}" "${claim_remediation}" "${WHITEHAT_ADDRESS}" 3000000u64 0u64 3u8 "$(v3_final_field)"
  assert_mapping_matches "v3-final-remediation-paid" claim_v3_states "${claim_remediation}" "status:12u8"
  assert_mapping_matches "v3-final-remediation-payout" claim_v3_payouts "${claim_remediation}" "reserved_amount:3000000u64" "paid_amount:3000000u64" "status:2u8"
  assert_mapping_matches "v3-final-remediation-metadata" claim_v3_dispute_metadata "${claim_remediation}" "dispute_type:6u8" "status:2u8" "final_severity:3u8"
  fi

  if [[ "${shard}" == "all" ]]; then
    printf 'six dispute types: PASS\n'; record_event "v3-six-dispute-types" "passed"
    harness_time_track_end six-disputes
  fi

  capture_mapping v3_two_panel_after bounty_v3_configs "${v3_two_bounty}"
  [[ "${v3_two_panel_after}" == "${v3_two_panel_before}" ]] || die "V3 panel changed during final 2-of-3 coverage"
  printf 'immutable panel runtime: PASS\n'; record_event "v3-immutable-panel-runtime" "passed"
  assert_mapping_matches "v3-final-2of3-all-resolved" bounty_claim_counts "${v3_two_bounty}" "0u64"
  v3_close_and_refund "v3-final-2of3" "${v3_two_bounty}" "${v3_two_deadline_height}" "${v3_two_refund_amount}" "$(v3_final_field)"
  v3_two_program_after="$(public_credits_balance "${PROGRAM_ID}")"
  assert_balance_delta "v3-final-2of3-conservation" "${v3_two_program_before}" "${v3_two_program_after}" 0
  fi

  if [[ "${shard}" == "all" || "${shard}" == "three-of-three" ]]; then
  harness_time_track_begin quorum-3
  # A distinct 3-of-3 Bounty cannot inherit the 2-of-3 quorum result.
  v3_three_deadline_height=$((10#$(current_height) + 120)); v3_three_deadline="${v3_three_deadline_height}u32"
  v3_three_bounty="$(v3_final_field)"; v3_three_scope="$(v3_final_field)"; v3_three_target_system="$(v3_final_field)"; v3_three_target_code="$(v3_final_field)"; v3_three_panel="$(v3_final_field)"
  v3_three_policy="{ disclosure_key_commitment: $(v3_final_field), target_system_commitment: ${v3_three_target_system}, target_code_hash: ${v3_three_target_code}, panel_id: ${v3_three_panel}, arbiter_one: ${ARBITER_ADDRESS}, arbiter_two: ${arbiter_two_address}, arbiter_three: ${arbiter_three_address}, quorum: 3u8, review_window_blocks: 4u32, decision_window_blocks: 60u32, arbitration_fee_microcredits: 1000000u64, payment_condition: 1u8 }"
  execute_accepted "v3-final-3of3-create-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" create_bounty_v3 "${v3_three_bounty}" "${v3_three_scope}" 1field 3000000u64 2000000u64 1000000u64 0u64 "${v3_three_deadline}" "${v3_three_policy}"
  assert_mapping_matches "v3-final-3of3-config" bounty_v3_configs "${v3_three_bounty}" "quorum:3u8" "panel_id:${v3_three_panel}"
  execute_accepted "v3-final-3of3-fund" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" fund_bounty_v3 "${v3_three_bounty}" 5000000u64 "$(v3_final_field)"
  v3_submit_final_claim "v3-final-3of3" v3_three_claim "${v3_three_bounty}" "${v3_three_scope}" "${v3_three_target_system}" "${v3_three_target_code}"
  v3_review_final_claim "v3-final-3of3-review" "${v3_three_bounty}" "${v3_three_claim}" 3 0
  v3_three_commitment="$(v3_final_field)"; v3_three_marker="$(v3_final_field)"
  v3_open_final_dispute "v3-final-3of3-open" "${v3_three_bounty}" "${v3_three_claim}" 1 0 "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${v3_three_commitment}" "${v3_three_marker}"
  v3_cast_vote "v3-final-3of3-arbiter-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${v3_three_bounty}" "${v3_three_claim}" 3 "$(v3_final_field)"
  expect_chain_rejected "v3-final-3of3-one-vote-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" execute finalize_arbitration_prelock_v3 "${v3_three_bounty}" "${v3_three_claim}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  printf '3/3 one-vote settlement rejection: PASS\n'; record_event "v3-3of3-one-vote-rejection" "passed"
  v3_cast_vote "v3-final-3of3-arbiter-two" "${arbiter_two_key}" "Arbiter 2" "${arbiter_two_address}" "${v3_three_bounty}" "${v3_three_claim}" 3 "$(v3_final_field)"
  expect_chain_rejected "v3-final-3of3-two-vote-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" execute finalize_arbitration_prelock_v3 "${v3_three_bounty}" "${v3_three_claim}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  printf '3/3 two-vote settlement rejection: PASS\n'; record_event "v3-3of3-two-vote-rejection" "passed"
  v3_cast_vote "v3-final-3of3-arbiter-three" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${v3_three_bounty}" "${v3_three_claim}" 3 "$(v3_final_field)"
  execute_accepted "v3-final-3of3-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" finalize_arbitration_prelock_v3 "${v3_three_bounty}" "${v3_three_claim}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "$(v3_final_field)"
  printf '3/3 three-vote settlement acceptance: PASS\n'; record_event "v3-3of3-three-vote-acceptance" "passed"
  v3_disclose_and_reproduce "v3-final-3of3" "${v3_three_bounty}" "${v3_three_claim}"
  execute_accepted "v3-final-3of3-settle" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${arbiter_three_key}" "Arbiter 3" "${arbiter_three_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" settle_reward_v3 "${v3_three_bounty}" "${v3_three_claim}" "${WHITEHAT_ADDRESS}" 3000000u64 0u64 3u8 "$(v3_final_field)"
  assert_mapping_matches "v3-final-3of3-all-resolved" bounty_claim_counts "${v3_three_bounty}" "0u64"
  v3_close_and_refund "v3-final-3of3" "${v3_three_bounty}" "${v3_three_deadline_height}" 2000000u64 "$(v3_final_field)"
  assert_balance_delta "v3-final-all-credits-conservation" "${all_program_before}" "$(public_credits_balance "${PROGRAM_ID}")" 0
  printf 'Credits conservation: 0 microcredits\n'; record_event "v3-final-credits-conservation" "0"
  harness_time_track_end quorum-3
  fi

  non_arbiter_key=""; arbiter_two_key="${arbiter_two_key}"; arbiter_three_key="${arbiter_three_key}"
  V3_FINAL_COVERAGE_PASSED=1
  if [[ "${shard}" == "all" ]]; then
    printf 'Protocol V3 R2 FINAL DYNAMIC COVERAGE: PASS\n'
    record_event "protocol-v3-r2-final-dynamic-coverage" "passed"
  else
    printf 'Protocol V3 R2 FINAL DYNAMIC SHARD %s: PASS\n' "${shard}"
    record_event "protocol-v3-r2-final-dynamic-shard-${shard}" "passed"
  fi
}
