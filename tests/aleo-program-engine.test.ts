import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { assertNoPrivateFields } from "../lib/privacy-guards.ts";
import { createAleoProgramEngine } from "../lib/proof-engines/index.ts";
import { createInitialDemoState } from "../lib/store.ts";
import type { PrivateProofInput } from "../lib/proof-engines/types.ts";
import type { LeoCliDetection, LeoCommandRunner } from "../lib/leo-cli.ts";

const DEPLOYER_PUBLIC_ALEO_ADDRESS =
  "aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6";

const validInput: PrivateProofInput = {
  vaultBalanceBefore: 100,
  totalClaimsBefore: 80,
  hiddenDeltaBalance: 90,
  hiddenDeltaClaims: 30,
  privateCallSequence: "aleo local sequence must not leak",
  privateStateValues: "aleo local state must not leak",
  reporterSecret: "aleo-whitehat-secret",
  bugType: "Vault accounting invariant breach",
};

const unavailableLeo: LeoCliDetection = {
  available: false,
  mode: "unavailable",
  reason: "Leo CLI is not available. Please run through WSL or install Leo in the current environment.",
};

const wslLeo: LeoCliDetection = {
  available: true,
  mode: "wsl",
  version: "leo 4.0.2",
  command: "wsl bash -lc",
};

const validLeoOutput = `
➡️  Output
• {
  verified: true,
  severity: 3u8,
  claim_hash: 15007field,
  witness_commitment: 9018field,
  nullifier: 10002field,
  reporter_commitment: 7007field,
  bug_type_id: 1field,
  rule_id: 1field
}
`;

test("aleo program engine falls back when Leo CLI is unavailable without crashing", async () => {
  const state = createInitialDemoState();
  const engine = createAleoProgramEngine(new Set(), {
    detection: unavailableLeo,
  });
  const proof = await engine.generateProof(validInput, state.bounties[0]);

  assert.equal(engine.name, "Aleo Leo Proof");
  assert.equal(engine.mode, "aleo-program");
  assert.equal(proof.proofEngine, "Aleo Leo Proof");
  assert.equal(proof.verified, false);
  assert.equal(proof.proofStatus, "Invalid");
  assert.equal(
    proof.reason,
    "Leo execution is unavailable. This development engine runs only with a local Leo CLI.",
  );
});

test("aleo program engine parses WSL Leo output into public proof result", async () => {
  const state = createInitialDemoState();
  const runner: LeoCommandRunner = async () => ({
    exitCode: 0,
    stdout: validLeoOutput,
    stderr: "",
  });
  const proof = await createAleoProgramEngine(new Set(), {
    detection: wslLeo,
    runner,
  }).generateProof(validInput, state.bounties[0]);

  assert.equal(proof.verified, true);
  assert.equal(proof.proofStatus, "Verified");
  assert.equal(proof.proofEngine, "Aleo Leo Proof");
  assert.equal(proof.severity, "Critical");
  assert.equal(proof.claimHash, "15007field");
  assert.equal(proof.witnessCommitment, "9018field");
  assert.equal(proof.nullifier, "10002field");
  assert.equal(proof.reporterCommitment, "7007field");
  assert.match(proof.receiptId, /^leo-local:/);
  assert.match(proof.registryKey, /^leo-local:/);
  assert.equal(proof.verification?.level, "LocalExecution");
  assertNoPrivateFields(proof);
});

