program zkbugbounty_7f3c92.aleo;

struct ProofResult:
    verified as boolean;
    severity as u8;
    claim_hash as field;
    witness_commitment as field;
    nullifier as field;
    reporter_commitment as field;
    bug_type_id as field;
    rule_id as field;

struct BountyState:
    owner_address as address;
    scope_hash as field;
    rule_id as field;
    critical_reward as u64;
    high_reward as u64;
    medium_reward as u64;
    low_reward as u64;
    disclosure_deadline as u32;
    status as u8;

struct ClaimReceiptState:
    claim_hash as field;
    bounty_id as field;
    rule_id as field;
    scope_hash as field;
    severity as u8;
    witness_commitment as field;
    nullifier as field;
    reporter_commitment as field;
    proof_status as u8;
    created_height as u32;
    protocol_version as u8;

mapping bounties:
    key as field.public;
    value as BountyState.public;

mapping nullifiers:
    key as field.public;
    value as field.public;

mapping claim_receipts:
    key as field.public;
    value as ClaimReceiptState.public;

closure compute_vault_invariant_break:
    input r0 as field;
    input r1 as field;
    input r2 as field;
    input r3 as u64;
    input r4 as u64;
    input r5 as u64;
    input r6 as u64;
    input r7 as u64;
    input r8 as u64;
    input r9 as u64;
    input r10 as u64;
    input r11 as u64;
    input r12 as u64;
    input r13 as u64;
    input r14 as u64;
    input r15 as field;
    cast r3 into r16 as field;
    cast r4 into r17 as field;
    cast r5 into r18 as field;
    cast r6 into r19 as field;
    cast r7 into r20 as field;
    cast r8 into r21 as field;
    cast r9 into r22 as field;
    cast r16 r17 r18 r19 r20 r21 r22 101field into r23 as [field; 8u32];
    hash.psd8 r23 into r24 as field;
    cast r10 into r25 as field;
    cast r11 into r26 as field;
    cast r12 into r27 as field;
    cast r13 into r28 as field;
    cast r14 into r29 as field;
    cast r25 r26 r27 r28 r29 r0 r1 r2 into r30 as [field; 8u32];
    hash.psd8 r30 into r31 as field;
    cast 102field r15 into r32 as [field; 2u32];
    hash.psd2 r32 into r33 as field;
    cast 103field r24 r31 r33 into r34 as [field; 4u32];
    hash.psd4 r34 into r35 as field;
    cast 104field r0 r2 r15 into r36 as [field; 4u32];
    hash.psd4 r36 into r37 as field;
    lte r10 r3 into r38;
    lte r14 r8 into r39;
    and r38 r39 into r40;
    assert.eq r40 true;
    cast r3 into r41 as u128;
    cast r10 into r42 as u128;
    sub.w r41 r42 into r43;
    cast r4 into r44 as u128;
    cast r5 into r45 as u128;
    cast r11 into r46 as u128;
    add r45 r46 into r47;
    cast r6 into r48 as u128;
    cast r12 into r49 as u128;
    add r48 r49 into r50;
    cast r7 into r51 as u128;
    cast r8 into r52 as u128;
    cast r14 into r53 as u128;
    sub.w r52 r53 into r54;
    cast r9 into r55 as u128;
    cast r13 into r56 as u128;
    add r55 r56 into r57;
    is.eq r2 1field into r58;
    is.eq r2 2field into r59;
    is.eq r2 3field into r60;
    is.eq r2 4field into r61;
    or r58 r59 into r62;
    or r62 r60 into r63;
    or r63 r61 into r64;
    gte r3 r5 into r65;
    lt r43 r47 into r66;
    sub.w r47 r43 into r67;
    ternary r66 r67 0u128 into r68;
    lte r5 r4 into r69;
    gt r47 r44 into r70;
    sub.w r47 r44 into r71;
    ternary r70 r71 0u128 into r72;
    lte r6 r3 into r73;
    gt r50 r43 into r74;
    sub.w r50 r43 into r75;
    ternary r74 r75 0u128 into r76;
    lte r9 r7 into r77;
    lte r9 r8 into r78;
    and r77 r78 into r79;
    gt r57 r51 into r80;
    gt r57 r54 into r81;
    or r80 r81 into r82;
    sub.w r57 r51 into r83;
    ternary r80 r83 0u128 into r84;
    sub.w r57 r54 into r85;
    ternary r81 r85 0u128 into r86;
    gt r84 r86 into r87;
    ternary r87 r84 r86 into r88;
    and r58 r65 into r89;
    and r59 r69 into r90;
    or r89 r90 into r91;
    and r60 r73 into r92;
    or r91 r92 into r93;
    and r61 r79 into r94;
    or r93 r94 into r95;
    and r58 r66 into r96;
    and r59 r70 into r97;
    or r96 r97 into r98;
    and r60 r74 into r99;
    or r98 r99 into r100;
    and r61 r82 into r101;
    or r100 r101 into r102;
    ternary r61 r88 0u128 into r103;
    ternary r60 r76 r103 into r104;
    ternary r59 r72 r104 into r105;
    ternary r58 r68 r105 into r106;
    gte r106 100u128 into r107;
    gte r106 50u128 into r108;
    gte r106 10u128 into r109;
    ternary r109 1u8 0u8 into r110;
    ternary r108 2u8 r110 into r111;
    ternary r107 3u8 r111 into r112;
    and r64 r40 into r113;
    and r113 r95 into r114;
    and r114 r102 into r115;
    gte r112 1u8 into r116;
    and r115 r116 into r117;
    assert.eq r117 true;
    cast r112 into r118 as field;
    cast 105field r0 r1 r2 r35 r37 r118 r2 into r119 as [field; 8u32];
    hash.psd8 r119 into r120 as field;
    cast r117 r112 r120 r35 r37 r33 r2 r2 into r121 as ProofResult;
    output r121 as ProofResult;

