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
            transfer.run();
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
            transfer.run();

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
            transfer.run();

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
            transfer.run();

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
            transfer.run();

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
        };
    }

    @admin(address = "aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6")
    constructor() {}
}
