// This fixture is never deployed. It mirrors the public key derivations in
// zkbugbounty_7f3c92.aleo so the localhost E2E can read exact vote and marker
// mappings before and after intentionally rejected operations.
program v3_public_key_deriver.aleo {
    @noupgrade
    constructor() {}

    fn derive_vote_key(
        public bounty_id: field,
        public claim_hash: field,
        public voter: address,
    ) -> field {
        let voter_commitment: field = BHP256::hash_to_field(voter);
        return Poseidon4::hash_to_field([
            302field,
            bounty_id,
            claim_hash,
            voter_commitment,
        ]);
    }

    fn derive_operation_marker(
        public operation_domain: field,
        public bounty_id: field,
        public claim_hash: field,
        public caller: address,
        public recipient: address,
        public amount: u64,
        public nonce: field,
    ) -> field {
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
}
