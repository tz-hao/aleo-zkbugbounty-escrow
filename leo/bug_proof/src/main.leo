import credits.aleo;

struct ProofResult {
    verified: bool,
    severity: u8,
    claim_hash: field,
    witness_commitment: field,
    nullifier: field,
    reporter_commitment: field,
    bug_type_id: field,
    rule_id: field,
}

struct BountyState {
    owner_address: address,
    scope_hash: field,
    rule_id: field,
    critical_reward: u64,
    high_reward: u64,
    medium_reward: u64,
    low_reward: u64,
    disclosure_deadline: u32,
    status: u8,
}

struct ClaimReceiptState {
    claim_hash: field,
    bounty_id: field,
    rule_id: field,
    scope_hash: field,
    severity: u8,
    witness_commitment: field,
    nullifier: field,
    reporter_commitment: field,
    proof_status: u8,
    created_height: u32,
    protocol_version: u8,
}

struct BountyEscrowState {
    owner_address: address,
    total_funded: u64,
    available_balance: u64,
    locked_amount: u64,
    paid_amount: u64,
    refunded_amount: u64,
    status: u8,
    last_funding_height: u32,
    last_funding_marker: field,
    last_refund_marker: field,
}

struct ClaimPayoutState {
    claim_hash: field,
    bounty_id: field,
    whitehat_address: address,
    reward_amount: u64,
    status: u8,
    locked_height: u32,
    paid_height: u32,
    release_marker: field,
}

struct ClaimTriageState {
    claim_hash: field,
    bounty_id: field,
    status: u8,
    package_hash: field,
    updated_height: u32,
}

// V3 keeps external target bindings and responsible-disclosure state separate
// from the immutable V1/V2 receipt and escrow schemas.
struct ProofResultV3 {
    verified: bool,
    severity: u8,
    claim_hash: field,
    witness_commitment: field,
    nullifier: field,
    reporter_commitment: field,
    target_system_commitment: field,
    target_state_commitment: field,
    target_code_hash: field,
    execution_commitment: field,
    report_commitment: field,
}

struct BountyV3PolicyInput {
    disclosure_key_commitment: field,
    target_system_commitment: field,
    target_code_hash: field,
    panel_id: field,
    arbiter_one: address,
    arbiter_two: address,
    arbiter_three: address,
    quorum: u8,
    review_window_blocks: u32,
    decision_window_blocks: u32,
    arbitration_fee_microcredits: u64,
    payment_condition: u8,
}

struct ClaimV3BindingInput {
    target_system_commitment: field,
    target_state_commitment: field,
    target_code_hash: field,
    execution_commitment: field,
    report_commitment: field,
}

struct VaultWitnessInput {
    vault_balance_before: u64,
    total_deposits_before: u64,
    total_claims_before: u64,
    reserved_rewards_before: u64,
    withdraw_limit_before: u64,
    user_balance_before: u64,
    requested_withdraw_before: u64,
    hidden_delta_balance: u64,
    hidden_delta_claims: u64,
    hidden_delta_reserved_rewards: u64,
    hidden_delta_withdraw_amount: u64,
    hidden_delta_user_balance: u64,
    reporter_secret: field,
}

struct BountyV3Config {
    bounty_id: field,
    disclosure_key_commitment: field,
    target_system_commitment: field,
    target_code_hash: field,
    panel_id: field,
    arbiter_one: address,
    arbiter_two: address,
    arbiter_three: address,
    quorum: u8,
    review_window_blocks: u32,
    decision_window_blocks: u32,
    arbitration_fee_microcredits: u64,
    payment_condition: u8,
    configured_height: u32,
}

struct ClaimV3Evidence {
    claim_hash: field,
    bounty_id: field,
    target_system_commitment: field,
    target_state_commitment: field,
    target_code_hash: field,
    execution_commitment: field,
    report_commitment: field,
    submitted_height: u32,
}

struct ClaimV3State {
    claim_hash: field,
    bounty_id: field,
    whitehat_address: address,
    status: u8,
    pre_dispute_status: u8,
    package_hash: field,
    reproduction_commitment: field,
    patch_commitment: field,
    dispute_commitment: field,
    updated_height: u32,
}

struct ClaimV3PayoutState {
    claim_hash: field,
    bounty_id: field,
    whitehat_address: address,
    reserved_amount: u64,
    paid_amount: u64,
    status: u8,
    locked_height: u32,
    paid_height: u32,
    release_marker: field,
}

struct ClaimV3ArbitrationTally {
    claim_hash: field,
    bounty_id: field,
    reject_votes: u8,
    medium_votes: u8,
    high_votes: u8,
    critical_votes: u8,
    updated_height: u32,
}

struct ClaimV3ArbitrationVote {
    claim_hash: field,
    bounty_id: field,
    voter: address,
    verdict: u8,
    vote_height: u32,
    vote_marker: field,
}

struct ClaimV3DisputeBond {
    claim_hash: field,
    bounty_id: field,
    payer: address,
    amount: u64,
    status: u8,
    settled_height: u32,
}

// Project decisions are public routing facts. Their detailed evidence remains
// a commitment; this mapping never contains a report, PoC, or patch plaintext.
// decision: 1 accepted, 2 rejection, 3 duplicate, 4 out-of-scope,
// 5 severity assessment, 6 cannot reproduce, 7 remediation proposed.
struct ClaimV3ProjectDecision {
    claim_hash: field,
    bounty_id: field,
    decision: u8,
    project_severity: u8,
    decision_commitment: field,
    decided_height: u32,
}

// dispute_type: 1 rejection, 2 duplicate, 3 scope, 4 severity,
// 5 reproduction, 6 remediation. status: 1 open, 2 accepted, 3 rejected.
struct ClaimV3DisputeMetadata {
    claim_hash: field,
    bounty_id: field,
    dispute_type: u8,
    dispute_commitment: field,
    opener: address,
    opened_height: u32,
    status: u8,
    requested_severity: u8,
    final_severity: u8,
}

fn compute_vault_invariant_break(
        bounty_id: field,
        scope_hash: field,
        rule_id: field,
        vault_balance_before: u64,
        total_deposits_before: u64,
        total_claims_before: u64,
        reserved_rewards_before: u64,
        withdraw_limit_before: u64,
        user_balance_before: u64,
        requested_withdraw_before: u64,
        hidden_delta_balance: u64,
        hidden_delta_claims: u64,
        hidden_delta_reserved_rewards: u64,
        hidden_delta_withdraw_amount: u64,
        hidden_delta_user_balance: u64,
        reporter_secret: field,
    ) -> ProofResult {
        let state_commitment: field = Poseidon8::hash_to_field([
            vault_balance_before as field,
            total_deposits_before as field,
            total_claims_before as field,
            reserved_rewards_before as field,
            withdraw_limit_before as field,
            user_balance_before as field,
            requested_withdraw_before as field,
            101field,
        ]);
        let delta_commitment: field = Poseidon8::hash_to_field([
            hidden_delta_balance as field,
            hidden_delta_claims as field,
            hidden_delta_reserved_rewards as field,
            hidden_delta_withdraw_amount as field,
            hidden_delta_user_balance as field,
            bounty_id,
            scope_hash,
            rule_id,
        ]);
        let reporter_commitment: field = Poseidon2::hash_to_field([
            102field,
            reporter_secret,
        ]);
        let witness_commitment: field = Poseidon4::hash_to_field([
            103field,
            state_commitment,
            delta_commitment,
            reporter_commitment,
        ]);
        let nullifier: field = Poseidon4::hash_to_field([
            104field,
            bounty_id,
            rule_id,
            reporter_secret,
        ]);
        let bug_type_id: field = rule_id;

        let arithmetic_valid: bool =
            hidden_delta_balance <= vault_balance_before &&
            hidden_delta_user_balance <= user_balance_before;
        assert(arithmetic_valid);

        let vault_balance_after: u128 =
            (vault_balance_before as u128).sub_wrapped(hidden_delta_balance as u128);
        let total_deposits_after: u128 = total_deposits_before as u128;
        let total_claims_after: u128 =
            total_claims_before as u128 + hidden_delta_claims as u128;
        let reserved_rewards_after: u128 =
            reserved_rewards_before as u128 + hidden_delta_reserved_rewards as u128;
        let withdraw_limit_after: u128 = withdraw_limit_before as u128;
        let user_balance_after: u128 =
            (user_balance_before as u128).sub_wrapped(hidden_delta_user_balance as u128);
        let requested_withdraw_after: u128 =
            requested_withdraw_before as u128 + hidden_delta_withdraw_amount as u128;

        let is_vault_rule: bool = rule_id == 1field;
        let is_claims_rule: bool = rule_id == 2field;
        let is_reserve_rule: bool = rule_id == 3field;
        let is_withdraw_rule: bool = rule_id == 4field;
        let supported_rule: bool =
            is_vault_rule || is_claims_rule || is_reserve_rule || is_withdraw_rule;

        let vault_initial_valid: bool = vault_balance_before >= total_claims_before;
        let vault_broken: bool = vault_balance_after < total_claims_after;
        let vault_impact: u128 = vault_broken
            ? total_claims_after.sub_wrapped(vault_balance_after)
            : 0u128;

        let claims_initial_valid: bool = total_claims_before <= total_deposits_before;
        let claims_broken: bool = total_claims_after > total_deposits_after;
        let claims_impact: u128 = claims_broken
            ? total_claims_after.sub_wrapped(total_deposits_after)
            : 0u128;

        let reserve_initial_valid: bool = reserved_rewards_before <= vault_balance_before;
        let reserve_broken: bool = reserved_rewards_after > vault_balance_after;
        let reserve_impact: u128 = reserve_broken
            ? reserved_rewards_after.sub_wrapped(vault_balance_after)
            : 0u128;

        let withdraw_initial_valid: bool =
            requested_withdraw_before <= withdraw_limit_before &&
            requested_withdraw_before <= user_balance_before;
        let limit_broken: bool = requested_withdraw_after > withdraw_limit_after;
        let balance_broken: bool = requested_withdraw_after > user_balance_after;
        let withdraw_broken: bool = limit_broken || balance_broken;
        let limit_impact: u128 = limit_broken
            ? requested_withdraw_after.sub_wrapped(withdraw_limit_after)
            : 0u128;
        let balance_impact: u128 = balance_broken
            ? requested_withdraw_after.sub_wrapped(user_balance_after)
            : 0u128;
        let withdraw_impact: u128 =
            limit_impact > balance_impact ? limit_impact : balance_impact;

        let initial_state_valid: bool =
            (is_vault_rule && vault_initial_valid) ||
            (is_claims_rule && claims_initial_valid) ||
            (is_reserve_rule && reserve_initial_valid) ||
            (is_withdraw_rule && withdraw_initial_valid);
        let invariant_broken: bool =
            (is_vault_rule && vault_broken) ||
            (is_claims_rule && claims_broken) ||
            (is_reserve_rule && reserve_broken) ||
            (is_withdraw_rule && withdraw_broken);
        let impact: u128 = is_vault_rule
            ? vault_impact
            : is_claims_rule
                ? claims_impact
                : is_reserve_rule
                    ? reserve_impact
                    : is_withdraw_rule ? withdraw_impact : 0u128;

        let severity: u8 =
            impact >= 100u128 ? 3u8 :
            impact >= 50u128 ? 2u8 :
            impact >= 10u128 ? 1u8 : 0u8;
        let verified: bool =
            supported_rule && arithmetic_valid && initial_state_valid && invariant_broken && severity >= 1u8;
        assert(verified);
        let claim_hash: field = Poseidon8::hash_to_field([
            105field,
            bounty_id,
            scope_hash,
            rule_id,
            witness_commitment,
            nullifier,
            severity as field,
            bug_type_id,
        ]);

        return ProofResult {
            verified: verified,
            severity: severity,
            claim_hash: claim_hash,
            witness_commitment: witness_commitment,
            nullifier: nullifier,
            reporter_commitment: reporter_commitment,
            bug_type_id: bug_type_id,
            rule_id: rule_id,
        };
    }

fn derive_operation_marker(
        operation_domain: field,
        bounty_id: field,
        claim_hash: field,
        caller: address,
        recipient: address,
        amount: u64,
        nonce: field,
    ) -> field {
        assert(nonce != 0field);
        let caller_commitment: field = BHP256::hash_to_field(caller);
        let recipient_commitment: field = BHP256::hash_to_field(recipient);
        return Poseidon8::hash_to_field([
            operation_domain,
            bounty_id,
            claim_hash,
            caller_commitment,
            recipient_commitment,
            amount as field,
            nonce,
            220field,
        ]);
    }

fn derive_v3_vote_key(
        bounty_id: field,
        dispute_id: field,
        voter: address,
    ) -> field {
        let voter_commitment: field = BHP256::hash_to_field(voter);
        return Poseidon4::hash_to_field([
            302field,
            bounty_id,
            dispute_id,
            voter_commitment,
        ]);
    }

// A dispute is keyed by a monotonically increasing per-claim round. This keeps
// every past ruling auditable without preventing a later, independent dispute.
fn derive_v3_dispute_id(
        bounty_id: field,
        claim_hash: field,
        round: u32,
    ) -> field {
        assert(round > 0u32);
        return Poseidon4::hash_to_field([
            333field,
            bounty_id,
            claim_hash,
            round as field,
        ]);
    }

fn reward_for_v3_severity(bounty: BountyState, severity: u8) -> u64 {
        assert(severity >= 1u8 && severity <= 3u8);
        return severity == 3u8
            ? bounty.critical_reward
            : severity == 2u8 ? bounty.high_reward : bounty.medium_reward;
    }

fn is_v3_panel_member(config: BountyV3Config, candidate: address) -> bool {
        return candidate == config.arbiter_one ||
            candidate == config.arbiter_two ||
            candidate == config.arbiter_three;
    }

fn v3_verdict_has_quorum(
        tally: ClaimV3ArbitrationTally,
        verdict: u8,
        quorum: u8,
    ) -> bool {
        let votes: u8 = verdict == 0u8
            ? tally.reject_votes
            : verdict == 1u8
                ? tally.medium_votes
                : verdict == 2u8 ? tally.high_votes : tally.critical_votes;
        return votes >= quorum;
    }

fn update_claim_v3_state(
        current: ClaimV3State,
        status: u8,
        package_hash: field,
        reproduction_commitment: field,
        patch_commitment: field,
        dispute_commitment: field,
        updated_height: u32,
    ) -> ClaimV3State {
        return ClaimV3State {
            claim_hash: current.claim_hash,
            bounty_id: current.bounty_id,
            whitehat_address: current.whitehat_address,
            status: status,
            pre_dispute_status: current.pre_dispute_status,
            package_hash: package_hash,
            reproduction_commitment: reproduction_commitment,
            patch_commitment: patch_commitment,
            dispute_commitment: dispute_commitment,
            updated_height: updated_height,
        };
    }