function prove_vault_invariant_break:
    input r0 as field.public;
    input r1 as field.public;
    input r2 as field.public;
    input r3 as u64.private;
    input r4 as u64.private;
    input r5 as u64.private;
    input r6 as u64.private;
    input r7 as u64.private;
    input r8 as u64.private;
    input r9 as u64.private;
    input r10 as u64.private;
    input r11 as u64.private;
    input r12 as u64.private;
    input r13 as u64.private;
    input r14 as u64.private;
    input r15 as field.private;
    call compute_vault_invariant_break r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 into r16;
    output r16 as ProofResult.public;

function submit_claim:
    input r0 as field.public;
    input r1 as field.public;
    input r2 as field.public;
    input r3 as u64.private;
    input r4 as u64.private;
    input r5 as u64.private;
    input r6 as u64.private;
    input r7 as u64.private;
    input r8 as u64.private;
    input r9 as u64.private;
    input r10 as u64.private;
    input r11 as u64.private;
    input r12 as u64.private;
    input r13 as u64.private;
    input r14 as u64.private;
    input r15 as field.private;
    call compute_vault_invariant_break r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 into r16;
    async submit_claim r0 r1 r2 r16.nullifier r16.claim_hash r16.severity r16.witness_commitment r16.reporter_commitment into r17;
    output r16 as ProofResult.public;
    output r17 as zkbugbounty_7f3c92.aleo/submit_claim.future;

finalize submit_claim:
    input r0 as field.public;
    input r1 as field.public;
    input r2 as field.public;
    input r3 as field.public;
    input r4 as field.public;
    input r5 as u8.public;
    input r6 as field.public;
    input r7 as field.public;
    contains bounties[r0] into r8;
    assert.eq r8 true;
    get bounties[r0] into r9;
    assert.eq r9.scope_hash r1;
    assert.eq r9.rule_id r2;
    assert.eq r9.status 1u8;
    lte block.height r9.disclosure_deadline into r10;
    assert.eq r10 true;
    contains nullifiers[r3] into r11;
    not r11 into r12;
    assert.eq r12 true;
    contains claim_receipts[r4] into r13;
    not r13 into r14;
    assert.eq r14 true;
    cast r4 r0 r2 r1 r5 r6 r3 r7 1u8 block.height 1u8 into r15 as ClaimReceiptState;
    set r0 into nullifiers[r3];
    set r15 into claim_receipts[r4];

function create_bounty:
    input r0 as field.public;
    input r1 as field.public;
    input r2 as field.public;
    input r3 as u64.public;
    input r4 as u64.public;
    input r5 as u64.public;
    input r6 as u64.public;
    input r7 as u32.public;
    async create_bounty r0 r2 r3 r4 r5 r6 r7 self.signer r1 into r8;
    output r8 as zkbugbounty_7f3c92.aleo/create_bounty.future;

finalize create_bounty:
    input r0 as field.public;
    input r1 as field.public;
    input r2 as u64.public;
    input r3 as u64.public;
    input r4 as u64.public;
    input r5 as u64.public;
    input r6 as u32.public;
    input r7 as address.public;
    input r8 as field.public;
    contains bounties[r0] into r9;
    not r9 into r10;
    assert.eq r10 true;
    is.eq r1 1field into r11;
    is.eq r1 2field into r12;
    or r11 r12 into r13;
    is.eq r1 3field into r14;
    or r13 r14 into r15;
    is.eq r1 4field into r16;
    or r15 r16 into r17;
    gte r2 r3 into r18;
    gte r3 r4 into r19;
    and r18 r19 into r20;
    gte r4 r5 into r21;
    and r20 r21 into r22;
    gt r2 0u64 into r23;
    and r22 r23 into r24;
    assert.eq r17 true;
    assert.eq r24 true;
    gt r6 block.height into r25;
    assert.eq r25 true;
    cast r7 r8 r1 r2 r3 r4 r5 r6 1u8 into r26 as BountyState;
    set r26 into bounties[r0];

function pause_bounty:
    input r0 as field.public;
    async pause_bounty r0 self.signer into r1;
    output r1 as zkbugbounty_7f3c92.aleo/pause_bounty.future;

finalize pause_bounty:
    input r0 as field.public;
    input r1 as address.public;
    contains bounties[r0] into r2;
    assert.eq r2 true;
    get bounties[r0] into r3;
    assert.eq r3.owner_address r1;
    assert.eq r3.status 1u8;
    cast r3.owner_address r3.scope_hash r3.rule_id r3.critical_reward r3.high_reward r3.medium_reward r3.low_reward r3.disclosure_deadline 2u8 into r4 as BountyState;
    set r4 into bounties[r0];

function close_bounty:
    input r0 as field.public;
    async close_bounty r0 self.signer into r1;
    output r1 as zkbugbounty_7f3c92.aleo/close_bounty.future;

finalize close_bounty:
    input r0 as field.public;
    input r1 as address.public;
    contains bounties[r0] into r2;
    assert.eq r2 true;
    get bounties[r0] into r3;
    assert.eq r3.owner_address r1;
    is.eq r3.status 1u8 into r4;
    is.eq r3.status 2u8 into r5;
    or r4 r5 into r6;
    assert.eq r6 true;
    cast r3.owner_address r3.scope_hash r3.rule_id r3.critical_reward r3.high_reward r3.medium_reward r3.low_reward r3.disclosure_deadline 3u8 into r7 as BountyState;
    set r7 into bounties[r0];

constructor:
    assert.eq program_owner aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6;