test("aleo program engine output contains no private proof fields", async () => {
  const state = createInitialDemoState();
  const proof = await createAleoProgramEngine(new Set(), {
    detection: unavailableLeo,
  }).generateProof(validInput, state.bounties[0]);
  const serialized = JSON.stringify(proof);

  for (const forbidden of [
    "vaultBalanceBefore",
    "totalClaimsBefore",
    "hiddenDeltaBalance",
    "hiddenDeltaClaims",
    "privateCallSequence",
    "privateStateValues",
    "reporterSecret",
    validInput.privateCallSequence,
    validInput.privateStateValues,
    validInput.reporterSecret,
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} leaked from Aleo proof result`);
  }
  assertNoPrivateFields(proof);
});

test("aleo program engine reports a safe constraint rejection without echoing private input", async () => {
  const state = createInitialDemoState();
  const runner: LeoCommandRunner = async () => ({
    exitCode: 1,
    stdout: "",
    stderr: "Failed to evaluate program: Instruction (assert.eq r117 true;) failed",
  });
  const proof = await createAleoProgramEngine(new Set(), {
    detection: wslLeo,
    runner,
  }).generateProof(validInput, state.bounties[0]);

  assert.equal(proof.verified, false);
  assert.equal(proof.proofStatus, "Invalid");
  assert.equal(proof.reason, "Leo constraints rejected this proof. No verified claim was created.");
  assert.equal(JSON.stringify(proof).includes(validInput.reporterSecret), false);
  assertNoPrivateFields(proof);
});

test("aleo program engine rejects a duplicate Leo nullifier", async () => {
  const state = createInitialDemoState();
  const runner: LeoCommandRunner = async () => ({ exitCode: 0, stdout: validLeoOutput, stderr: "" });
  const proof = await createAleoProgramEngine(new Set(["10002field"]), {
    detection: wslLeo,
    runner,
  }).generateProof(validInput, state.bounties[0]);

  assert.equal(proof.verified, false);
  assert.equal(proof.proofStatus, "Invalid");
  assert.match(proof.reason ?? "", /Duplicate claim/);
});

test("aleo development engine has no remote private-input transport", () => {
  const source = readFileSync("lib/proof-engines/aleo-program-engine.ts", "utf8");

  for (const forbidden of ["ALEO_PROVER_URL", "ALEO_PROVER_AUTH_TOKEN", "remoteProverUrl", "runRemoteProver"] as const) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must not exist in the proof engine`);
  }
});

test("aleo program files are present with the expected public transition boundary", () => {
  const files = [
    "leo/bug_proof/program.json",
    "leo/bug_proof/src/main.leo",
    "leo/bug_proof/inputs/valid.in",
    "leo/bug_proof/inputs/invalid.in",
    "leo/bug_proof/inputs/low-impact.in",
    "leo/bug_proof/scripts/run-valid.sh",
    "leo/bug_proof/scripts/run-invalid.sh",
    "leo/bug_proof/scripts/run-low-impact.sh",
  ];

  for (const file of files) {
    assert.equal(existsSync(file), true, `${file} must exist`);
  }

  const packageMetadata = JSON.parse(readFileSync("leo/bug_proof/program.json", "utf8")) as {
    license?: string;
  };
  assert.equal(packageMetadata.license, "MIT");

  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8");
  assert.equal(source.includes("program zkbugbounty_7f3c92.aleo"), true);
  assert.equal(source.includes("prove_vault_invariant_break"), true);
  assert.equal(source.includes("public bounty_id"), true);
  assert.equal(source.includes("public scope_hash"), true);
  assert.equal(source.includes("public rule_id"), true);
  assert.equal(source.includes(") -> public ProofResult"), true);
  assert.equal(source.includes("assert(arithmetic_valid)"), true);
  assert.equal(source.includes("assert(verified)"), true);
  assert.equal(source.includes("Poseidon8::hash_to_field"), true);
  assert.equal(source.includes("reporter_secret +"), false);
  assert.equal(
    source.includes(`@admin(address = "${DEPLOYER_PUBLIC_ALEO_ADDRESS}")\n    constructor() {}`),
    true,
  );
  assert.equal(source.includes("@noupgrade"), false);
  assert.equal((source.match(/\bconstructor\s*\(\s*\)/g) ?? []).length, 1);
  for (const ruleField of ["1field", "2field", "3field", "4field"]) {
    assert.equal(source.includes(`rule_id == ${ruleField}`), true);
  }

  for (const forbiddenOutput of [
    "return vault_balance_before",
    "return total_claims_before",
    "return hidden_delta_balance",
    "return hidden_delta_claims",
    "return reporter_secret",
  ]) {
    assert.equal(source.includes(forbiddenOutput), false, `${forbiddenOutput} must not be public output`);
  }
});