program zkbugbounty_7f3c92.aleo {





    mapping bounties: field => BountyState;
    mapping nullifiers: field => field;
    mapping claim_receipts: field => ClaimReceiptState;
    mapping bounty_escrows: field => BountyEscrowState;
    mapping claim_payouts: field => ClaimPayoutState;
    mapping bounty_claim_counts: field => u64;
    mapping claim_reporters: field => address;
    mapping claim_triage_states: field => ClaimTriageState;
    mapping bounty_protocol_versions: field => u8;
    mapping escrow_operation_markers: field => bool;
    mapping bounty_v3_configs: field => BountyV3Config;
    mapping claim_v3_evidence: field => ClaimV3Evidence;
    mapping claim_v3_states: field => ClaimV3State;
    mapping claim_v3_payouts: field => ClaimV3PayoutState;
    mapping claim_v3_arbitration_tallies: field => ClaimV3ArbitrationTally;
    mapping claim_v3_arbitration_votes: field => ClaimV3ArbitrationVote;
    mapping v3_operation_markers: field => bool;
    mapping claim_v3_acknowledgements: field => field;
    mapping claim_v3_dispute_bonds: field => ClaimV3DisputeBond;
    mapping claim_v3_project_decisions: field => ClaimV3ProjectDecision;
    mapping claim_v3_dispute_metadata: field => ClaimV3DisputeMetadata;
    // `rounds` stores the next round number; `active_disputes` resolves the
    // current (or most recently resolved) dispute record for public readers.
    mapping claim_v3_dispute_rounds: field => u32;
    mapping claim_v3_active_disputes: field => field;

    fn prove_vault_invariant_break(
        public bounty_id: field,
        public scope_hash: field,
        public rule_id: field,
        vault_balance_before: u64,
        total_deposits_before: u64,
        total_claims_before: u64,
        reserved_rewards_before: u64,
        withdraw_limit_before: u64,
        user_balance_before: u64,
        requested_withdraw_before: u64,
        hidden_delta_balance: u64,
        hidden_delta_claims: u64,
        hidden_delta_reserved_rewards: u64,
        hidden_delta_withdraw_amount: u64,
        hidden_delta_user_balance: u64,
        reporter_secret: field,
    ) -> public ProofResult {
        return compute_vault_invariant_break(
            bounty_id,
            scope_hash,
            rule_id,
            vault_balance_before,
            total_deposits_before,
            total_claims_before,
            reserved_rewards_before,
            withdraw_limit_before,
            user_balance_before,
            requested_withdraw_before,
            hidden_delta_balance,
            hidden_delta_claims,
            hidden_delta_reserved_rewards,
            hidden_delta_withdraw_amount,
            hidden_delta_user_balance,
            reporter_secret,
        );
    }

    fn submit_claim(
        public bounty_id: field,
        public scope_hash: field,
        public rule_id: field,
        vault_balance_before: u64,
        total_deposits_before: u64,
        total_claims_before: u64,
        reserved_rewards_before: u64,
        withdraw_limit_before: u64,
        user_balance_before: u64,
        requested_withdraw_before: u64,
        hidden_delta_balance: u64,
        hidden_delta_claims: u64,
        hidden_delta_reserved_rewards: u64,
        hidden_delta_withdraw_amount: u64,
        hidden_delta_user_balance: u64,
        reporter_secret: field,
    ) -> (public ProofResult, Final) {
        let proof: ProofResult = compute_vault_invariant_break(
            bounty_id,
            scope_hash,
            rule_id,
            vault_balance_before,
            total_deposits_before,
            total_claims_before,
            reserved_rewards_before,
            withdraw_limit_before,
            user_balance_before,
            requested_withdraw_before,
            hidden_delta_balance,
            hidden_delta_claims,
            hidden_delta_reserved_rewards,
            hidden_delta_withdraw_amount,
            hidden_delta_user_balance,
            reporter_secret,
        );
        let claim_hash: field = proof.claim_hash;
        let severity: u8 = proof.severity;
        let witness_commitment: field = proof.witness_commitment;
        let nullifier: field = proof.nullifier;
        let reporter_commitment: field = proof.reporter_commitment;

        return (proof, final {
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.scope_hash, scope_hash);
            assert_eq(bounty.rule_id, rule_id);
            assert_eq(bounty.status, 1u8);
            assert(std::ctx::block_height() <= bounty.disclosure_deadline);

            assert(!Mapping::contains(nullifiers, nullifier));
            assert(!Mapping::contains(claim_receipts, claim_hash));

            let receipt: ClaimReceiptState = ClaimReceiptState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                rule_id: rule_id,
                scope_hash: scope_hash,
                severity: severity,
                witness_commitment: witness_commitment,
                nullifier: nullifier,
                reporter_commitment: reporter_commitment,
                proof_status: 1u8,
                created_height: std::ctx::block_height(),
                protocol_version: 1u8,
            };
            Mapping::set(nullifiers, nullifier, bounty_id);
            Mapping::set(claim_receipts, claim_hash, receipt);
        });
    }

    fn submit_claim_v2(
        public bounty_id: field,
        public scope_hash: field,
        public rule_id: field,
        vault_balance_before: u64,
        total_deposits_before: u64,
        total_claims_before: u64,
        reserved_rewards_before: u64,
        withdraw_limit_before: u64,
        user_balance_before: u64,
        requested_withdraw_before: u64,
        hidden_delta_balance: u64,
        hidden_delta_claims: u64,
        hidden_delta_reserved_rewards: u64,
        hidden_delta_withdraw_amount: u64,
        hidden_delta_user_balance: u64,
        reporter_secret: field,
    ) -> (public ProofResult, Final) {
        let signer = std::ctx::signer();
        let proof: ProofResult = compute_vault_invariant_break(
            bounty_id,
            scope_hash,
            rule_id,
            vault_balance_before,
            total_deposits_before,
            total_claims_before,
            reserved_rewards_before,
            withdraw_limit_before,
            user_balance_before,
            requested_withdraw_before,
            hidden_delta_balance,
            hidden_delta_claims,
            hidden_delta_reserved_rewards,
            hidden_delta_withdraw_amount,
            hidden_delta_user_balance,
            reporter_secret,
        );
        let claim_hash: field = proof.claim_hash;
        let severity: u8 = proof.severity;
        let witness_commitment: field = proof.witness_commitment;
        let nullifier: field = proof.nullifier;
        let reporter_commitment: field = proof.reporter_commitment;

        return (proof, final {
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.scope_hash, scope_hash);
            assert_eq(bounty.rule_id, rule_id);
            assert_eq(bounty.status, 1u8);
            assert(std::ctx::block_height() <= bounty.disclosure_deadline);
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            let bounty_protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            assert_eq(bounty_protocol_version, 2u8);

            assert(!Mapping::contains(nullifiers, nullifier));
            assert(!Mapping::contains(claim_receipts, claim_hash));
            assert(!Mapping::contains(claim_reporters, claim_hash));
            assert(Mapping::contains(bounty_claim_counts, bounty_id));

            let receipt: ClaimReceiptState = ClaimReceiptState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                rule_id: rule_id,
                scope_hash: scope_hash,
                severity: severity,
                witness_commitment: witness_commitment,
                nullifier: nullifier,
                reporter_commitment: reporter_commitment,
                proof_status: 1u8,
                created_height: std::ctx::block_height(),
                protocol_version: bounty_protocol_version,
            };
            let claim_count: u64 = Mapping::get(bounty_claim_counts, bounty_id);
            Mapping::set(nullifiers, nullifier, bounty_id);
            Mapping::set(claim_receipts, claim_hash, receipt);
            Mapping::set(claim_reporters, claim_hash, signer);
            Mapping::set(bounty_claim_counts, bounty_id, claim_count + 1u64);
        });
    }

    fn create_bounty(
        public bounty_id: field,
        public scope_hash: field,
        public rule_id: field,
        public critical_reward: u64,
        public high_reward: u64,
        public medium_reward: u64,
        public low_reward: u64,
        public disclosure_deadline: u32,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(!Mapping::contains(bounties, bounty_id));

            let supported_rule: bool =
                rule_id == 1field ||
                rule_id == 2field ||
                rule_id == 3field ||
                rule_id == 4field;
            let valid_rewards: bool =
                critical_reward >= high_reward &&
                high_reward >= medium_reward &&
                medium_reward >= low_reward &&
                medium_reward > 0u64 &&
                low_reward == 0u64;
            assert(supported_rule);
            assert(valid_rewards);
            assert(disclosure_deadline > std::ctx::block_height());

            let bounty: BountyState = BountyState {
                owner_address: signer,
                scope_hash: scope_hash,
                rule_id: rule_id,
                critical_reward: critical_reward,
                high_reward: high_reward,
                medium_reward: medium_reward,
                low_reward: low_reward,
                disclosure_deadline: disclosure_deadline,
                status: 1u8,
            };
            Mapping::set(bounties, bounty_id, bounty);
            Mapping::set(bounty_claim_counts, bounty_id, 0u64);
            Mapping::set(bounty_protocol_versions, bounty_id, 2u8);
        };
    }

    fn pause_bounty(public bounty_id: field) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(Mapping::contains(bounties, bounty_id));
            let current: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(current.owner_address, signer);
            assert_eq(current.status, 1u8);

            let paused: BountyState = BountyState {
                owner_address: current.owner_address,
                scope_hash: current.scope_hash,
                rule_id: current.rule_id,
                critical_reward: current.critical_reward,
                high_reward: current.high_reward,
                medium_reward: current.medium_reward,
                low_reward: current.low_reward,
                disclosure_deadline: current.disclosure_deadline,
                status: 2u8,
            };
            Mapping::set(bounties, bounty_id, paused);
        };
    }

    fn close_bounty(public bounty_id: field) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(Mapping::contains(bounties, bounty_id));
            let current: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(current.owner_address, signer);
            assert(current.status == 1u8 || current.status == 2u8);

            let closed: BountyState = BountyState {
                owner_address: current.owner_address,
                scope_hash: current.scope_hash,
                rule_id: current.rule_id,
                critical_reward: current.critical_reward,
                high_reward: current.high_reward,
                medium_reward: current.medium_reward,
                low_reward: current.low_reward,
                disclosure_deadline: current.disclosure_deadline,
                status: 3u8,
            };
            Mapping::set(bounties, bounty_id, closed);
        };
    }

    // Edition 0 ABI is preserved but disabled before any Credits call.
    fn fund_bounty(
        public bounty_id: field,
        public amount: u64,
        public funding_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        assert_eq(amount, 0u64);
        assert_neq(amount, 0u64);
        let transfer: Final = credits.aleo::transfer_public_as_signer(
            zkbugbounty_7f3c92.aleo,
            amount,
        );
        return final {
            // This frozen Edition 0 finalizer has a Credits future as its
            // first public input on Testnet. Moving `transfer.run()` below
            // any check or mapping operation changes that immutable input
            // ordering and makes every later Edition incompatible. Its
            // transition is fail-closed (`amount == 0 && amount != 0`), so
            // no valid execution can ever reach this legacy finalizer.
            // Keep the historical ordering; active V2/V3 economic entries
            // remain CEI-ordered and are the only usable funding paths.
            transfer.run();
            assert(amount > 0u64);
            assert(funding_marker != 0field);
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.owner_address, signer);
            assert(bounty.status == 1u8 || bounty.status == 2u8);

            let empty: BountyEscrowState = BountyEscrowState {
                owner_address: signer,
                total_funded: 0u64,
                available_balance: 0u64,
                locked_amount: 0u64,
                paid_amount: 0u64,
                refunded_amount: 0u64,
                status: 1u8,
                last_funding_height: 0u32,
                last_funding_marker: 0field,
                last_refund_marker: 0field,
            };
            let current: BountyEscrowState = Mapping::get_or_use(
                bounty_escrows,
                bounty_id,
                empty,
            );
            assert_eq(current.owner_address, signer);
            let updated: BountyEscrowState = BountyEscrowState {
                owner_address: signer,
                total_funded: current.total_funded + amount,
                available_balance: current.available_balance + amount,
                locked_amount: current.locked_amount,
                paid_amount: current.paid_amount,
                refunded_amount: current.refunded_amount,
                status: 1u8,
                last_funding_height: std::ctx::block_height(),
                last_funding_marker: funding_marker,
                last_refund_marker: current.last_refund_marker,
            };
            Mapping::set(bounty_escrows, bounty_id, updated);
        };
    }

    fn fund_bounty_v2(
        public bounty_id: field,
        public amount: u64,
        public funding_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        let transfer: Final = credits.aleo::transfer_public_as_signer(
            zkbugbounty_7f3c92.aleo,
            amount,
        );
        return final {
            assert(amount > 0u64);
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.owner_address, signer);
            assert(bounty.status == 1u8 || bounty.status == 2u8);
            assert(std::ctx::block_height() <= bounty.disclosure_deadline);
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            let bounty_protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            assert_eq(bounty_protocol_version, 2u8);
            let operation_marker: field = derive_operation_marker(
                201field,
                bounty_id,
                0field,
                signer,
                signer,
                amount,
                funding_marker,
            );
            assert(!Mapping::contains(escrow_operation_markers, operation_marker));

            let empty: BountyEscrowState = BountyEscrowState {
                owner_address: signer,
                total_funded: 0u64,
                available_balance: 0u64,
                locked_amount: 0u64,
                paid_amount: 0u64,
                refunded_amount: 0u64,
                status: 1u8,
                last_funding_height: 0u32,
                last_funding_marker: 0field,
                last_refund_marker: 0field,
            };
            let current: BountyEscrowState = Mapping::get_or_use(
                bounty_escrows,
                bounty_id,
                empty,
            );
            assert_eq(current.owner_address, signer);
            let updated: BountyEscrowState = BountyEscrowState {
                owner_address: signer,
                total_funded: current.total_funded + amount,
                available_balance: current.available_balance + amount,
                locked_amount: current.locked_amount,
                paid_amount: current.paid_amount,
                refunded_amount: current.refunded_amount,
                status: 1u8,
                last_funding_height: std::ctx::block_height(),
                last_funding_marker: operation_marker,
                last_refund_marker: current.last_refund_marker,
            };
            Mapping::set(bounty_escrows, bounty_id, updated);
            Mapping::set(escrow_operation_markers, operation_marker, true);
            transfer.run();
        };
    }

    // Edition 0 ABI is preserved but disabled before any state mutation.
    fn lock_reward(
        public bounty_id: field,
        public claim_hash: field,
        public whitehat_address: address,
        public reward_amount: u64,
    ) -> Final {
        let signer = std::ctx::signer();
        assert_eq(reward_amount, 0u64);
        assert_neq(reward_amount, 0u64);
        return final {
            assert(reward_amount > 0u64);
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.owner_address, signer);
            assert(bounty.status == 1u8 || bounty.status == 2u8);

            assert(Mapping::contains(claim_receipts, claim_hash));
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            assert_eq(receipt.claim_hash, claim_hash);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.proof_status, 1u8);
            assert(Mapping::contains(claim_reporters, claim_hash));
            let reporter: address = Mapping::get(claim_reporters, claim_hash);
            assert_eq(reporter, whitehat_address);

            assert(Mapping::contains(bounty_escrows, bounty_id));
            let escrow: BountyEscrowState = Mapping::get(bounty_escrows, bounty_id);
            assert_eq(escrow.owner_address, signer);
            assert(escrow.available_balance >= reward_amount);
            assert(!Mapping::contains(claim_payouts, claim_hash));

            let updated_escrow: BountyEscrowState = BountyEscrowState {
                owner_address: escrow.owner_address,
                total_funded: escrow.total_funded,
                available_balance: escrow.available_balance - reward_amount,
                locked_amount: escrow.locked_amount + reward_amount,
                paid_amount: escrow.paid_amount,
                refunded_amount: escrow.refunded_amount,
                status: escrow.status,
                last_funding_height: escrow.last_funding_height,
                last_funding_marker: escrow.last_funding_marker,
                last_refund_marker: escrow.last_refund_marker,
            };
            let payout: ClaimPayoutState = ClaimPayoutState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                whitehat_address: whitehat_address,
                reward_amount: reward_amount,
                status: 1u8,
                locked_height: std::ctx::block_height(),
                paid_height: 0u32,
                release_marker: 0field,
            };
            Mapping::set(bounty_escrows, bounty_id, updated_escrow);
            Mapping::set(claim_payouts, claim_hash, payout);
        };
    }

    fn lock_reward_v2(
        public bounty_id: field,
        public claim_hash: field,
        public whitehat_address: address,
        public reward_amount: u64,
        public lock_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(reward_amount > 0u64);
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.owner_address, signer);
            assert(bounty.status == 1u8 || bounty.status == 2u8 || bounty.status == 3u8);
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            let bounty_protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            assert_eq(bounty_protocol_version, 2u8);

            assert(Mapping::contains(claim_receipts, claim_hash));
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            assert_eq(receipt.claim_hash, claim_hash);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.proof_status, 1u8);
            assert_eq(receipt.protocol_version, 2u8);
            let expected_reward: u64 =
                receipt.severity == 3u8
                    ? bounty.critical_reward
                    : receipt.severity == 2u8
                        ? bounty.high_reward
                        : receipt.severity == 1u8 ? bounty.medium_reward : 0u64;
            assert(expected_reward > 0u64);
            assert_eq(reward_amount, expected_reward);
            assert(Mapping::contains(claim_reporters, claim_hash));
            let reporter: address = Mapping::get(claim_reporters, claim_hash);
            assert_eq(reporter, whitehat_address);
            let operation_marker: field = derive_operation_marker(
                202field,
                bounty_id,
                claim_hash,
                signer,
                reporter,
                reward_amount,
                lock_marker,
            );
            assert(!Mapping::contains(escrow_operation_markers, operation_marker));

            assert(Mapping::contains(bounty_escrows, bounty_id));
            let escrow: BountyEscrowState = Mapping::get(bounty_escrows, bounty_id);
            assert_eq(escrow.owner_address, signer);
            assert(escrow.available_balance >= reward_amount);
            assert(!Mapping::contains(claim_payouts, claim_hash));
            assert(!Mapping::contains(claim_triage_states, claim_hash));

            let updated_escrow: BountyEscrowState = BountyEscrowState {
                owner_address: escrow.owner_address,
                total_funded: escrow.total_funded,
                available_balance: escrow.available_balance - reward_amount,
                locked_amount: escrow.locked_amount + reward_amount,
                paid_amount: escrow.paid_amount,
                refunded_amount: escrow.refunded_amount,
                status: escrow.status,
                last_funding_height: escrow.last_funding_height,
                last_funding_marker: escrow.last_funding_marker,
                last_refund_marker: escrow.last_refund_marker,
            };
            let payout: ClaimPayoutState = ClaimPayoutState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                whitehat_address: whitehat_address,
                reward_amount: reward_amount,
                status: 1u8,
                locked_height: std::ctx::block_height(),
                paid_height: 0u32,
                release_marker: 0field,
            };
            let triage: ClaimTriageState = ClaimTriageState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                status: 1u8,
                package_hash: 0field,
                updated_height: std::ctx::block_height(),
            };
            Mapping::set(bounty_escrows, bounty_id, updated_escrow);
            Mapping::set(claim_payouts, claim_hash, payout);
            Mapping::set(claim_triage_states, claim_hash, triage);
            Mapping::set(escrow_operation_markers, operation_marker, true);
        };
    }

    fn request_disclosure(
        public bounty_id: field,
        public claim_hash: field,
        public request_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.owner_address, signer);

            assert(Mapping::contains(claim_receipts, claim_hash));
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.proof_status, 1u8);

            assert(Mapping::contains(claim_payouts, claim_hash));
            let payout: ClaimPayoutState = Mapping::get(claim_payouts, claim_hash);
            assert_eq(payout.status, 1u8);

            assert(Mapping::contains(claim_triage_states, claim_hash));
            let current: ClaimTriageState = Mapping::get(claim_triage_states, claim_hash);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(current.status, 1u8);
            let operation_marker: field = derive_operation_marker(
                203field,
                bounty_id,
                claim_hash,
                signer,
                signer,
                payout.reward_amount,
                request_marker,
            );
            assert(!Mapping::contains(escrow_operation_markers, operation_marker));

            let requested: ClaimTriageState = ClaimTriageState {
                claim_hash: current.claim_hash,
                bounty_id: current.bounty_id,
                status: 2u8,
                package_hash: 0field,
                updated_height: std::ctx::block_height(),
            };
            Mapping::set(claim_triage_states, claim_hash, requested);
            Mapping::set(escrow_operation_markers, operation_marker, true);
        };
    }

    fn attest_encrypted_details(
        public bounty_id: field,
        public claim_hash: field,
        public package_hash: field,
        public share_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(package_hash != 0field);
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert(Mapping::contains(claim_receipts, claim_hash));
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.proof_status, 1u8);
            assert_eq(receipt.protocol_version, 2u8);

            assert(Mapping::contains(claim_reporters, claim_hash));
            let reporter: address = Mapping::get(claim_reporters, claim_hash);
            assert_eq(reporter, signer);

            assert(Mapping::contains(claim_payouts, claim_hash));
            let payout: ClaimPayoutState = Mapping::get(claim_payouts, claim_hash);
            assert_eq(payout.status, 1u8);
            assert(Mapping::contains(claim_triage_states, claim_hash));
            let current: ClaimTriageState = Mapping::get(claim_triage_states, claim_hash);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(current.status, 2u8);
            let operation_marker: field = derive_operation_marker(
                204field,
                bounty_id,
                claim_hash,
                signer,
                bounty.owner_address,
                payout.reward_amount,
                share_marker,
            );
            assert(!Mapping::contains(escrow_operation_markers, operation_marker));

            let shared: ClaimTriageState = ClaimTriageState {
                claim_hash: current.claim_hash,
                bounty_id: current.bounty_id,
                status: 3u8,
                package_hash: package_hash,
                updated_height: std::ctx::block_height(),
            };
            Mapping::set(claim_triage_states, claim_hash, shared);
            Mapping::set(escrow_operation_markers, operation_marker, true);
        };
    }

    fn mark_patched(
        public bounty_id: field,
        public claim_hash: field,
        public patched_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.owner_address, signer);

            assert(Mapping::contains(claim_triage_states, claim_hash));
            let current: ClaimTriageState = Mapping::get(claim_triage_states, claim_hash);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(current.status, 3u8);
            assert(current.package_hash != 0field);
            assert(Mapping::contains(claim_payouts, claim_hash));
            let payout: ClaimPayoutState = Mapping::get(claim_payouts, claim_hash);
            assert_eq(payout.status, 1u8);
            let operation_marker: field = derive_operation_marker(
                205field,
                bounty_id,
                claim_hash,
                signer,
                payout.whitehat_address,
                payout.reward_amount,
                patched_marker,
            );
            assert(!Mapping::contains(escrow_operation_markers, operation_marker));

            let patched: ClaimTriageState = ClaimTriageState {
                claim_hash: current.claim_hash,
                bounty_id: current.bounty_id,
                status: 4u8,
                package_hash: current.package_hash,
                updated_height: std::ctx::block_height(),
            };
            Mapping::set(claim_triage_states, claim_hash, patched);
            Mapping::set(escrow_operation_markers, operation_marker, true);
        };
    }

    // Edition 0 ABI is preserved but disabled before any Credits call.
    fn release_reward(
        public bounty_id: field,
        public claim_hash: field,
        public whitehat_address: address,
        public reward_amount: u64,
        public release_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        assert_eq(reward_amount, 0u64);
        assert_neq(reward_amount, 0u64);
        let transfer: Final = credits.aleo::transfer_public(
            whitehat_address,
            reward_amount,
        );
        return final {
            assert(reward_amount > 0u64);
            assert(release_marker != 0field);
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.owner_address, signer);
            assert(bounty.status == 1u8 || bounty.status == 2u8 || bounty.status == 3u8);

            assert(Mapping::contains(claim_receipts, claim_hash));
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            assert_eq(receipt.claim_hash, claim_hash);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.proof_status, 1u8);
            assert(Mapping::contains(claim_reporters, claim_hash));
            let reporter: address = Mapping::get(claim_reporters, claim_hash);
            assert_eq(reporter, whitehat_address);

            assert(Mapping::contains(claim_payouts, claim_hash));
            let payout: ClaimPayoutState = Mapping::get(claim_payouts, claim_hash);
            assert_eq(payout.claim_hash, claim_hash);
            assert_eq(payout.bounty_id, bounty_id);
            assert_eq(payout.whitehat_address, whitehat_address);
            assert_eq(payout.reward_amount, reward_amount);
            assert_eq(payout.status, 1u8);

            assert(Mapping::contains(bounty_escrows, bounty_id));
            let escrow: BountyEscrowState = Mapping::get(bounty_escrows, bounty_id);
            assert_eq(escrow.owner_address, signer);
            assert(escrow.locked_amount >= reward_amount);

            let updated_escrow: BountyEscrowState = BountyEscrowState {
                owner_address: escrow.owner_address,
                total_funded: escrow.total_funded,
                available_balance: escrow.available_balance,
                locked_amount: escrow.locked_amount - reward_amount,
                paid_amount: escrow.paid_amount + reward_amount,
                refunded_amount: escrow.refunded_amount,
                status: escrow.status,
                last_funding_height: escrow.last_funding_height,
                last_funding_marker: escrow.last_funding_marker,
                last_refund_marker: escrow.last_refund_marker,
            };
            let paid_payout: ClaimPayoutState = ClaimPayoutState {
                claim_hash: payout.claim_hash,
                bounty_id: payout.bounty_id,
                whitehat_address: payout.whitehat_address,
                reward_amount: payout.reward_amount,
                status: 2u8,
                locked_height: payout.locked_height,
                paid_height: std::ctx::block_height(),
                release_marker: release_marker,
            };
            Mapping::set(bounty_escrows, bounty_id, updated_escrow);
            Mapping::set(claim_payouts, claim_hash, paid_payout);
            transfer.run();
        };
    }

    fn release_reward_v2(
        public bounty_id: field,
        public claim_hash: field,
        public whitehat_address: address,
        public reward_amount: u64,
        public release_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        let transfer: Final = credits.aleo::transfer_public(
            whitehat_address,
            reward_amount,
        );
        return final {
            assert(reward_amount > 0u64);
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.owner_address, signer);
            assert(bounty.status == 1u8 || bounty.status == 2u8 || bounty.status == 3u8);
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            let bounty_protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            assert_eq(bounty_protocol_version, 2u8);

            assert(Mapping::contains(claim_receipts, claim_hash));
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            assert_eq(receipt.claim_hash, claim_hash);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.proof_status, 1u8);
            assert_eq(receipt.protocol_version, 2u8);
            assert(Mapping::contains(claim_reporters, claim_hash));
            let reporter: address = Mapping::get(claim_reporters, claim_hash);
            assert_eq(reporter, whitehat_address);
            let operation_marker: field = derive_operation_marker(
                206field,
                bounty_id,
                claim_hash,
                signer,
                reporter,
                reward_amount,
                release_marker,
            );
            assert(!Mapping::contains(escrow_operation_markers, operation_marker));

            assert(Mapping::contains(claim_payouts, claim_hash));
            let payout: ClaimPayoutState = Mapping::get(claim_payouts, claim_hash);
            assert_eq(payout.claim_hash, claim_hash);
            assert_eq(payout.bounty_id, bounty_id);
            assert_eq(payout.whitehat_address, whitehat_address);
            assert_eq(payout.reward_amount, reward_amount);
            assert_eq(payout.status, 1u8);

            assert(Mapping::contains(claim_triage_states, claim_hash));
            let triage: ClaimTriageState = Mapping::get(claim_triage_states, claim_hash);
            assert_eq(triage.bounty_id, bounty_id);
            assert_eq(triage.status, 4u8);

            assert(Mapping::contains(bounty_escrows, bounty_id));
            let escrow: BountyEscrowState = Mapping::get(bounty_escrows, bounty_id);
            assert_eq(escrow.owner_address, signer);
            assert(escrow.locked_amount >= reward_amount);
            assert(Mapping::contains(bounty_claim_counts, bounty_id));
            let unresolved_claims: u64 = Mapping::get(bounty_claim_counts, bounty_id);
            assert(unresolved_claims > 0u64);

            let updated_escrow: BountyEscrowState = BountyEscrowState {
                owner_address: escrow.owner_address,
                total_funded: escrow.total_funded,
                available_balance: escrow.available_balance,
                locked_amount: escrow.locked_amount - reward_amount,
                paid_amount: escrow.paid_amount + reward_amount,
                refunded_amount: escrow.refunded_amount,
                status: escrow.status,
                last_funding_height: escrow.last_funding_height,
                last_funding_marker: escrow.last_funding_marker,
                last_refund_marker: escrow.last_refund_marker,
            };
            let paid_payout: ClaimPayoutState = ClaimPayoutState {
                claim_hash: payout.claim_hash,
                bounty_id: payout.bounty_id,
                whitehat_address: payout.whitehat_address,
                reward_amount: payout.reward_amount,
                status: 2u8,
                locked_height: payout.locked_height,
                paid_height: std::ctx::block_height(),
                release_marker: operation_marker,
            };
            let paid_triage: ClaimTriageState = ClaimTriageState {
                claim_hash: triage.claim_hash,
                bounty_id: triage.bounty_id,
                status: 5u8,
                package_hash: triage.package_hash,
                updated_height: std::ctx::block_height(),
            };
            Mapping::set(bounty_escrows, bounty_id, updated_escrow);
            Mapping::set(claim_payouts, claim_hash, paid_payout);
            Mapping::set(claim_triage_states, claim_hash, paid_triage);
            Mapping::set(bounty_claim_counts, bounty_id, unresolved_claims - 1u64);
            Mapping::set(escrow_operation_markers, operation_marker, true);
            transfer.run();
        };
    }

    fn reject_claim(
        public bounty_id: field,
        public claim_hash: field,
        public rejection_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(
                signer,
                aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6
            );
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            let bounty_protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            assert_eq(bounty_protocol_version, 2u8);

            assert(Mapping::contains(claim_receipts, claim_hash));
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.proof_status, 1u8);
            assert_eq(receipt.protocol_version, 2u8);
            assert(Mapping::contains(claim_reporters, claim_hash));
            let reporter: address = Mapping::get(claim_reporters, claim_hash);
            let has_payout: bool = Mapping::contains(claim_payouts, claim_hash);
            let empty_payout: ClaimPayoutState = ClaimPayoutState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                whitehat_address: reporter,
                reward_amount: 0u64,
                status: 0u8,
                locked_height: 0u32,
                paid_height: 0u32,
                release_marker: 0field,
            };
            let payout: ClaimPayoutState = Mapping::get_or_use(
                claim_payouts,
                claim_hash,
                empty_payout,
            );
            let operation_marker: field = derive_operation_marker(
                207field,
                bounty_id,
                claim_hash,
                signer,
                reporter,
                payout.reward_amount,
                rejection_marker,
            );
            assert(!Mapping::contains(escrow_operation_markers, operation_marker));

            let empty_triage: ClaimTriageState = ClaimTriageState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                status: 0u8,
                package_hash: 0field,
                updated_height: receipt.created_height,
            };
            let triage: ClaimTriageState = Mapping::get_or_use(
                claim_triage_states,
                claim_hash,
                empty_triage,
            );
            assert_eq(triage.bounty_id, bounty_id);
            assert(triage.status == 0u8 || triage.status == 1u8 || triage.status == 2u8);

            if has_payout {
                assert_eq(payout.claim_hash, claim_hash);
                assert_eq(payout.bounty_id, bounty_id);
                assert_eq(payout.whitehat_address, reporter);
                assert_eq(payout.status, 1u8);
                assert(Mapping::contains(bounty_escrows, bounty_id));
                let escrow: BountyEscrowState = Mapping::get(bounty_escrows, bounty_id);
                assert(escrow.locked_amount >= payout.reward_amount);

                let unlocked_escrow: BountyEscrowState = BountyEscrowState {
                    owner_address: escrow.owner_address,
                    total_funded: escrow.total_funded,
                    available_balance: escrow.available_balance + payout.reward_amount,
                    locked_amount: escrow.locked_amount - payout.reward_amount,
                    paid_amount: escrow.paid_amount,
                    refunded_amount: escrow.refunded_amount,
                    status: escrow.status,
                    last_funding_height: escrow.last_funding_height,
                    last_funding_marker: escrow.last_funding_marker,
                    last_refund_marker: escrow.last_refund_marker,
                };
                Mapping::set(bounty_escrows, bounty_id, unlocked_escrow);
            }

            let rejected_payout: ClaimPayoutState = ClaimPayoutState {
                claim_hash: payout.claim_hash,
                bounty_id: payout.bounty_id,
                whitehat_address: payout.whitehat_address,
                reward_amount: payout.reward_amount,
                status: 3u8,
                locked_height: payout.locked_height,
                paid_height: 0u32,
                release_marker: operation_marker,
            };
            assert(Mapping::contains(bounty_claim_counts, bounty_id));
            let unresolved_claims: u64 = Mapping::get(bounty_claim_counts, bounty_id);
            assert(unresolved_claims > 0u64);
            let rejected_triage: ClaimTriageState = ClaimTriageState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                status: 6u8,
                package_hash: triage.package_hash,
                updated_height: std::ctx::block_height(),
            };
            Mapping::set(claim_payouts, claim_hash, rejected_payout);
            Mapping::set(claim_triage_states, claim_hash, rejected_triage);
            Mapping::set(bounty_claim_counts, bounty_id, unresolved_claims - 1u64);
            Mapping::set(escrow_operation_markers, operation_marker, true);
        };
    }

    // Edition 0 ABI is preserved but disabled before any Credits call.
    fn refund_bounty(
        public bounty_id: field,
        public amount: u64,
        public refund_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        assert_eq(amount, 0u64);
        assert_neq(amount, 0u64);
        let transfer: Final = credits.aleo::transfer_public(
            signer,
            amount,
        );
        return final {
            assert(amount > 0u64);
            assert(refund_marker != 0field);
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.owner_address, signer);
            assert_eq(bounty.status, 3u8);
            assert(std::ctx::block_height() > bounty.disclosure_deadline);

            assert(Mapping::contains(bounty_escrows, bounty_id));
            let escrow: BountyEscrowState = Mapping::get(bounty_escrows, bounty_id);
            assert(Mapping::contains(bounty_claim_counts, bounty_id));
            let claim_count: u64 = Mapping::get(bounty_claim_counts, bounty_id);
            assert_eq(escrow.owner_address, signer);
            assert_eq(escrow.locked_amount, 0u64);
            assert_eq(claim_count, 0u64);
            assert(escrow.available_balance >= amount);

            let updated_escrow: BountyEscrowState = BountyEscrowState {
                owner_address: escrow.owner_address,
                total_funded: escrow.total_funded,
                available_balance: escrow.available_balance - amount,
                locked_amount: escrow.locked_amount,
                paid_amount: escrow.paid_amount,
                refunded_amount: escrow.refunded_amount + amount,
                status: 3u8,
                last_funding_height: escrow.last_funding_height,
                last_funding_marker: escrow.last_funding_marker,
                last_refund_marker: refund_marker,
            };
            Mapping::set(bounty_escrows, bounty_id, updated_escrow);
            transfer.run();
        };
    }

    fn refund_bounty_v2(
        public bounty_id: field,
        public amount: u64,
        public refund_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        let transfer: Final = credits.aleo::transfer_public(
            signer,
            amount,
        );
        return final {
            assert(amount > 0u64);
            assert(Mapping::contains(bounties, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            assert_eq(bounty.owner_address, signer);
            assert_eq(bounty.status, 3u8);
            assert(std::ctx::block_height() > bounty.disclosure_deadline);
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            let bounty_protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            assert_eq(bounty_protocol_version, 2u8);

            assert(Mapping::contains(bounty_escrows, bounty_id));
            let escrow: BountyEscrowState = Mapping::get(bounty_escrows, bounty_id);
            assert_eq(escrow.status, 1u8);
            let operation_marker: field = derive_operation_marker(
                208field,
                bounty_id,
                0field,
                signer,
                signer,
                amount,
                refund_marker,
            );
            assert(!Mapping::contains(escrow_operation_markers, operation_marker));
            assert(Mapping::contains(bounty_claim_counts, bounty_id));
            let claim_count: u64 = Mapping::get(bounty_claim_counts, bounty_id);
            assert_eq(escrow.owner_address, signer);
            assert_eq(escrow.locked_amount, 0u64);
            assert_eq(claim_count, 0u64);
            assert_eq(escrow.available_balance, amount);

            let updated_escrow: BountyEscrowState = BountyEscrowState {
                owner_address: escrow.owner_address,
                total_funded: escrow.total_funded,
                available_balance: 0u64,
                locked_amount: escrow.locked_amount,
                paid_amount: escrow.paid_amount,
                refunded_amount: escrow.refunded_amount + amount,
                status: 3u8,
                last_funding_height: escrow.last_funding_height,
                last_funding_marker: escrow.last_funding_marker,
                last_refund_marker: operation_marker,
            };
            Mapping::set(bounty_escrows, bounty_id, updated_escrow);
            Mapping::set(escrow_operation_markers, operation_marker, true);
            transfer.run();
        };
    }

    fn create_bounty_v3(
        public bounty_id: field,
        public scope_hash: field,
        public rule_id: field,
        public critical_reward: u64,
        public high_reward: u64,
        public medium_reward: u64,
        public low_reward: u64,
        public disclosure_deadline: u32,
        public policy: BountyV3PolicyInput,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(!Mapping::contains(bounties, bounty_id));
            assert(!Mapping::contains(bounty_v3_configs, bounty_id));
            let supported_rule: bool =
                rule_id == 1field ||
                rule_id == 2field ||
                rule_id == 3field ||
                rule_id == 4field;
            let valid_rewards: bool =
                critical_reward >= high_reward &&
                high_reward >= medium_reward &&
                medium_reward > 0u64 &&
                low_reward == 0u64;
            assert(supported_rule);
            assert(valid_rewards);
            assert(disclosure_deadline > std::ctx::block_height());
            assert(policy.disclosure_key_commitment != 0field);
            assert(policy.target_system_commitment != 0field);
            assert(policy.target_code_hash != 0field);
            assert(policy.panel_id != 0field);
            assert(policy.arbiter_one != policy.arbiter_two);
            assert(policy.arbiter_one != policy.arbiter_three);
            assert(policy.arbiter_two != policy.arbiter_three);
            assert(policy.arbiter_one != signer);
            assert(policy.arbiter_two != signer);
            assert(policy.arbiter_three != signer);
            assert(policy.quorum == 2u8 || policy.quorum == 3u8);
            assert(policy.review_window_blocks > 0u32);
            assert(policy.decision_window_blocks > 0u32);
            assert(policy.arbitration_fee_microcredits > 0u64);
            assert(policy.payment_condition == 1u8 || policy.payment_condition == 2u8);

            let bounty: BountyState = BountyState {
                owner_address: signer,
                scope_hash: scope_hash,
                rule_id: rule_id,
                critical_reward: critical_reward,
                high_reward: high_reward,
                medium_reward: medium_reward,
                low_reward: low_reward,
                disclosure_deadline: disclosure_deadline,
                status: 1u8,
            };
            let config: BountyV3Config = BountyV3Config {
                bounty_id: bounty_id,
                disclosure_key_commitment: policy.disclosure_key_commitment,
                target_system_commitment: policy.target_system_commitment,
                target_code_hash: policy.target_code_hash,
                panel_id: policy.panel_id,
                arbiter_one: policy.arbiter_one,
                arbiter_two: policy.arbiter_two,
                arbiter_three: policy.arbiter_three,
                quorum: policy.quorum,
                review_window_blocks: policy.review_window_blocks,
                decision_window_blocks: policy.decision_window_blocks,
                arbitration_fee_microcredits: policy.arbitration_fee_microcredits,
                payment_condition: policy.payment_condition,
                configured_height: std::ctx::block_height(),
            };
            Mapping::set(bounties, bounty_id, bounty);
            Mapping::set(bounty_claim_counts, bounty_id, 0u64);
            Mapping::set(bounty_protocol_versions, bounty_id, 3u8);
            Mapping::set(bounty_v3_configs, bounty_id, config);
        };
    }
    fn submit_claim_v3(
        public bounty_id: field,
        public scope_hash: field,
        public rule_id: field,
        public binding: ClaimV3BindingInput,
        witness: VaultWitnessInput,
    ) -> (public ProofResultV3, Final) {
        let signer = std::ctx::signer();
        assert(binding.target_system_commitment != 0field);
        assert(binding.target_state_commitment != 0field);
        assert(binding.target_code_hash != 0field);
        assert(binding.execution_commitment != 0field);
        assert(binding.report_commitment != 0field);
        let base_proof: ProofResult = compute_vault_invariant_break(
            bounty_id,
            scope_hash,
            rule_id,
            witness.vault_balance_before,
            witness.total_deposits_before,
            witness.total_claims_before,
            witness.reserved_rewards_before,
            witness.withdraw_limit_before,
            witness.user_balance_before,
            witness.requested_withdraw_before,
            witness.hidden_delta_balance,
            witness.hidden_delta_claims,
            witness.hidden_delta_reserved_rewards,
            witness.hidden_delta_withdraw_amount,
            witness.hidden_delta_user_balance,
            witness.reporter_secret,
        );
        let claim_hash: field = Poseidon8::hash_to_field([
            301field,
            base_proof.claim_hash,
            binding.target_system_commitment,
            binding.target_state_commitment,
            binding.target_code_hash,
            binding.execution_commitment,
            binding.report_commitment,
            base_proof.reporter_commitment,
        ]);
        let proof: ProofResultV3 = ProofResultV3 {
            verified: base_proof.verified,
            severity: base_proof.severity,
            claim_hash: claim_hash,
            witness_commitment: base_proof.witness_commitment,
            nullifier: base_proof.nullifier,
            reporter_commitment: base_proof.reporter_commitment,
            target_system_commitment: binding.target_system_commitment,
            target_state_commitment: binding.target_state_commitment,
            target_code_hash: binding.target_code_hash,
            execution_commitment: binding.execution_commitment,
            report_commitment: binding.report_commitment,
        };
        let severity: u8 = proof.severity;
        let witness_commitment: field = proof.witness_commitment;
        let nullifier: field = proof.nullifier;
        let reporter_commitment: field = proof.reporter_commitment;
        let bound_target_system: field = proof.target_system_commitment;
        let bound_target_state: field = proof.target_state_commitment;
        let bound_target_code: field = proof.target_code_hash;
        let bound_execution: field = proof.execution_commitment;
        let bound_report: field = proof.report_commitment;

        return (proof, final {
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let config: BountyV3Config = Mapping::get(bounty_v3_configs, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            assert_eq(protocol_version, 3u8);
            assert_eq(bounty.scope_hash, scope_hash);
            assert_eq(bounty.rule_id, rule_id);
            assert_eq(bounty.status, 1u8);
            assert(std::ctx::block_height() <= bounty.disclosure_deadline);
            assert(signer != bounty.owner_address);
            assert_eq(config.bounty_id, bounty_id);
            assert_eq(config.target_system_commitment, bound_target_system);
            assert_eq(config.target_code_hash, bound_target_code);

            assert(!Mapping::contains(nullifiers, nullifier));
            assert(!Mapping::contains(claim_receipts, claim_hash));
            assert(!Mapping::contains(claim_reporters, claim_hash));
            assert(!Mapping::contains(claim_v3_evidence, claim_hash));
            assert(!Mapping::contains(claim_v3_states, claim_hash));
            assert(Mapping::contains(bounty_claim_counts, bounty_id));

            let receipt: ClaimReceiptState = ClaimReceiptState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                rule_id: rule_id,
                scope_hash: scope_hash,
                severity: severity,
                witness_commitment: witness_commitment,
                nullifier: nullifier,
                reporter_commitment: reporter_commitment,
                proof_status: 1u8,
                created_height: std::ctx::block_height(),
                protocol_version: 3u8,
            };
            let evidence: ClaimV3Evidence = ClaimV3Evidence {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                target_system_commitment: bound_target_system,
                target_state_commitment: bound_target_state,
                target_code_hash: bound_target_code,
                execution_commitment: bound_execution,
                report_commitment: bound_report,
                submitted_height: std::ctx::block_height(),
            };
            let state: ClaimV3State = ClaimV3State {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                whitehat_address: signer,
                status: 1u8,
                pre_dispute_status: 0u8,
                package_hash: 0field,
                reproduction_commitment: 0field,
                patch_commitment: 0field,
                dispute_commitment: 0field,
                updated_height: std::ctx::block_height(),
            };
            let unresolved_claims: u64 = Mapping::get(bounty_claim_counts, bounty_id);
            Mapping::set(nullifiers, nullifier, bounty_id);
            Mapping::set(claim_receipts, claim_hash, receipt);
            Mapping::set(claim_reporters, claim_hash, signer);
            Mapping::set(claim_v3_evidence, claim_hash, evidence);
            Mapping::set(claim_v3_states, claim_hash, state);
            Mapping::set(bounty_claim_counts, bounty_id, unresolved_claims + 1u64);
        });
    }
    fn fund_bounty_v3(
        public bounty_id: field,
        public amount: u64,
        public funding_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        let transfer: Final = credits.aleo::transfer_public_as_signer(
            zkbugbounty_7f3c92.aleo,
            amount,
        );
        return final {
            assert(amount > 0u64);
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            assert_eq(protocol_version, 3u8);
            assert_eq(bounty.owner_address, signer);
            assert(bounty.status == 1u8 || bounty.status == 2u8);
            assert(std::ctx::block_height() <= bounty.disclosure_deadline);
            let operation_marker: field = derive_operation_marker(
                310field,
                bounty_id,
                0field,
                signer,
                signer,
                amount,
                funding_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));

            let empty: BountyEscrowState = BountyEscrowState {
                owner_address: signer,
                total_funded: 0u64,
                available_balance: 0u64,
                locked_amount: 0u64,
                paid_amount: 0u64,
                refunded_amount: 0u64,
                status: 1u8,
                last_funding_height: 0u32,
                last_funding_marker: 0field,
                last_refund_marker: 0field,
            };
            let current: BountyEscrowState = Mapping::get_or_use(
                bounty_escrows,
                bounty_id,
                empty,
            );
            assert_eq(current.owner_address, signer);
            assert_eq(current.status, 1u8);
            let updated: BountyEscrowState = BountyEscrowState {
                owner_address: current.owner_address,
                total_funded: current.total_funded + amount,
                available_balance: current.available_balance + amount,
                locked_amount: current.locked_amount,
                paid_amount: current.paid_amount,
                refunded_amount: current.refunded_amount,
                status: current.status,
                last_funding_height: std::ctx::block_height(),
                last_funding_marker: operation_marker,
                last_refund_marker: current.last_refund_marker,
            };
            Mapping::set(bounty_escrows, bounty_id, updated);
            Mapping::set(v3_operation_markers, operation_marker, true);
            transfer.run();
        };
    }

    // V3 claim statuses: 1 Submitted, 2 OwnerReviewing, 3 Accepted,
    // 4 RewardLocked, 5 DisclosureDelivered, 6 DisclosureAcknowledged,
    // 7 ReproductionConfirmed, 8 ReproductionRejected, 9 PatchProposed,
    // 10 PatchAccepted, 11 Disputed, 12 Paid, 13 OwnerRejected, 14 Rejected.
    // V3 claim statuses: 1 Submitted, 2 OwnerReviewing, 3 Accepted,
    // 4 RewardLocked, 5 DisclosureDelivered, 6 DisclosureAcknowledged,
    // 7 ReproductionConfirmed, 8 ReproductionRejected, 9 PatchProposed,
    // 10 PatchAccepted, 11 Disputed, 12 Paid, 13 OwnerRejected, 14 Rejected.
    // Review actions: 1 begin review, 2 accept, 3 reject with appeal.
    // Review actions: 1 begin, 2 accept at circuit severity, 3 rejection,
    // 4 duplicate, 5 out-of-scope, 6 severity assessment.
    fn review_claim_v3(
        public bounty_id: field,
        public claim_hash: field,
        public action: u8,
        public project_severity: u8,
        public decision_commitment: field,
        public action_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(action >= 1u8 && action <= 6u8);
            assert(project_severity <= 3u8);
            assert(decision_commitment != 0field);
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            assert(Mapping::contains(claim_receipts, claim_hash));
            assert(Mapping::contains(claim_v3_states, claim_hash));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            let current: ClaimV3State = Mapping::get(claim_v3_states, claim_hash);
            assert_eq(protocol_version, 3u8);
            assert_eq(bounty.owner_address, signer);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.protocol_version, 3u8);
            assert_eq(current.bounty_id, bounty_id);

            let valid_begin: bool =
                action == 1u8 &&
                current.status == 1u8 &&
                project_severity == 0u8;
            let valid_accept: bool =
                action == 2u8 &&
                (current.status == 1u8 || current.status == 2u8) &&
                project_severity == receipt.severity;
            let valid_rejection: bool =
                action == 3u8 &&
                (current.status == 1u8 ||
                 current.status == 2u8 ||
                 current.status == 3u8) &&
                project_severity == 0u8;
            let valid_duplicate: bool =
                action == 4u8 &&
                (current.status == 1u8 ||
                 current.status == 2u8 ||
                 current.status == 3u8) &&
                project_severity == 0u8;
            let valid_scope: bool =
                action == 5u8 &&
                (current.status == 1u8 ||
                 current.status == 2u8 ||
                 current.status == 3u8) &&
                project_severity == 0u8;
            let valid_severity: bool =
                action == 6u8 &&
                (current.status == 1u8 || current.status == 2u8) &&
                project_severity <= receipt.severity;
            assert(
                valid_begin ||
                valid_accept ||
                valid_rejection ||
                valid_duplicate ||
                valid_scope ||
                valid_severity
            );

            let adverse_decision: bool =
                action == 3u8 ||
                action == 4u8 ||
                action == 5u8 ||
                (action == 6u8 && project_severity == 0u8);
            if adverse_decision {
                assert(!Mapping::contains(claim_v3_payouts, claim_hash));
            }

            let operation_marker: field = derive_operation_marker(
                324field,
                bounty_id,
                claim_hash,
                signer,
                current.whitehat_address,
                action as u64,
                action_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));
            let next_status: u8 =
                action == 1u8 ? 2u8 :
                action == 2u8 ? 3u8 :
                (action == 6u8 && project_severity > 0u8) ? 3u8 : 13u8;
            let next_dispute_commitment: field =
                action >= 3u8 ? decision_commitment : current.dispute_commitment;
            let updated: ClaimV3State = update_claim_v3_state(
                current,
                next_status,
                current.package_hash,
                current.reproduction_commitment,
                current.patch_commitment,
                next_dispute_commitment,
                std::ctx::block_height(),
            );
            if action != 1u8 {
                let decision_code: u8 =
                    action == 2u8 ? 1u8 :
                    action == 3u8 ? 2u8 :
                    action == 4u8 ? 3u8 :
                    action == 5u8 ? 4u8 : 5u8;
                let decision: ClaimV3ProjectDecision = ClaimV3ProjectDecision {
                    claim_hash: claim_hash,
                    bounty_id: bounty_id,
                    decision: decision_code,
                    project_severity: project_severity,
                    decision_commitment: decision_commitment,
                    decided_height: std::ctx::block_height(),
                };
                Mapping::set(claim_v3_project_decisions, claim_hash, decision);
            }
            Mapping::set(claim_v3_states, claim_hash, updated);
            Mapping::set(v3_operation_markers, operation_marker, true);
        };
    }

    fn lock_reward_v3(
        public bounty_id: field,
        public claim_hash: field,
        public reward_amount: u64,
        public lock_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(reward_amount > 0u64);
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            assert(Mapping::contains(claim_receipts, claim_hash));
            assert(Mapping::contains(claim_v3_states, claim_hash));
            assert(Mapping::contains(claim_reporters, claim_hash));
            assert(Mapping::contains(claim_v3_project_decisions, claim_hash));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            let current: ClaimV3State = Mapping::get(claim_v3_states, claim_hash);
            let reporter: address = Mapping::get(claim_reporters, claim_hash);
            let decision: ClaimV3ProjectDecision = Mapping::get(
                claim_v3_project_decisions,
                claim_hash,
            );
            assert_eq(protocol_version, 3u8);
            assert_eq(bounty.owner_address, signer);
            assert(bounty.status == 1u8 || bounty.status == 2u8 || bounty.status == 3u8);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.proof_status, 1u8);
            assert_eq(receipt.protocol_version, 3u8);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(current.whitehat_address, reporter);
            assert_eq(current.status, 3u8);
            assert_eq(decision.claim_hash, claim_hash);
            assert_eq(decision.bounty_id, bounty_id);
            let lock_severity: u8 = decision.decision == 5u8
                ? decision.project_severity
                : receipt.severity;
            // A reward can only be reserved after acceptance or an explicit
            // non-zero project assessment. A lower assessment is appealable
            // before lock, then its amount becomes the escrow ceiling.
            assert(
                decision.decision == 1u8 ||
                (decision.decision == 5u8 &&
                 decision.project_severity >= 1u8 &&
                 decision.project_severity <= receipt.severity)
            );
            let expected_reward: u64 = reward_for_v3_severity(bounty, lock_severity);
            assert_eq(reward_amount, expected_reward);
            assert(Mapping::contains(bounty_escrows, bounty_id));
            assert(!Mapping::contains(claim_v3_payouts, claim_hash));
            let escrow: BountyEscrowState = Mapping::get(bounty_escrows, bounty_id);
            assert_eq(escrow.owner_address, signer);
            assert_eq(escrow.status, 1u8);
            assert(escrow.available_balance >= reward_amount);
            let operation_marker: field = derive_operation_marker(
                314field,
                bounty_id,
                claim_hash,
                signer,
                reporter,
                reward_amount,
                lock_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));

            let updated_escrow: BountyEscrowState = BountyEscrowState {
                owner_address: escrow.owner_address,
                total_funded: escrow.total_funded,
                available_balance: escrow.available_balance - reward_amount,
                locked_amount: escrow.locked_amount + reward_amount,
                paid_amount: escrow.paid_amount,
                refunded_amount: escrow.refunded_amount,
                status: escrow.status,
                last_funding_height: escrow.last_funding_height,
                last_funding_marker: escrow.last_funding_marker,
                last_refund_marker: escrow.last_refund_marker,
            };
            let payout: ClaimV3PayoutState = ClaimV3PayoutState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                whitehat_address: reporter,
                reserved_amount: reward_amount,
                paid_amount: 0u64,
                status: 1u8,
                locked_height: std::ctx::block_height(),
                paid_height: 0u32,
                release_marker: 0field,
            };
            let updated_state: ClaimV3State = update_claim_v3_state(
                current,
                4u8,
                current.package_hash,
                current.reproduction_commitment,
                current.patch_commitment,
                current.dispute_commitment,
                std::ctx::block_height(),
            );
            Mapping::set(bounty_escrows, bounty_id, updated_escrow);
            Mapping::set(claim_v3_payouts, claim_hash, payout);
            Mapping::set(claim_v3_states, claim_hash, updated_state);
            Mapping::set(v3_operation_markers, operation_marker, true);
        };
    }

    // Disclosure actions: 1 whitehat delivers encrypted package, 2 owner acknowledges receipt.
    fn disclosure_action_v3(
        public bounty_id: field,
        public claim_hash: field,
        public action: u8,
        public action_commitment: field,
        public action_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(action == 1u8 || action == 2u8);
            assert(action_commitment != 0field);
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            assert(Mapping::contains(claim_receipts, claim_hash));
            assert(Mapping::contains(claim_v3_evidence, claim_hash));
            assert(Mapping::contains(claim_v3_states, claim_hash));
            assert(Mapping::contains(claim_v3_payouts, claim_hash));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            let evidence: ClaimV3Evidence = Mapping::get(claim_v3_evidence, claim_hash);
            let current: ClaimV3State = Mapping::get(claim_v3_states, claim_hash);
            let payout: ClaimV3PayoutState = Mapping::get(claim_v3_payouts, claim_hash);
            assert_eq(protocol_version, 3u8);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.protocol_version, 3u8);
            assert_eq(evidence.claim_hash, claim_hash);
            assert_eq(evidence.bounty_id, bounty_id);
            assert_eq(payout.bounty_id, bounty_id);
            assert_eq(payout.whitehat_address, current.whitehat_address);
            assert_eq(payout.status, 1u8);
            let valid_delivery: bool =
                action == 1u8 &&
                signer == current.whitehat_address &&
                current.status == 4u8 &&
                // The pre-committed report field is the ciphertext-envelope
                // hash. The recipient key remains an immutable Bounty policy
                // commitment and the ciphertext itself stays off-chain.
                action_commitment == evidence.report_commitment;
            let valid_acknowledgement: bool =
                action == 2u8 &&
                signer == bounty.owner_address &&
                current.status == 5u8 &&
                current.package_hash != 0field;
            assert(valid_delivery || valid_acknowledgement);
            if action == 2u8 {
                assert(!Mapping::contains(claim_v3_acknowledgements, claim_hash));
            }
            let recipient: address = action == 1u8
                ? bounty.owner_address
                : current.whitehat_address;
            let operation_marker: field = derive_operation_marker(
                325field,
                bounty_id,
                claim_hash,
                signer,
                recipient,
                action as u64,
                action_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));
            let next_package_hash: field = action == 1u8
                ? action_commitment
                : current.package_hash;
            let next_status: u8 = action == 1u8 ? 5u8 : 6u8;
            let updated: ClaimV3State = update_claim_v3_state(
                current,
                next_status,
                next_package_hash,
                current.reproduction_commitment,
                current.patch_commitment,
                current.dispute_commitment,
                std::ctx::block_height(),
            );
            if action == 2u8 {
                Mapping::set(
                    claim_v3_acknowledgements,
                    claim_hash,
                    action_commitment,
                );
            }
            Mapping::set(claim_v3_states, claim_hash, updated);
            Mapping::set(v3_operation_markers, operation_marker, true);
        };
    }

    // Resolution actions: 1 reproduce, 2 reject reproduction,
    // 3 propose patch, 4 whitehat accepts patch, 5 finalize no-appeal rejection.
    fn resolution_action_v3(
        public bounty_id: field,
        public claim_hash: field,
        public action: u8,
        public action_commitment: field,
        public action_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(action >= 1u8 && action <= 5u8);
            assert(action_commitment != 0field);
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            assert(Mapping::contains(claim_v3_states, claim_hash));
            assert(Mapping::contains(claim_receipts, claim_hash));
            assert(Mapping::contains(bounty_claim_counts, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let config: BountyV3Config = Mapping::get(bounty_v3_configs, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            let current: ClaimV3State = Mapping::get(claim_v3_states, claim_hash);
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            let dispute_id: field = Mapping::get_or_use(
                claim_v3_active_disputes,
                claim_hash,
                claim_hash,
            );
            let has_dispute_metadata: bool = Mapping::contains(
                claim_v3_dispute_metadata,
                dispute_id,
            );
            let empty_dispute_metadata: ClaimV3DisputeMetadata = ClaimV3DisputeMetadata {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                dispute_type: 0u8,
                dispute_commitment: 0field,
                opener: current.whitehat_address,
                opened_height: 0u32,
                status: 0u8,
                requested_severity: 0u8,
                final_severity: 0u8,
            };
            let metadata: ClaimV3DisputeMetadata = Mapping::get_or_use(
                claim_v3_dispute_metadata,
                dispute_id,
                empty_dispute_metadata,
            );
            let has_tally: bool = Mapping::contains(
                claim_v3_arbitration_tallies,
                dispute_id,
            );
            let empty_tally: ClaimV3ArbitrationTally = ClaimV3ArbitrationTally {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                reject_votes: 0u8,
                medium_votes: 0u8,
                high_votes: 0u8,
                critical_votes: 0u8,
                updated_height: current.updated_height,
            };
            let tally: ClaimV3ArbitrationTally = Mapping::get_or_use(
                claim_v3_arbitration_tallies,
                dispute_id,
                empty_tally,
            );
            let unresolved_claims: u64 = Mapping::get(
                bounty_claim_counts,
                bounty_id,
            );
            assert_eq(protocol_version, 3u8);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.protocol_version, 3u8);
            let valid_project_reproduction: bool =
                (action == 1u8 || action == 2u8) &&
                signer == bounty.owner_address &&
                current.status == 6u8 &&
                current.package_hash != 0field &&
                Mapping::contains(claim_v3_acknowledgements, claim_hash);
            let valid_arbitrated_reproduction: bool =
                action == 1u8 &&
                signer == bounty.owner_address &&
                config.payment_condition == 2u8 &&
                current.status == 11u8 &&
                current.pre_dispute_status == 8u8 &&
                has_dispute_metadata &&
                metadata.status == 1u8 &&
                metadata.dispute_type == 5u8 &&
                has_tally &&
                v3_verdict_has_quorum(
                    tally,
                    receipt.severity,
                    config.quorum,
                );
            let valid_patch_proposal: bool =
                action == 3u8 &&
                signer == bounty.owner_address &&
                current.status == 7u8 &&
                current.reproduction_commitment != 0field;
            let valid_patch_acceptance: bool =
                action == 4u8 &&
                signer == current.whitehat_address &&
                current.status == 9u8 &&
                current.patch_commitment == action_commitment;
            let valid_unappealed_rejection: bool =
                action == 5u8 &&
                (current.status == 8u8 || current.status == 13u8) &&
                !(has_dispute_metadata && metadata.status == 1u8) &&
                std::ctx::block_height() >
                current.updated_height + config.decision_window_blocks;
            assert(
                valid_project_reproduction ||
                valid_arbitrated_reproduction ||
                valid_patch_proposal ||
                valid_patch_acceptance ||
                valid_unappealed_rejection
            );
            let recipient: address = action == 4u8
                ? bounty.owner_address
                : current.whitehat_address;
            let operation_marker: field = derive_operation_marker(
                326field,
                bounty_id,
                claim_hash,
                signer,
                recipient,
                action as u64,
                action_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));
            if action <= 4u8 {
                let next_status: u8 =
                    action == 1u8 ? 7u8 :
                    action == 2u8 ? 8u8 :
                    action == 3u8 ? 9u8 : 10u8;
                let next_reproduction: field = action <= 2u8
                    ? action_commitment
                    : current.reproduction_commitment;
                let next_patch: field = action == 3u8
                    ? action_commitment
                    : current.patch_commitment;
                let updated: ClaimV3State = update_claim_v3_state(
                    current,
                    next_status,
                    current.package_hash,
                    next_reproduction,
                    next_patch,
                    current.dispute_commitment,
                    std::ctx::block_height(),
                );
                Mapping::set(claim_v3_states, claim_hash, updated);
                if action == 2u8 || action == 3u8 {
                    let decision_code: u8 = action == 2u8 ? 6u8 : 7u8;
                    let project_decision: ClaimV3ProjectDecision = ClaimV3ProjectDecision {
                        claim_hash: claim_hash,
                        bounty_id: bounty_id,
                        decision: decision_code,
                        project_severity: 0u8,
                        decision_commitment: action_commitment,
                        decided_height: std::ctx::block_height(),
                    };
                    Mapping::set(
                        claim_v3_project_decisions,
                        claim_hash,
                        project_decision,
                    );
                }
            }
            if action == 5u8 {
                let has_payout: bool = Mapping::contains(
                    claim_v3_payouts,
                    claim_hash,
                );
                assert(
                    (current.status == 8u8 && has_payout) ||
                    (current.status == 13u8 && !has_payout)
                );
                let empty_payout: ClaimV3PayoutState = ClaimV3PayoutState {
                    claim_hash: claim_hash,
                    bounty_id: bounty_id,
                    whitehat_address: current.whitehat_address,
                    reserved_amount: 0u64,
                    paid_amount: 0u64,
                    status: 0u8,
                    locked_height: 0u32,
                    paid_height: 0u32,
                    release_marker: 0field,
                };
                let payout: ClaimV3PayoutState = Mapping::get_or_use(
                    claim_v3_payouts,
                    claim_hash,
                    empty_payout,
                );
                if has_payout {
                    assert_eq(payout.bounty_id, bounty_id);
                    assert_eq(payout.whitehat_address, current.whitehat_address);
                    assert_eq(payout.status, 1u8);
                    assert(Mapping::contains(bounty_escrows, bounty_id));
                    let escrow: BountyEscrowState = Mapping::get(
                        bounty_escrows,
                        bounty_id,
                    );
                    assert(escrow.locked_amount >= payout.reserved_amount);
                    let unlocked_escrow: BountyEscrowState = BountyEscrowState {
                        owner_address: escrow.owner_address,
                        total_funded: escrow.total_funded,
                        available_balance:
                            escrow.available_balance + payout.reserved_amount,
                        locked_amount:
                            escrow.locked_amount - payout.reserved_amount,
                        paid_amount: escrow.paid_amount,
                        refunded_amount: escrow.refunded_amount,
                        status: escrow.status,
                        last_funding_height: escrow.last_funding_height,
                        last_funding_marker: escrow.last_funding_marker,
                        last_refund_marker: escrow.last_refund_marker,
                    };
                    Mapping::set(bounty_escrows, bounty_id, unlocked_escrow);
                }
                let rejected_payout: ClaimV3PayoutState = ClaimV3PayoutState {
                    claim_hash: payout.claim_hash,
                    bounty_id: payout.bounty_id,
                    whitehat_address: payout.whitehat_address,
                    reserved_amount: payout.reserved_amount,
                    paid_amount: 0u64,
                    status: 3u8,
                    locked_height: payout.locked_height,
                    paid_height: 0u32,
                    release_marker: operation_marker,
                };
                let rejected_state: ClaimV3State = update_claim_v3_state(
                    current,
                    14u8,
                    current.package_hash,
                    current.reproduction_commitment,
                    current.patch_commitment,
                    action_commitment,
                    std::ctx::block_height(),
                );
                Mapping::set(claim_v3_payouts, claim_hash, rejected_payout);
                Mapping::set(claim_v3_states, claim_hash, rejected_state);
                Mapping::set(
                    bounty_claim_counts,
                    bounty_id,
                    unresolved_claims - 1u64,
                );
            }
            Mapping::set(v3_operation_markers, operation_marker, true);
        };
    }

    // Typed dispute opening is authorized by the matching adverse project decision.
    // Type 7 is a bounded SLA escalation: it can be opened only after the
    // responsible actor's review window expires. Detailed evidence remains a
    // commitment, never report plaintext.
    fn dispute_claim_v3(
        public bounty_id: field,
        public claim_hash: field,
        public dispute_type: u8,
        public requested_severity: u8,
        public dispute_commitment: field,
        public fee_amount: u64,
        public dispute_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        let transfer: Final = credits.aleo::transfer_public_as_signer(
            zkbugbounty_7f3c92.aleo,
            fee_amount,
        );
        return final {
            assert(
                dispute_type == 1u8 ||
                dispute_type == 2u8 ||
                dispute_type == 3u8 ||
                dispute_type == 4u8 ||
                dispute_type == 5u8 ||
                dispute_type == 6u8 ||
                dispute_type == 7u8
            );
            assert(dispute_commitment != 0field);
            assert(fee_amount > 0u64);
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            assert(Mapping::contains(claim_receipts, claim_hash));
            assert(Mapping::contains(claim_v3_states, claim_hash));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let config: BountyV3Config = Mapping::get(bounty_v3_configs, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            let current: ClaimV3State = Mapping::get(claim_v3_states, claim_hash);
            let empty_decision: ClaimV3ProjectDecision = ClaimV3ProjectDecision {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                decision: 0u8,
                project_severity: 0u8,
                decision_commitment: 0field,
                decided_height: 0u32,
            };
            let decision: ClaimV3ProjectDecision = Mapping::get_or_use(
                claim_v3_project_decisions,
                claim_hash,
                empty_decision,
            );
            assert_eq(protocol_version, 3u8);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.protocol_version, 3u8);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(fee_amount, config.arbitration_fee_microcredits);
            if dispute_type != 7u8 {
                assert(Mapping::contains(claim_v3_project_decisions, claim_hash));
                assert_eq(decision.claim_hash, claim_hash);
                assert_eq(decision.bounty_id, bounty_id);
            }

            let rejection_dispute: bool =
                dispute_type == 1u8 &&
                signer == current.whitehat_address &&
                current.status == 13u8 &&
                decision.decision == 2u8;
            let duplicate_dispute: bool =
                dispute_type == 2u8 &&
                signer == current.whitehat_address &&
                current.status == 13u8 &&
                decision.decision == 3u8;
            let scope_dispute: bool =
                dispute_type == 3u8 &&
                signer == current.whitehat_address &&
                current.status == 13u8 &&
                decision.decision == 4u8;
            let severity_dispute: bool =
                dispute_type == 4u8 &&
                signer == current.whitehat_address &&
                (current.status == 3u8 || current.status == 13u8) &&
                decision.decision == 5u8 &&
                requested_severity > decision.project_severity &&
                requested_severity <= receipt.severity;
            let reproduction_dispute: bool =
                dispute_type == 5u8 &&
                signer == current.whitehat_address &&
                current.status == 8u8 &&
                decision.decision == 6u8;
            let remediation_dispute: bool =
                dispute_type == 6u8 &&
                signer == bounty.owner_address &&
                current.status == 9u8 &&
                current.patch_commitment != 0field &&
                decision.decision == 7u8 &&
                std::ctx::block_height() >
                current.updated_height + config.review_window_blocks;
            let owner_sla_timeout: bool =
                dispute_type == 7u8 &&
                signer == current.whitehat_address &&
                (current.status == 1u8 ||
                 current.status == 2u8 ||
                 current.status == 3u8 ||
                 current.status == 5u8 ||
                 current.status == 6u8 ||
                 current.status == 7u8 ||
                 current.status == 10u8) &&
                std::ctx::block_height() >
                current.updated_height + config.review_window_blocks;
            let whitehat_sla_timeout: bool =
                dispute_type == 7u8 &&
                signer == bounty.owner_address &&
                current.status == 4u8 &&
                std::ctx::block_height() >
                current.updated_height + config.review_window_blocks;
            let valid_requested_severity: bool =
                dispute_type == 4u8
                    ? requested_severity >= 1u8 &&
                      requested_severity <= receipt.severity
                    : requested_severity == 0u8;
            assert(valid_requested_severity);
            assert(
                rejection_dispute ||
                duplicate_dispute ||
                scope_dispute ||
                severity_dispute ||
                reproduction_dispute ||
                remediation_dispute ||
                owner_sla_timeout ||
                whitehat_sla_timeout
            );

            let next_round: u32 = Mapping::get_or_use(
                claim_v3_dispute_rounds,
                claim_hash,
                1u32,
            );
            assert(next_round < 4294967295u32);
            let dispute_id: field = derive_v3_dispute_id(
                bounty_id,
                claim_hash,
                next_round,
            );
            assert(!Mapping::contains(claim_v3_arbitration_tallies, dispute_id));
            assert(!Mapping::contains(claim_v3_dispute_bonds, dispute_id));
            assert(!Mapping::contains(claim_v3_dispute_metadata, dispute_id));

            let operation_marker: field = derive_operation_marker(
                327field,
                bounty_id,
                claim_hash,
                signer,
                current.whitehat_address,
                fee_amount,
                dispute_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));
            let disputed: ClaimV3State = ClaimV3State {
                claim_hash: current.claim_hash,
                bounty_id: current.bounty_id,
                whitehat_address: current.whitehat_address,
                status: 11u8,
                pre_dispute_status: current.status,
                package_hash: current.package_hash,
                reproduction_commitment: current.reproduction_commitment,
                patch_commitment: current.patch_commitment,
                dispute_commitment: dispute_commitment,
                updated_height: std::ctx::block_height(),
            };
            let tally: ClaimV3ArbitrationTally = ClaimV3ArbitrationTally {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                reject_votes: 0u8,
                medium_votes: 0u8,
                high_votes: 0u8,
                critical_votes: 0u8,
                updated_height: std::ctx::block_height(),
            };
            let bond: ClaimV3DisputeBond = ClaimV3DisputeBond {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                payer: signer,
                amount: fee_amount,
                status: 1u8,
                settled_height: 0u32,
            };
            let metadata: ClaimV3DisputeMetadata = ClaimV3DisputeMetadata {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                dispute_type: dispute_type,
                dispute_commitment: dispute_commitment,
                opener: signer,
                opened_height: std::ctx::block_height(),
                status: 1u8,
                requested_severity: requested_severity,
                final_severity: 0u8,
            };
            Mapping::set(claim_v3_states, claim_hash, disputed);
            Mapping::set(claim_v3_arbitration_tallies, dispute_id, tally);
            Mapping::set(claim_v3_dispute_bonds, dispute_id, bond);
            Mapping::set(claim_v3_dispute_metadata, dispute_id, metadata);
            Mapping::set(claim_v3_dispute_rounds, claim_hash, next_round + 1u32);
            Mapping::set(claim_v3_active_disputes, claim_hash, dispute_id);
            Mapping::set(v3_operation_markers, operation_marker, true);
            transfer.run();
        };
    }

    fn cast_arbitration_vote_v3(
        public bounty_id: field,
        public claim_hash: field,
        public verdict: u8,
        public vote_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        return final {
            assert(verdict <= 3u8);
            assert(vote_marker != 0field);
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            assert(Mapping::contains(claim_receipts, claim_hash));
            assert(Mapping::contains(claim_v3_states, claim_hash));
            let config: BountyV3Config = Mapping::get(bounty_v3_configs, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            let current: ClaimV3State = Mapping::get(claim_v3_states, claim_hash);
            // Edition 2 disputes used `claim_hash` as the record key. Retain
            // that fallback for in-flight historical disputes while all new
            // rounds use the active round key.
            let dispute_id: field = Mapping::get_or_use(
                claim_v3_active_disputes,
                claim_hash,
                claim_hash,
            );
            assert(Mapping::contains(claim_v3_arbitration_tallies, dispute_id));
            assert(Mapping::contains(claim_v3_dispute_metadata, dispute_id));
            let tally: ClaimV3ArbitrationTally = Mapping::get(
                claim_v3_arbitration_tallies,
                dispute_id,
            );
            let metadata: ClaimV3DisputeMetadata = Mapping::get(
                claim_v3_dispute_metadata,
                dispute_id,
            );
            assert_eq(protocol_version, 3u8);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.protocol_version, 3u8);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(metadata.claim_hash, claim_hash);
            assert_eq(metadata.bounty_id, bounty_id);
            assert_eq(metadata.status, 1u8);
            assert(
                metadata.dispute_type == 1u8 ||
                metadata.dispute_type == 2u8 ||
                metadata.dispute_type == 3u8 ||
                metadata.dispute_type == 4u8 ||
                metadata.dispute_type == 5u8 ||
                metadata.dispute_type == 6u8 ||
                metadata.dispute_type == 7u8
            );
            assert_eq(current.status, 11u8);
            assert(current.pre_dispute_status > 0u8);
            assert(is_v3_panel_member(config, signer));
            let binary_ruling: bool =
                metadata.dispute_type == 1u8 ||
                metadata.dispute_type == 2u8 ||
                metadata.dispute_type == 3u8 ||
                metadata.dispute_type == 5u8 ||
                metadata.dispute_type == 6u8 ||
                metadata.dispute_type == 7u8;
            let severity_ruling: bool =
                metadata.dispute_type == 4u8 &&
                verdict <= receipt.severity;
            let valid_binary_ruling: bool =
                binary_ruling &&
                (verdict == 0u8 || verdict == receipt.severity);
            assert(valid_binary_ruling || severity_ruling);
            assert(
                std::ctx::block_height() <=
                current.updated_height + config.decision_window_blocks
            );
            let vote_key: field = derive_v3_vote_key(bounty_id, dispute_id, signer);
            assert(!Mapping::contains(claim_v3_arbitration_votes, vote_key));
            let operation_marker: field = derive_operation_marker(
                328field,
                bounty_id,
                claim_hash,
                signer,
                current.whitehat_address,
                verdict as u64,
                vote_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));
            let vote: ClaimV3ArbitrationVote = ClaimV3ArbitrationVote {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                voter: signer,
                verdict: verdict,
                vote_height: std::ctx::block_height(),
                vote_marker: operation_marker,
            };
            let updated_tally: ClaimV3ArbitrationTally = ClaimV3ArbitrationTally {
                claim_hash: tally.claim_hash,
                bounty_id: tally.bounty_id,
                reject_votes: verdict == 0u8
                    ? tally.reject_votes + 1u8
                    : tally.reject_votes,
                medium_votes: verdict == 1u8
                    ? tally.medium_votes + 1u8
                    : tally.medium_votes,
                high_votes: verdict == 2u8
                    ? tally.high_votes + 1u8
                    : tally.high_votes,
                critical_votes: verdict == 3u8
                    ? tally.critical_votes + 1u8
                    : tally.critical_votes,
                updated_height: std::ctx::block_height(),
            };
            Mapping::set(claim_v3_arbitration_votes, vote_key, vote);
            Mapping::set(claim_v3_arbitration_tallies, dispute_id, updated_tally);
            Mapping::set(v3_operation_markers, operation_marker, true);
        };
    }

    // verdict 0 settles an uncontested award; 1..3 settles a panel award.
    // A disputed reward may only settle through the route allowed by its type.
    fn settle_reward_v3(
        public bounty_id: field,
        public claim_hash: field,
        public whitehat_address: address,
        public reward_amount: u64,
        public bond_amount: u64,
        public verdict: u8,
        public settlement_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        let transfer_amount: u64 = reward_amount + bond_amount;
        let transfer: Final = credits.aleo::transfer_public(
            whitehat_address,
            transfer_amount,
        );
        return final {
            assert(reward_amount > 0u64);
            assert(verdict <= 3u8);
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            assert(Mapping::contains(claim_receipts, claim_hash));
            assert(Mapping::contains(claim_v3_states, claim_hash));
            assert(Mapping::contains(claim_v3_payouts, claim_hash));
            assert(Mapping::contains(bounty_escrows, bounty_id));
            assert(Mapping::contains(bounty_claim_counts, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let config: BountyV3Config = Mapping::get(bounty_v3_configs, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            let current: ClaimV3State = Mapping::get(claim_v3_states, claim_hash);
            let payout: ClaimV3PayoutState = Mapping::get(claim_v3_payouts, claim_hash);
            let escrow: BountyEscrowState = Mapping::get(bounty_escrows, bounty_id);
            let unresolved_claims: u64 = Mapping::get(bounty_claim_counts, bounty_id);
            let dispute_id: field = Mapping::get_or_use(
                claim_v3_active_disputes,
                claim_hash,
                claim_hash,
            );
            let has_metadata: bool = Mapping::contains(
                claim_v3_dispute_metadata,
                dispute_id,
            );
            let empty_metadata: ClaimV3DisputeMetadata = ClaimV3DisputeMetadata {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                dispute_type: 0u8,
                dispute_commitment: 0field,
                opener: whitehat_address,
                opened_height: 0u32,
                status: 0u8,
                requested_severity: 0u8,
                final_severity: 0u8,
            };
            let metadata: ClaimV3DisputeMetadata = Mapping::get_or_use(
                claim_v3_dispute_metadata,
                dispute_id,
                empty_metadata,
            );
            assert_eq(protocol_version, 3u8);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.protocol_version, 3u8);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(current.whitehat_address, whitehat_address);
            assert_eq(payout.bounty_id, bounty_id);
            assert_eq(payout.whitehat_address, whitehat_address);
            assert_eq(payout.status, 1u8);
            assert_eq(escrow.owner_address, bounty.owner_address);
            assert_eq(escrow.status, 1u8);
            assert(escrow.locked_amount >= payout.reserved_amount);
            assert(unresolved_claims > 0u64);

            if has_metadata {
                assert_eq(metadata.claim_hash, claim_hash);
                assert_eq(metadata.bounty_id, bounty_id);
                assert(
                    metadata.dispute_type == 1u8 ||
                    metadata.dispute_type == 2u8 ||
                    metadata.dispute_type == 3u8 ||
                    metadata.dispute_type == 4u8 ||
                    metadata.dispute_type == 5u8 ||
                    metadata.dispute_type == 6u8 ||
                    metadata.dispute_type == 7u8
                );
            }
            let valid_payment_state: bool =
                (config.payment_condition == 1u8 &&
                 (current.status == 7u8 ||
                  current.status == 9u8 ||
                  current.status == 10u8)) ||
                (config.payment_condition == 2u8 &&
                 current.status == 10u8);
            let has_tally: bool = Mapping::contains(
                claim_v3_arbitration_tallies,
                dispute_id,
            );
            let empty_tally: ClaimV3ArbitrationTally = ClaimV3ArbitrationTally {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                reject_votes: 0u8,
                medium_votes: 0u8,
                high_votes: 0u8,
                critical_votes: 0u8,
                updated_height: current.updated_height,
            };
            let tally: ClaimV3ArbitrationTally = Mapping::get_or_use(
                claim_v3_arbitration_tallies,
                dispute_id,
                empty_tally,
            );
            let has_bond: bool = Mapping::contains(
                claim_v3_dispute_bonds,
                dispute_id,
            );
            let empty_bond: ClaimV3DisputeBond = ClaimV3DisputeBond {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                payer: whitehat_address,
                amount: 0u64,
                status: 0u8,
                settled_height: 0u32,
            };
            let bond: ClaimV3DisputeBond = Mapping::get_or_use(
                claim_v3_dispute_bonds,
                dispute_id,
                empty_bond,
            );
            let quorum_award: bool =
                has_tally &&
                verdict >= 1u8 &&
                verdict <= receipt.severity &&
                v3_verdict_has_quorum(tally, verdict, config.quorum);
            let decision_expired: bool =
                std::ctx::block_height() >
                current.updated_height + config.decision_window_blocks;
            let timeout_favors_whitehat: bool =
                (metadata.dispute_type == 5u8 &&
                 (current.pre_dispute_status == 5u8 ||
                  current.pre_dispute_status == 6u8 ||
                  current.pre_dispute_status == 7u8 ||
                  current.pre_dispute_status == 8u8)) ||
                (metadata.dispute_type == 7u8 &&
                 (current.pre_dispute_status == 5u8 ||
                  current.pre_dispute_status == 6u8 ||
                  current.pre_dispute_status == 7u8 ||
                  current.pre_dispute_status == 10u8));
            let timeout_award: bool =
                verdict == receipt.severity &&
                decision_expired &&
                timeout_favors_whitehat;
            let reproduction_payment_ready: bool =
                (config.payment_condition == 1u8 && current.status == 11u8) ||
                (config.payment_condition == 2u8 && current.status == 10u8);

            let reproduction_award: bool =
                has_metadata &&
                metadata.dispute_type == 5u8 &&
                metadata.status == 1u8 &&
                reproduction_payment_ready &&
                has_bond &&
                bond.status == 1u8 &&
                (quorum_award || timeout_award);
            let sla_timeout_award: bool =
                has_metadata &&
                metadata.dispute_type == 7u8 &&
                metadata.status == 1u8 &&
                current.status == 11u8 &&
                has_bond &&
                bond.status == 1u8 &&
                (quorum_award || timeout_award);
            let post_arbitration_award: bool =
                has_metadata &&
                metadata.status == 2u8 &&
                valid_payment_state &&
                verdict >= 1u8 &&
                has_bond &&
                bond.status == 2u8 &&
                verdict <= receipt.severity;
            // The panel result is immutable; callers cannot select another payable severity.
            if post_arbitration_award {
                assert_eq(verdict, metadata.final_severity);
            }
            let uncontested_award: bool =
                valid_payment_state &&
                verdict == 0u8 &&
                !has_bond &&
                !has_metadata;
            assert(
                reproduction_award ||
                sla_timeout_award ||
                post_arbitration_award ||
                uncontested_award
            );

            // The lock is the only economic ceiling after a project severity
            // assessment. Post-lock rulings decide eligibility, never inflate
            // the already reserved amount.
            assert_eq(reward_amount, payout.reserved_amount);
            let expected_bond_amount: u64 =
                (reproduction_award || sla_timeout_award) ? bond.amount : 0u64;
            assert_eq(bond_amount, expected_bond_amount);
            let operation_marker: field = derive_operation_marker(
                329field,
                bounty_id,
                claim_hash,
                signer,
                whitehat_address,
                transfer_amount,
                settlement_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));

            let updated_escrow: BountyEscrowState = BountyEscrowState {
                owner_address: escrow.owner_address,
                total_funded: escrow.total_funded,
                available_balance: escrow.available_balance,
                locked_amount: escrow.locked_amount - payout.reserved_amount,
                paid_amount: escrow.paid_amount + reward_amount,
                refunded_amount: escrow.refunded_amount,
                status: escrow.status,
                last_funding_height: escrow.last_funding_height,
                last_funding_marker: escrow.last_funding_marker,
                last_refund_marker: escrow.last_refund_marker,
            };
            let paid_payout: ClaimV3PayoutState = ClaimV3PayoutState {
                claim_hash: payout.claim_hash,
                bounty_id: payout.bounty_id,
                whitehat_address: payout.whitehat_address,
                reserved_amount: payout.reserved_amount,
                paid_amount: reward_amount,
                status: 2u8,
                locked_height: payout.locked_height,
                paid_height: std::ctx::block_height(),
                release_marker: operation_marker,
            };
            let paid_state: ClaimV3State = update_claim_v3_state(
                current,
                12u8,
                current.package_hash,
                current.reproduction_commitment,
                current.patch_commitment,
                current.dispute_commitment,
                std::ctx::block_height(),
            );
            Mapping::set(bounty_escrows, bounty_id, updated_escrow);
            Mapping::set(claim_v3_payouts, claim_hash, paid_payout);
            Mapping::set(claim_v3_states, claim_hash, paid_state);
            Mapping::set(
                bounty_claim_counts,
                bounty_id,
                unresolved_claims - 1u64,
            );
            if reproduction_award || sla_timeout_award {
                let settled_bond: ClaimV3DisputeBond = ClaimV3DisputeBond {
                    claim_hash: bond.claim_hash,
                    bounty_id: bond.bounty_id,
                    payer: bond.payer,
                    amount: bond.amount,
                    status: 2u8,
                    settled_height: std::ctx::block_height(),
                };
                let accepted_metadata: ClaimV3DisputeMetadata = ClaimV3DisputeMetadata {
                    claim_hash: metadata.claim_hash,
                    bounty_id: metadata.bounty_id,
                    dispute_type: metadata.dispute_type,
                    dispute_commitment: metadata.dispute_commitment,
                    opener: metadata.opener,
                    opened_height: metadata.opened_height,
                    status: 2u8,
                    requested_severity: metadata.requested_severity,
                    final_severity: verdict,
                };
                Mapping::set(claim_v3_dispute_bonds, dispute_id, settled_bond);
                Mapping::set(
                    claim_v3_dispute_metadata,
                    dispute_id,
                    accepted_metadata,
                );
            }
            Mapping::set(v3_operation_markers, operation_marker, true);
            transfer.run();
        };
    }

    fn finalize_arbitration_prelock_v3(
        public bounty_id: field,
        public claim_hash: field,
        public whitehat_address: address,
        public reward_amount: u64,
        public bond_amount: u64,
        public verdict: u8,
        public lock_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        let transfer: Final = credits.aleo::transfer_public(
            whitehat_address,
            bond_amount,
        );
        return final {
            assert(verdict >= 1u8 && verdict <= 3u8);
            assert(reward_amount > 0u64);
            assert(bond_amount > 0u64);
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            assert(Mapping::contains(claim_receipts, claim_hash));
            assert(Mapping::contains(claim_v3_states, claim_hash));
            assert(Mapping::contains(bounty_escrows, bounty_id));
            assert(!Mapping::contains(claim_v3_payouts, claim_hash));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let config: BountyV3Config = Mapping::get(bounty_v3_configs, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            let current: ClaimV3State = Mapping::get(claim_v3_states, claim_hash);
            let dispute_id: field = Mapping::get_or_use(
                claim_v3_active_disputes,
                claim_hash,
                claim_hash,
            );
            assert(Mapping::contains(claim_v3_arbitration_tallies, dispute_id));
            assert(Mapping::contains(claim_v3_dispute_bonds, dispute_id));
            assert(Mapping::contains(claim_v3_dispute_metadata, dispute_id));
            let tally: ClaimV3ArbitrationTally = Mapping::get(
                claim_v3_arbitration_tallies,
                dispute_id,
            );
            let bond: ClaimV3DisputeBond = Mapping::get(
                claim_v3_dispute_bonds,
                dispute_id,
            );
            let metadata: ClaimV3DisputeMetadata = Mapping::get(
                claim_v3_dispute_metadata,
                dispute_id,
            );
            let escrow: BountyEscrowState = Mapping::get(
                bounty_escrows,
                bounty_id,
            );
            assert_eq(protocol_version, 3u8);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.protocol_version, 3u8);
            assert(verdict <= receipt.severity);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(current.whitehat_address, whitehat_address);
            assert_eq(current.status, 11u8);
            assert_eq(bond.bounty_id, bounty_id);
            assert_eq(bond.claim_hash, claim_hash);
            assert_eq(bond.status, 1u8);
            assert_eq(bond_amount, bond.amount);
            assert_eq(metadata.claim_hash, claim_hash);
            assert_eq(metadata.bounty_id, bounty_id);
            assert_eq(metadata.status, 1u8);
            assert(
                metadata.dispute_type == 1u8 ||
                metadata.dispute_type == 2u8 ||
                metadata.dispute_type == 3u8 ||
                metadata.dispute_type == 4u8 ||
                metadata.dispute_type == 5u8 ||
                metadata.dispute_type == 6u8 ||
                metadata.dispute_type == 7u8
            );
            let valid_prelock_type: bool =
                metadata.dispute_type == 1u8 ||
                metadata.dispute_type == 2u8 ||
                metadata.dispute_type == 3u8 ||
                metadata.dispute_type == 4u8 ||
                metadata.dispute_type == 7u8;
            assert(valid_prelock_type);
            let valid_prelock_verdict: bool =
                metadata.dispute_type == 4u8
                    ? verdict <= receipt.severity
                    : verdict == receipt.severity;
            assert(valid_prelock_verdict);
            assert_eq(escrow.owner_address, bounty.owner_address);
            assert_eq(escrow.status, 1u8);

            let quorum_award: bool = v3_verdict_has_quorum(
                tally,
                verdict,
                config.quorum,
            );
            let timeout_favors_whitehat: bool =
                std::ctx::block_height() >
                current.updated_height + config.decision_window_blocks &&
                verdict == receipt.severity &&
                (current.pre_dispute_status == 1u8 ||
                 current.pre_dispute_status == 2u8 ||
                 current.pre_dispute_status == 3u8 ||
                 current.pre_dispute_status == 13u8);
            assert(quorum_award || timeout_favors_whitehat);
            let expected_reward: u64 = reward_for_v3_severity(
                bounty,
                verdict,
            );
            assert_eq(reward_amount, expected_reward);
            assert(escrow.available_balance >= reward_amount);
            let operation_marker: field = derive_operation_marker(
                331field,
                bounty_id,
                claim_hash,
                signer,
                whitehat_address,
                bond_amount,
                lock_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));

            let updated_escrow: BountyEscrowState = BountyEscrowState {
                owner_address: escrow.owner_address,
                total_funded: escrow.total_funded,
                available_balance: escrow.available_balance - reward_amount,
                locked_amount: escrow.locked_amount + reward_amount,
                paid_amount: escrow.paid_amount,
                refunded_amount: escrow.refunded_amount,
                status: escrow.status,
                last_funding_height: escrow.last_funding_height,
                last_funding_marker: escrow.last_funding_marker,
                last_refund_marker: escrow.last_refund_marker,
            };
            let payout: ClaimV3PayoutState = ClaimV3PayoutState {
                claim_hash: claim_hash,
                bounty_id: bounty_id,
                whitehat_address: whitehat_address,
                reserved_amount: reward_amount,
                paid_amount: 0u64,
                status: 1u8,
                locked_height: std::ctx::block_height(),
                paid_height: 0u32,
                release_marker: 0field,
            };
            let locked_state: ClaimV3State = update_claim_v3_state(
                current,
                4u8,
                current.package_hash,
                current.reproduction_commitment,
                current.patch_commitment,
                current.dispute_commitment,
                std::ctx::block_height(),
            );
            let settled_bond: ClaimV3DisputeBond = ClaimV3DisputeBond {
                claim_hash: bond.claim_hash,
                bounty_id: bond.bounty_id,
                payer: bond.payer,
                amount: bond.amount,
                status: 2u8,
                settled_height: std::ctx::block_height(),
            };
            let accepted_metadata: ClaimV3DisputeMetadata = ClaimV3DisputeMetadata {
                claim_hash: metadata.claim_hash,
                bounty_id: metadata.bounty_id,
                dispute_type: metadata.dispute_type,
                dispute_commitment: metadata.dispute_commitment,
                opener: metadata.opener,
                opened_height: metadata.opened_height,
                status: 2u8,
                requested_severity: metadata.requested_severity,
                final_severity: verdict,
            };
            Mapping::set(bounty_escrows, bounty_id, updated_escrow);
            Mapping::set(claim_v3_payouts, claim_hash, payout);
            Mapping::set(claim_v3_states, claim_hash, locked_state);
            Mapping::set(claim_v3_dispute_bonds, dispute_id, settled_bond);
            Mapping::set(claim_v3_dispute_metadata, dispute_id, accepted_metadata);
            Mapping::set(v3_operation_markers, operation_marker, true);
            transfer.run();
        };
    }

    // Finalizes an adverse ruling. For remediation, a positive ruling records
    // patch acceptance; a negative ruling returns to reproduction-confirmed for
    // further remediation rather than rejecting the claim or releasing escrow.
    fn finalize_rejection_v3(
        public bounty_id: field,
        public claim_hash: field,
        public bond_recipient: address,
        public bond_amount: u64,
        public verdict: u8,
        public rejection_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        let transfer: Final = credits.aleo::transfer_public(
            bond_recipient,
            bond_amount,
        );
        return final {
            assert(verdict <= 3u8);
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            assert(Mapping::contains(claim_receipts, claim_hash));
            assert(Mapping::contains(claim_v3_states, claim_hash));
            assert(Mapping::contains(bounty_claim_counts, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let config: BountyV3Config = Mapping::get(bounty_v3_configs, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            let receipt: ClaimReceiptState = Mapping::get(claim_receipts, claim_hash);
            let current: ClaimV3State = Mapping::get(claim_v3_states, claim_hash);
            let dispute_id: field = Mapping::get_or_use(
                claim_v3_active_disputes,
                claim_hash,
                claim_hash,
            );
            assert(Mapping::contains(claim_v3_arbitration_tallies, dispute_id));
            assert(Mapping::contains(claim_v3_dispute_bonds, dispute_id));
            assert(Mapping::contains(claim_v3_dispute_metadata, dispute_id));
            let metadata: ClaimV3DisputeMetadata = Mapping::get(
                claim_v3_dispute_metadata,
                dispute_id,
            );
            let unresolved_claims: u64 = Mapping::get(
                bounty_claim_counts,
                bounty_id,
            );
            let tally: ClaimV3ArbitrationTally = Mapping::get(
                claim_v3_arbitration_tallies,
                dispute_id,
            );
            let bond: ClaimV3DisputeBond = Mapping::get(
                claim_v3_dispute_bonds,
                dispute_id,
            );
            assert_eq(protocol_version, 3u8);
            assert_eq(receipt.bounty_id, bounty_id);
            assert_eq(receipt.protocol_version, 3u8);
            assert_eq(current.bounty_id, bounty_id);
            assert_eq(current.status, 11u8);
            assert_eq(metadata.claim_hash, claim_hash);
            assert_eq(metadata.bounty_id, bounty_id);
            assert_eq(metadata.status, 1u8);
            assert(
                metadata.dispute_type == 1u8 ||
                metadata.dispute_type == 2u8 ||
                metadata.dispute_type == 3u8 ||
                metadata.dispute_type == 4u8 ||
                metadata.dispute_type == 5u8 ||
                metadata.dispute_type == 6u8 ||
                metadata.dispute_type == 7u8
            );
            assert_eq(bond.bounty_id, bounty_id);
            assert_eq(bond.claim_hash, claim_hash);
            assert_eq(bond.status, 1u8);
            assert_eq(bond_amount, bond.amount);
            assert(unresolved_claims > 0u64);

            let remediation_dispute: bool = metadata.dispute_type == 6u8;
            // The Owner opens a remediation dispute only after the Whitehat has
            // not accepted a proposed patch during the review window. If the
            // immutable panel also fails to reach quorum during its decision
            // window, preserve liveness by returning to ReproductionConfirmed
            // and returning the Owner-paid arbitration bond to the Whitehat.
            // This does not unlock or pay the reward: the Owner may propose a
            // new patch and the Whitehat retains the ordinary acceptance path.
            let remediation_timeout: bool =
                remediation_dispute &&
                verdict == 0u8 &&
                std::ctx::block_height() >
                current.updated_height + config.decision_window_blocks;
            let whitehat_sla_timeout: bool =
                metadata.dispute_type == 7u8 &&
                current.pre_dispute_status == 4u8 &&
                std::ctx::block_height() >
                current.updated_height + config.decision_window_blocks;
            let standard_rejection: bool =
                !remediation_dispute &&
                verdict == 0u8 &&
                (v3_verdict_has_quorum(tally, 0u8, config.quorum) ||
                 whitehat_sla_timeout);
            let remediation_ruling: bool =
                remediation_dispute &&
                (verdict == 0u8 || verdict == receipt.severity) &&
                (v3_verdict_has_quorum(tally, verdict, config.quorum) ||
                 remediation_timeout);
            assert(standard_rejection || remediation_ruling);
            let expected_recipient: address =
                remediation_dispute && verdict == 0u8
                    ? current.whitehat_address
                    : bounty.owner_address;
            assert_eq(bond_recipient, expected_recipient);
            let operation_marker: field = derive_operation_marker(
                330field,
                bounty_id,
                claim_hash,
                signer,
                bond_recipient,
                bond_amount,
                rejection_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));

            let settled_bond: ClaimV3DisputeBond = ClaimV3DisputeBond {
                claim_hash: bond.claim_hash,
                bounty_id: bond.bounty_id,
                payer: bond.payer,
                amount: bond.amount,
                status: 2u8,
                settled_height: std::ctx::block_height(),
            };
            if remediation_dispute {
                let remediation_accepted: bool = verdict == receipt.severity;
                let next_status: u8 = remediation_accepted ? 10u8 : 7u8;
                let remediated_state: ClaimV3State = update_claim_v3_state(
                    current,
                    next_status,
                    current.package_hash,
                    current.reproduction_commitment,
                    current.patch_commitment,
                    current.dispute_commitment,
                    std::ctx::block_height(),
                );
                let resolved_metadata: ClaimV3DisputeMetadata = ClaimV3DisputeMetadata {
                    claim_hash: metadata.claim_hash,
                    bounty_id: metadata.bounty_id,
                    dispute_type: metadata.dispute_type,
                    dispute_commitment: metadata.dispute_commitment,
                    opener: metadata.opener,
                    opened_height: metadata.opened_height,
                    status: remediation_accepted ? 2u8 : 3u8,
                    requested_severity: metadata.requested_severity,
                    final_severity: verdict,
                };
                Mapping::set(claim_v3_states, claim_hash, remediated_state);
                Mapping::set(
                    claim_v3_dispute_metadata,
                    dispute_id,
                    resolved_metadata,
                );
            }
            if !remediation_dispute {
                let has_payout: bool = Mapping::contains(
                    claim_v3_payouts,
                    claim_hash,
                );
                let empty_payout: ClaimV3PayoutState = ClaimV3PayoutState {
                    claim_hash: claim_hash,
                    bounty_id: bounty_id,
                    whitehat_address: current.whitehat_address,
                    reserved_amount: 0u64,
                    paid_amount: 0u64,
                    status: 0u8,
                    locked_height: 0u32,
                    paid_height: 0u32,
                    release_marker: 0field,
                };
                let payout: ClaimV3PayoutState = Mapping::get_or_use(
                    claim_v3_payouts,
                    claim_hash,
                    empty_payout,
                );
                if has_payout {
                    assert_eq(payout.bounty_id, bounty_id);
                    assert_eq(payout.whitehat_address, current.whitehat_address);
                    assert_eq(payout.status, 1u8);
                    assert(Mapping::contains(bounty_escrows, bounty_id));
                    let escrow: BountyEscrowState = Mapping::get(
                        bounty_escrows,
                        bounty_id,
                    );
                    assert(escrow.locked_amount >= payout.reserved_amount);
                    let unlocked_escrow: BountyEscrowState = BountyEscrowState {
                        owner_address: escrow.owner_address,
                        total_funded: escrow.total_funded,
                        available_balance:
                            escrow.available_balance + payout.reserved_amount,
                        locked_amount:
                            escrow.locked_amount - payout.reserved_amount,
                        paid_amount: escrow.paid_amount,
                        refunded_amount: escrow.refunded_amount,
                        status: escrow.status,
                        last_funding_height: escrow.last_funding_height,
                        last_funding_marker: escrow.last_funding_marker,
                        last_refund_marker: escrow.last_refund_marker,
                    };
                    Mapping::set(bounty_escrows, bounty_id, unlocked_escrow);
                }
                let rejected_payout: ClaimV3PayoutState = ClaimV3PayoutState {
                    claim_hash: payout.claim_hash,
                    bounty_id: payout.bounty_id,
                    whitehat_address: payout.whitehat_address,
                    reserved_amount: payout.reserved_amount,
                    paid_amount: 0u64,
                    status: 3u8,
                    locked_height: payout.locked_height,
                    paid_height: 0u32,
                    release_marker: operation_marker,
                };
                let rejected_state: ClaimV3State = update_claim_v3_state(
                    current,
                    14u8,
                    current.package_hash,
                    current.reproduction_commitment,
                    current.patch_commitment,
                    current.dispute_commitment,
                    std::ctx::block_height(),
                );
                let rejected_metadata: ClaimV3DisputeMetadata = ClaimV3DisputeMetadata {
                    claim_hash: metadata.claim_hash,
                    bounty_id: metadata.bounty_id,
                    dispute_type: metadata.dispute_type,
                    dispute_commitment: metadata.dispute_commitment,
                    opener: metadata.opener,
                    opened_height: metadata.opened_height,
                    status: 3u8,
                    requested_severity: metadata.requested_severity,
                    final_severity: 0u8,
                };
                Mapping::set(claim_v3_payouts, claim_hash, rejected_payout);
                Mapping::set(claim_v3_states, claim_hash, rejected_state);
                Mapping::set(
                    bounty_claim_counts,
                    bounty_id,
                    unresolved_claims - 1u64,
                );
                Mapping::set(
                    claim_v3_dispute_metadata,
                    dispute_id,
                    rejected_metadata,
                );
            }
            Mapping::set(claim_v3_dispute_bonds, dispute_id, settled_bond);
            Mapping::set(v3_operation_markers, operation_marker, true);
            transfer.run();
        };
    }

    fn refund_bounty_v3(
        public bounty_id: field,
        public amount: u64,
        public refund_marker: field,
    ) -> Final {
        let signer = std::ctx::signer();
        let transfer: Final = credits.aleo::transfer_public(
            signer,
            amount,
        );
        return final {
            assert(amount > 0u64);
            assert(Mapping::contains(bounties, bounty_id));
            assert(Mapping::contains(bounty_v3_configs, bounty_id));
            assert(Mapping::contains(bounty_protocol_versions, bounty_id));
            assert(Mapping::contains(bounty_escrows, bounty_id));
            assert(Mapping::contains(bounty_claim_counts, bounty_id));
            let bounty: BountyState = Mapping::get(bounties, bounty_id);
            let protocol_version: u8 = Mapping::get(bounty_protocol_versions, bounty_id);
            let escrow: BountyEscrowState = Mapping::get(bounty_escrows, bounty_id);
            let unresolved_claims: u64 = Mapping::get(
                bounty_claim_counts,
                bounty_id,
            );
            assert_eq(protocol_version, 3u8);
            assert_eq(bounty.owner_address, signer);
            assert_eq(bounty.status, 3u8);
            assert(std::ctx::block_height() > bounty.disclosure_deadline);
            assert_eq(escrow.owner_address, signer);
            assert_eq(escrow.status, 1u8);
            assert_eq(escrow.locked_amount, 0u64);
            assert_eq(unresolved_claims, 0u64);
            assert_eq(escrow.available_balance, amount);
            let operation_marker: field = derive_operation_marker(
                332field,
                bounty_id,
                0field,
                signer,
                signer,
                amount,
                refund_marker,
            );
            assert(!Mapping::contains(v3_operation_markers, operation_marker));
            let refunded_escrow: BountyEscrowState = BountyEscrowState {
                owner_address: escrow.owner_address,
                total_funded: escrow.total_funded,
                available_balance: 0u64,
                locked_amount: 0u64,
                paid_amount: escrow.paid_amount,
                refunded_amount: escrow.refunded_amount + amount,
                status: 3u8,
                last_funding_height: escrow.last_funding_height,
                last_funding_marker: escrow.last_funding_marker,
                last_refund_marker: operation_marker,
            };
            Mapping::set(bounty_escrows, bounty_id, refunded_escrow);
            Mapping::set(v3_operation_markers, operation_marker, true);
            transfer.run();
        };
    }

    @admin(address = "aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6")
    constructor() {}
}
