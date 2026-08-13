#!/usr/bin/env bash

# Development-only V3 scenarios. This file is sourced by the localhost harness
# after a fresh or validated common bootstrap. Every scenario builds its own
# Bounty/Claim path; it never resumes an arbitrary business state.

v3_dev_require_arity() {
  (($# == 2)) || die "v3_dev_require_arity expects a scenario label and expected count"
}

v3_dev_prepare_panel() {
  (($# == 0)) || die "v3_dev_prepare_panel takes no arguments"
  generate_ephemeral_local_account DEV_ARBITER_TWO_KEY DEV_ARBITER_TWO_ADDRESS "ephemeral development Arbiter 2"
  generate_ephemeral_local_account DEV_ARBITER_THREE_KEY DEV_ARBITER_THREE_ADDRESS "ephemeral development Arbiter 3"
  [[ "${DEV_ARBITER_TWO_ADDRESS}" != "${ARBITER_ADDRESS}" &&
     "${DEV_ARBITER_THREE_ADDRESS}" != "${ARBITER_ADDRESS}" &&
     "${DEV_ARBITER_TWO_ADDRESS}" != "${DEV_ARBITER_THREE_ADDRESS}" ]] \
    || die "development arbitrator identities must be distinct"
  execute_accepted "v3-dev-bootstrap-arbiter-two" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" credits.aleo::transfer_public "${DEV_ARBITER_TWO_ADDRESS}" 500000000u64
  execute_accepted "v3-dev-bootstrap-arbiter-three" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" credits.aleo::transfer_public "${DEV_ARBITER_THREE_ADDRESS}" 500000000u64
}

v3_dev_create_bounty() {
  (($# == 3)) || die "v3_dev_create_bounty expects result prefix, quorum, and funding amount"
  local prefix="$1" quorum="$2" funding="$3"
  local deadline_height="" deadline="" bounty="" scope="" target_system="" target_code="" panel="" policy=""

  deadline_height=$((10#$(current_height) + 120))
  deadline="${deadline_height}u32"
  bounty="$(v3_final_field)"
  scope="$(v3_final_field)"
  target_system="$(v3_final_field)"
  target_code="$(v3_final_field)"
  panel="$(v3_final_field)"
  policy="{ disclosure_key_commitment: $(v3_final_field), target_system_commitment: ${target_system}, target_code_hash: ${target_code}, panel_id: ${panel}, arbiter_one: ${ARBITER_ADDRESS}, arbiter_two: ${DEV_ARBITER_TWO_ADDRESS}, arbiter_three: ${DEV_ARBITER_THREE_ADDRESS}, quorum: ${quorum}u8, review_window_blocks: 4u32, decision_window_blocks: 60u32, arbitration_fee_microcredits: 1000000u64, payment_condition: 1u8 }"
  execute_accepted "${prefix}-create-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" create_bounty_v3 "${bounty}" "${scope}" 1field \
    3000000u64 2000000u64 1000000u64 0u64 "${deadline}" "${policy}"
  execute_accepted "${prefix}-fund-bounty" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" fund_bounty_v3 "${bounty}" "${funding}u64" "$(v3_final_field)"
  assert_mapping_matches "${prefix}-config" bounty_v3_configs "${bounty}" \
    "panel_id:${panel}" "quorum:${quorum}u8" "arbiter_one:${ARBITER_ADDRESS}" \
    "arbiter_two:${DEV_ARBITER_TWO_ADDRESS}" "arbiter_three:${DEV_ARBITER_THREE_ADDRESS}"
  printf -v "${prefix}_BOUNTY" '%s' "${bounty}"
  printf -v "${prefix}_SCOPE" '%s' "${scope}"
  printf -v "${prefix}_TARGET_SYSTEM" '%s' "${target_system}"
  printf -v "${prefix}_TARGET_CODE" '%s' "${target_code}"
  printf -v "${prefix}_DEADLINE" '%s' "${deadline_height}"
}

v3_dev_read_bounty_context() {
  (($# == 5)) || die "v3_dev_read_bounty_context expects prefix and four result variables"
  local prefix="$1" bounty_var="$2" scope_var="$3" target_system_var="$4" target_code_var="$5"
  local bounty_name="${prefix}_BOUNTY" scope_name="${prefix}_SCOPE"
  local target_system_name="${prefix}_TARGET_SYSTEM" target_code_name="${prefix}_TARGET_CODE"

  [[ -v "${bounty_name}" && -v "${scope_name}" && -v "${target_system_name}" && -v "${target_code_name}" ]] \
    || die "development bounty context is incomplete for prefix ${prefix}"
  printf -v "${bounty_var}" '%s' "${!bounty_name}"
  printf -v "${scope_var}" '%s' "${!scope_name}"
  printf -v "${target_system_var}" '%s' "${!target_system_name}"
  printf -v "${target_code_var}" '%s' "${!target_code_name}"
}
v3_dev_open_rejection_dispute() {
  (($# == 2)) || die "v3_dev_open_rejection_dispute expects label and result prefix"
  local label="$1" prefix="$2" claim="" commitment="" marker=""
  local bounty="" scope="" target_system="" target_code=""

  v3_dev_read_bounty_context "${prefix}" bounty scope target_system target_code

  v3_submit_final_claim "${label}" claim "${bounty}" "${scope}" "${target_system}" "${target_code}"
  v3_review_final_claim "${label}-review" "${bounty}" "${claim}" 3 0
  commitment="$(v3_final_field)"
  marker="$(v3_final_field)"
  v3_open_final_dispute "${label}-open" "${bounty}" "${claim}" 1 0 \
    "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${commitment}" "${marker}"
  assert_v3_dispute_persistence "REJECTION" "${bounty}" "${claim}" 1 "${commitment}" "${WHITEHAT_ADDRESS}" 13 2
  printf -v "${prefix}_CLAIM" '%s' "${claim}"
}

v3_dev_prepare_reproduction_claim() {
  (($# == 2)) || die "v3_dev_prepare_reproduction_claim expects label and result prefix"
  local label="$1" prefix="$2" claim="" commitment="" marker=""
  local bounty="" scope="" target_system="" target_code=""

  v3_dev_read_bounty_context "${prefix}" bounty scope target_system target_code

  v3_submit_final_claim "${label}" claim "${bounty}" "${scope}" "${target_system}" "${target_code}"
  v3_review_final_claim "${label}-accept" "${bounty}" "${claim}" 2 3
  execute_accepted "${label}-lock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" lock_reward_v3 "${bounty}" "${claim}" 3000000u64 "$(v3_final_field)"
  execute_accepted "${label}-deliver" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" \
    "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" disclosure_action_v3 "${bounty}" "${claim}" 1u8 "$(v3_final_field)" "$(v3_final_field)"
  execute_accepted "${label}-ack" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" disclosure_action_v3 "${bounty}" "${claim}" 2u8 "$(v3_final_field)" "$(v3_final_field)"
  execute_accepted "${label}-reject-reproduction" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" resolution_action_v3 "${bounty}" "${claim}" 2u8 "$(v3_final_field)" "$(v3_final_field)"
  commitment="$(v3_final_field)"
  marker="$(v3_final_field)"
  v3_open_final_dispute "${label}-open" "${bounty}" "${claim}" 5 0 \
    "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${commitment}" "${marker}"
  assert_v3_dispute_persistence "REPRODUCTION" "${bounty}" "${claim}" 5 "${commitment}" "${WHITEHAT_ADDRESS}" 8 6
  printf -v "${prefix}_CLAIM" '%s' "${claim}"
}

v3_dev_vote_two_of_three() {
  (($# == 4)) || die "v3_dev_vote_two_of_three expects label, bounty, claim, and verdict"
  local label="$1" bounty="$2" claim="$3" verdict="$4"
  v3_cast_vote "${label}-arbiter-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${bounty}" "${claim}" "${verdict}" "$(v3_final_field)"
  v3_cast_vote "${label}-arbiter-two" "${DEV_ARBITER_TWO_KEY}" "Arbiter 2" "${DEV_ARBITER_TWO_ADDRESS}" "${bounty}" "${claim}" "${verdict}" "$(v3_final_field)"
}

scenario_reproduction() {
  local DEV_BOUNTY="" DEV_CLAIM=""
  v3_dev_prepare_panel
  v3_dev_create_bounty DEV 2 10000000
  v3_dev_prepare_reproduction_claim "v3-dev-reproduction" DEV
  assert_mapping_matches "v3-dev-reproduction-state" claim_v3_states "${DEV_CLAIM}" "status:11u8" "pre_dispute_status:8u8"
  printf 'v3 development reproduction: PASS\n'
}

scenario_non_arbiter() {
  local DEV_BOUNTY="" DEV_CLAIM="" outsider_key="" outsider_address="" tally_before="" state_before=""
  v3_dev_prepare_panel
  generate_ephemeral_local_account outsider_key outsider_address "ephemeral development non-arbiter"
  [[ "${outsider_address}" != "${ARBITER_ADDRESS}" && "${outsider_address}" != "${DEV_ARBITER_TWO_ADDRESS}" && "${outsider_address}" != "${DEV_ARBITER_THREE_ADDRESS}" ]] \
    || die "development non-arbiter unexpectedly belongs to panel"
  execute_accepted "v3-dev-non-arbiter-fund" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" \
    "${MINIMUM_OWNER_MICROCREDITS}" credits.aleo::transfer_public "${outsider_address}" 500000000u64
  v3_dev_create_bounty DEV 2 10000000
  v3_dev_open_rejection_dispute "v3-dev-non-arbiter" DEV
  capture_mapping tally_before claim_v3_arbitration_tallies "${DEV_CLAIM}"
  capture_mapping state_before claim_v3_states "${DEV_CLAIM}"
  expect_chain_rejected "v3-dev-non-arbiter-vote" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${outsider_key}" "Non-arbiter" "${outsider_address}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute cast_arbitration_vote_v3 "${DEV_BOUNTY}" "${DEV_CLAIM}" 3u8 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-dev-non-arbiter-tally" claim_v3_arbitration_tallies "${DEV_CLAIM}" "${tally_before}"
  assert_mapping_unchanged "v3-dev-non-arbiter-state" claim_v3_states "${DEV_CLAIM}" "${state_before}"
  printf 'v3 development non-arbiter: PASS\n'
}

scenario_duplicate_vote() {
  local DEV_BOUNTY="" DEV_CLAIM="" tally_before=""
  v3_dev_prepare_panel
  v3_dev_create_bounty DEV 2 10000000
  v3_dev_open_rejection_dispute "v3-dev-duplicate-vote" DEV
  v3_cast_vote "v3-dev-duplicate-vote-first" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${DEV_BOUNTY}" "${DEV_CLAIM}" 3 "$(v3_final_field)"
  capture_mapping tally_before claim_v3_arbitration_tallies "${DEV_CLAIM}"
  expect_chain_rejected "v3-dev-duplicate-vote-replay" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute cast_arbitration_vote_v3 "${DEV_BOUNTY}" "${DEV_CLAIM}" 3u8 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-dev-duplicate-vote-tally" claim_v3_arbitration_tallies "${DEV_CLAIM}" "${tally_before}"
  printf 'v3 development duplicate-vote: PASS\n'
}

scenario_quorum_2() {
  local DEV_BOUNTY="" DEV_CLAIM="" tally_before="" nonce=""
  v3_dev_prepare_panel
  v3_dev_create_bounty DEV 2 10000000
  v3_dev_open_rejection_dispute "v3-dev-quorum-2" DEV
  v3_cast_vote "v3-dev-quorum-2-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${DEV_BOUNTY}" "${DEV_CLAIM}" 3 "$(v3_final_field)"
  capture_mapping tally_before claim_v3_arbitration_tallies "${DEV_CLAIM}"
  nonce="$(v3_final_field)"
  expect_chain_rejected "v3-dev-quorum-2-one-vote-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${DEV_ARBITER_THREE_KEY}" "Arbiter 3" "${DEV_ARBITER_THREE_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute finalize_arbitration_prelock_v3 "${DEV_BOUNTY}" "${DEV_CLAIM}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "${nonce}" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-dev-quorum-2-one-vote-tally" claim_v3_arbitration_tallies "${DEV_CLAIM}" "${tally_before}"
  v3_cast_vote "v3-dev-quorum-2-two" "${DEV_ARBITER_TWO_KEY}" "Arbiter 2" "${DEV_ARBITER_TWO_ADDRESS}" "${DEV_BOUNTY}" "${DEV_CLAIM}" 3 "$(v3_final_field)"
  execute_accepted "v3-dev-quorum-2-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${DEV_ARBITER_THREE_KEY}" "Arbiter 3" "${DEV_ARBITER_THREE_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    finalize_arbitration_prelock_v3 "${DEV_BOUNTY}" "${DEV_CLAIM}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "$(v3_final_field)"
  assert_mapping_matches "v3-dev-quorum-2-locked" claim_v3_states "${DEV_CLAIM}" "status:4u8"
  printf 'v3 development quorum-2: PASS\n'
}

scenario_quorum_3() {
  local DEV_BOUNTY="" DEV_CLAIM="" tally_before=""
  v3_dev_prepare_panel
  v3_dev_create_bounty DEV 3 10000000
  v3_dev_open_rejection_dispute "v3-dev-quorum-3" DEV
  v3_cast_vote "v3-dev-quorum-3-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${DEV_BOUNTY}" "${DEV_CLAIM}" 3 "$(v3_final_field)"
  v3_cast_vote "v3-dev-quorum-3-two" "${DEV_ARBITER_TWO_KEY}" "Arbiter 2" "${DEV_ARBITER_TWO_ADDRESS}" "${DEV_BOUNTY}" "${DEV_CLAIM}" 3 "$(v3_final_field)"
  capture_mapping tally_before claim_v3_arbitration_tallies "${DEV_CLAIM}"
  expect_chain_rejected "v3-dev-quorum-3-two-vote-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${DEV_ARBITER_THREE_KEY}" "Arbiter 3" "${DEV_ARBITER_THREE_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute finalize_arbitration_prelock_v3 "${DEV_BOUNTY}" "${DEV_CLAIM}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-dev-quorum-3-two-vote-tally" claim_v3_arbitration_tallies "${DEV_CLAIM}" "${tally_before}"
  v3_cast_vote "v3-dev-quorum-3-three" "${DEV_ARBITER_THREE_KEY}" "Arbiter 3" "${DEV_ARBITER_THREE_ADDRESS}" "${DEV_BOUNTY}" "${DEV_CLAIM}" 3 "$(v3_final_field)"
  execute_accepted "v3-dev-quorum-3-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${DEV_ARBITER_THREE_KEY}" "Arbiter 3" "${DEV_ARBITER_THREE_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    finalize_arbitration_prelock_v3 "${DEV_BOUNTY}" "${DEV_CLAIM}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "$(v3_final_field)"
  assert_mapping_matches "v3-dev-quorum-3-locked" claim_v3_states "${DEV_CLAIM}" "status:4u8"
  printf 'v3 development quorum-3: PASS\n'
}

scenario_atomicity() {
  local DEV_BOUNTY="" DEV_CLAIM="" tally_before="" state_before="" escrow_before="" program_before=""
  v3_dev_prepare_panel
  v3_dev_create_bounty DEV 2 10000000
  v3_dev_open_rejection_dispute "v3-dev-atomicity" DEV
  v3_cast_vote "v3-dev-atomicity-one" "${ARBITER_PRIVATE_KEY}" "Arbiter 1" "${ARBITER_ADDRESS}" "${DEV_BOUNTY}" "${DEV_CLAIM}" 3 "$(v3_final_field)"
  capture_mapping tally_before claim_v3_arbitration_tallies "${DEV_CLAIM}"
  capture_mapping state_before claim_v3_states "${DEV_CLAIM}"
  capture_mapping escrow_before bounty_escrows "${DEV_BOUNTY}"
  program_before="$(public_credits_balance "${PROGRAM_ID}")"
  expect_chain_rejected "v3-dev-atomicity-one-vote-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${DEV_ARBITER_THREE_KEY}" "Arbiter 3" "${DEV_ARBITER_THREE_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute finalize_arbitration_prelock_v3 "${DEV_BOUNTY}" "${DEV_CLAIM}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "$(v3_final_field)" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-dev-atomicity-tally" claim_v3_arbitration_tallies "${DEV_CLAIM}" "${tally_before}"
  assert_mapping_unchanged "v3-dev-atomicity-state" claim_v3_states "${DEV_CLAIM}" "${state_before}"
  assert_mapping_unchanged "v3-dev-atomicity-escrow" bounty_escrows "${DEV_BOUNTY}" "${escrow_before}"
  assert_balance_delta "v3-dev-atomicity-program" "${program_before}" "$(public_credits_balance "${PROGRAM_ID}")" 0
  printf 'v3 development atomicity: PASS\n'
}

scenario_settlement_replay() {
  local DEV_BOUNTY="" DEV_CLAIM="" escrow_before="" state_before="" nonce=""
  v3_dev_prepare_panel
  v3_dev_create_bounty DEV 2 10000000
  v3_dev_open_rejection_dispute "v3-dev-settlement-replay" DEV
  v3_dev_vote_two_of_three "v3-dev-settlement-replay" "${DEV_BOUNTY}" "${DEV_CLAIM}" 3
  execute_accepted "v3-dev-settlement-replay-prelock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${DEV_ARBITER_THREE_KEY}" "Arbiter 3" "${DEV_ARBITER_THREE_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    finalize_arbitration_prelock_v3 "${DEV_BOUNTY}" "${DEV_CLAIM}" "${WHITEHAT_ADDRESS}" 3000000u64 1000000u64 3u8 "$(v3_final_field)"
  v3_disclose_and_reproduce "v3-dev-settlement-replay" "${DEV_BOUNTY}" "${DEV_CLAIM}"
  nonce="$(v3_final_field)"
  execute_accepted "v3-dev-settlement-replay-settle" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${DEV_ARBITER_THREE_KEY}" "Arbiter 3" "${DEV_ARBITER_THREE_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    settle_reward_v3 "${DEV_BOUNTY}" "${DEV_CLAIM}" "${WHITEHAT_ADDRESS}" 3000000u64 0u64 3u8 "${nonce}"
  capture_mapping escrow_before bounty_escrows "${DEV_BOUNTY}"
  capture_mapping state_before claim_v3_states "${DEV_CLAIM}"
  expect_chain_rejected "v3-dev-settlement-replay-replay" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID \
    "${CANDIDATE_DIR}" "${DEV_ARBITER_THREE_KEY}" "Arbiter 3" "${DEV_ARBITER_THREE_ADDRESS}" "${MINIMUM_ROLE_TRANSACTION_MICROCREDITS}" \
    execute settle_reward_v3 "${DEV_BOUNTY}" "${DEV_CLAIM}" "${WHITEHAT_ADDRESS}" 3000000u64 0u64 3u8 "${nonce}" --skip-execute-proof --broadcast --yes
  assert_mapping_unchanged "v3-dev-settlement-replay-escrow" bounty_escrows "${DEV_BOUNTY}" "${escrow_before}"
  assert_mapping_unchanged "v3-dev-settlement-replay-state" claim_v3_states "${DEV_CLAIM}" "${state_before}"
  printf 'v3 development settlement-replay: PASS\n'
}

scenario_refund_replay() {
  local DEV_BOUNTY="" DEV_DEADLINE=""
  v3_dev_prepare_panel
  v3_dev_create_bounty DEV 2 7000000
  v3_close_and_refund "v3-dev-refund-replay" "${DEV_BOUNTY}" "${DEV_DEADLINE}" 7000000u64 "$(v3_final_field)"
  printf 'v3 development refund-replay: PASS\n'
}

scenario_dispute_types() {
  local DEV_BOUNTY="" DEV_SCOPE="" DEV_TARGET_SYSTEM="" DEV_TARGET_CODE="" claim="" commitment="" marker="" type action pre decision
  v3_dev_prepare_panel
  v3_dev_create_bounty DEV 2 30000000
  for type in 1 2 3 4; do
    v3_submit_final_claim "v3-dev-dispute-${type}" claim "${DEV_BOUNTY}" "${DEV_SCOPE}" "${DEV_TARGET_SYSTEM}" "${DEV_TARGET_CODE}"
    case "${type}" in
      1) action=3; pre=13; decision=2 ;;
      2) action=4; pre=13; decision=3 ;;
      3) action=5; pre=13; decision=4 ;;
      4) action=6; pre=3; decision=5 ;;
    esac
    v3_review_final_claim "v3-dev-dispute-${type}-review" "${DEV_BOUNTY}" "${claim}" "${action}" "$([[ "${type}" == 4 ]] && printf 1 || printf 0)"
    commitment="$(v3_final_field)"; marker="$(v3_final_field)"
    v3_open_final_dispute "v3-dev-dispute-${type}-open" "${DEV_BOUNTY}" "${claim}" "${type}" "$([[ "${type}" == 4 ]] && printf 2 || printf 0)" \
      "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${commitment}" "${marker}"
    assert_v3_dispute_persistence "DEV-TYPE-${type}" "${DEV_BOUNTY}" "${claim}" "${type}" "${commitment}" "${WHITEHAT_ADDRESS}" "${pre}" "${decision}"
  done
  # Type 5 and 6 require the disclosure/reproduction lifecycle, not a shortcut.
  v3_submit_final_claim "v3-dev-dispute-5" claim "${DEV_BOUNTY}" "${DEV_SCOPE}" "${DEV_TARGET_SYSTEM}" "${DEV_TARGET_CODE}"
  v3_review_final_claim "v3-dev-dispute-5-accept" "${DEV_BOUNTY}" "${claim}" 2 3
  execute_accepted "v3-dev-dispute-5-lock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" lock_reward_v3 "${DEV_BOUNTY}" "${claim}" 3000000u64 "$(v3_final_field)"
  v3_disclose_and_reproduce "v3-dev-dispute-5" "${DEV_BOUNTY}" "${claim}"
  execute_accepted "v3-dev-dispute-5-reject" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" resolution_action_v3 "${DEV_BOUNTY}" "${claim}" 2u8 "$(v3_final_field)" "$(v3_final_field)"
  commitment="$(v3_final_field)"; marker="$(v3_final_field)"
  v3_open_final_dispute "v3-dev-dispute-5-open" "${DEV_BOUNTY}" "${claim}" 5 0 "${WHITEHAT_PRIVATE_KEY}" "Whitehat" "${WHITEHAT_ADDRESS}" "${commitment}" "${marker}"
  assert_v3_dispute_persistence "DEV-TYPE-5" "${DEV_BOUNTY}" "${claim}" 5 "${commitment}" "${WHITEHAT_ADDRESS}" 8 6
  v3_submit_final_claim "v3-dev-dispute-6" claim "${DEV_BOUNTY}" "${DEV_SCOPE}" "${DEV_TARGET_SYSTEM}" "${DEV_TARGET_CODE}"
  v3_review_final_claim "v3-dev-dispute-6-accept" "${DEV_BOUNTY}" "${claim}" 2 3
  execute_accepted "v3-dev-dispute-6-lock" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" lock_reward_v3 "${DEV_BOUNTY}" "${claim}" 3000000u64 "$(v3_final_field)"
  v3_disclose_and_reproduce "v3-dev-dispute-6" "${DEV_BOUNTY}" "${claim}"
  execute_accepted "v3-dev-dispute-6-patch" STEP_TX_ID STEP_FEE_ID STEP_FEE_TX_ID "${CANDIDATE_DIR}" "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${MINIMUM_OWNER_MICROCREDITS}" resolution_action_v3 "${DEV_BOUNTY}" "${claim}" 3u8 "$(v3_final_field)" "$(v3_final_field)"
  advance_blocks 5
  commitment="$(v3_final_field)"; marker="$(v3_final_field)"
  v3_open_final_dispute "v3-dev-dispute-6-open" "${DEV_BOUNTY}" "${claim}" 6 0 "${OWNER_PRIVATE_KEY}" "Owner" "${OWNER_ADDRESS}" "${commitment}" "${marker}"
  assert_v3_dispute_persistence "DEV-TYPE-6" "${DEV_BOUNTY}" "${claim}" 6 "${commitment}" "${OWNER_ADDRESS}" 9 7
  printf 'v3 development dispute-types: PASS\n'
}

run_protocol_v3_development_scenario() {
  (($# == 1)) || die "run_protocol_v3_development_scenario expects one scenario"
  local scenario="$1"
  local STEP_TX_ID="" STEP_FEE_ID="" STEP_FEE_TX_ID=""
  local DEV_ARBITER_TWO_KEY="" DEV_ARBITER_TWO_ADDRESS="" DEV_ARBITER_THREE_KEY="" DEV_ARBITER_THREE_ADDRESS=""

  case "${scenario}" in
    reproduction) scenario_reproduction ;;
    dispute-types) scenario_dispute_types ;;
    quorum-2) scenario_quorum_2 ;;
    quorum-3) scenario_quorum_3 ;;
    non-arbiter) scenario_non_arbiter ;;
    duplicate-vote) scenario_duplicate_vote ;;
    settlement-replay) scenario_settlement_replay ;;
    refund-replay) scenario_refund_replay ;;
    atomicity) scenario_atomicity ;;
    *) die "unsupported V3 development scenario: ${scenario}" ;;
  esac
  DEV_ARBITER_TWO_KEY=""
  DEV_ARBITER_THREE_KEY=""
  printf 'Protocol V3 development scenario %s: PASS\n' "${scenario}"
}