test("aleo upgrade boundary preserves mappings, structs, records, and entry signatures", () => {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8");

  const readStruct = (name: string) => {
    const match = source.match(new RegExp(`struct\\s+${name}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `${name} struct must exist`);
    return match[1]
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);
  };
  const readSignature = (name: string) => {
    const match = source.match(
      new RegExp(`\\bfn\\s+${name}\\s*\\(([\\s\\S]*?)\\)\\s*->\\s*([^\\{]+)\\{`),
    );
    assert.ok(match, `${name} entry function must exist`);
    return {
      inputs: match[1]
        .split(",")
        .map((input) => input.trim())
        .filter(Boolean),
      output: match[2].trim(),
    };
  };

  assert.deepEqual(readStruct("BountyState"), [
    "owner_address: address",
    "scope_hash: field",
    "rule_id: field",
    "critical_reward: u64",
    "high_reward: u64",
    "medium_reward: u64",
    "low_reward: u64",
    "disclosure_deadline: u32",
    "status: u8",
  ]);
  assert.deepEqual(readStruct("ClaimReceiptState"), [
    "claim_hash: field",
    "bounty_id: field",
    "rule_id: field",
    "scope_hash: field",
    "severity: u8",
    "witness_commitment: field",
    "nullifier: field",
    "reporter_commitment: field",
    "proof_status: u8",
    "created_height: u32",
    "protocol_version: u8",
  ]);
  assert.deepEqual(readStruct("ProofResult"), [
    "verified: bool",
    "severity: u8",
    "claim_hash: field",
    "witness_commitment: field",
    "nullifier: field",
    "reporter_commitment: field",
    "bug_type_id: field",
    "rule_id: field",
  ]);

  assert.equal(/^\s*record\s+/m.test(source), false);
  for (const mapping of [
    "mapping bounties: field => BountyState;",
    "mapping nullifiers: field => field;",
    "mapping claim_receipts: field => ClaimReceiptState;",
  ]) {
    assert.equal(source.includes(mapping), true, `${mapping} must remain stable`);
  }

  const privateProofInputs = [
    "public bounty_id: field",
    "public scope_hash: field",
    "public rule_id: field",
    "vault_balance_before: u64",
    "total_deposits_before: u64",
    "total_claims_before: u64",
    "reserved_rewards_before: u64",
    "withdraw_limit_before: u64",
    "user_balance_before: u64",
    "requested_withdraw_before: u64",
    "hidden_delta_balance: u64",
    "hidden_delta_claims: u64",
    "hidden_delta_reserved_rewards: u64",
    "hidden_delta_withdraw_amount: u64",
    "hidden_delta_user_balance: u64",
    "reporter_secret: field",
  ];

  assert.deepEqual(readSignature("prove_vault_invariant_break"), {
    inputs: privateProofInputs,
    output: "public ProofResult",
  });
  assert.deepEqual(readSignature("submit_claim"), {
    inputs: privateProofInputs,
    output: "(public ProofResult, Final)",
  });
  assert.deepEqual(readSignature("create_bounty"), {
    inputs: [
      "public bounty_id: field",
      "public scope_hash: field",
      "public rule_id: field",
      "public critical_reward: u64",
      "public high_reward: u64",
      "public medium_reward: u64",
      "public low_reward: u64",
      "public disclosure_deadline: u32",
    ],
    output: "Final",
  });
  assert.deepEqual(readSignature("pause_bounty"), {
    inputs: ["public bounty_id: field"],
    output: "Final",
  });
  assert.deepEqual(readSignature("close_bounty"), {
    inputs: ["public bounty_id: field"],
    output: "Final",
  });
});
