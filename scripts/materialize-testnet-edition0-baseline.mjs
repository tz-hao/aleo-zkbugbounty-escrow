#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TESTNET_EDITION_ZERO_FIXTURE_SHA256 =
  "5f60a222cc989a55285258d1fa89ae46a6aa9e4487a396898e28cf94aa7afdf2";

function removeBalancedBlock(source, declaration) {
  const match = declaration.exec(source);
  if (!match || match.index === undefined) {
    throw new Error(`missing declaration: ${declaration}`);
  }

  const start = match.index;
  const open = source.indexOf("{", start);
  if (open < 0) throw new Error(`missing block body: ${declaration}`);

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        while (source[end] === "\n") end += 1;
        return source.slice(0, start) + source.slice(end);
      }
    }
  }

  throw new Error(`unterminated block: ${declaration}`);
}

function removeMapping(source, name) {
  const expression = new RegExp(`^    mapping ${name}:.*;\\n`, "m");
  if (!expression.test(source)) {
    throw new Error(`missing mapping: ${name}`);
  }
  return source.replace(expression, "");
}

function assertContains(source, marker) {
  if (!source.includes(marker)) throw new Error(`generated edition 0 source is missing: ${marker}`);
}

function assertNotContains(source, marker) {
  if (source.includes(marker)) throw new Error(`generated edition 0 source retains forbidden marker: ${marker}`);
}

export function materializeTestnetEditionZeroSource(candidateSource) {
  let source = candidateSource.replace(/\r\n/g, "\n");

  for (const name of ["BountyEscrowState", "ClaimPayoutState", "ClaimTriageState"]) {
    source = removeBalancedBlock(source, new RegExp(`^(?:    )?struct ${name} \\{`, "m"));
  }

  for (const name of [
    "bounty_escrows",
    "claim_payouts",
    "bounty_claim_counts",
    "claim_reporters",
    "claim_triage_states",
    "bounty_protocol_versions",
    "escrow_operation_markers",
  ]) {
    source = removeMapping(source, name);
  }

  source = removeBalancedBlock(source, /^    fn submit_claim_v2\(/m);
  source = source.replace(/^            Mapping::set\(bounty_claim_counts, bounty_id, 0u64\);\n/m, "");
  source = source.replace(/^            Mapping::set\(bounty_protocol_versions, bounty_id, 2u8\);\n/m, "");

  const escrowStart = source.indexOf("    // Edition 0 ABI is preserved but disabled before any Credits call.\n    fn fund_bounty(");
  const constructorStart = source.indexOf("    @admin(", escrowStart);
  if (escrowStart < 0 || constructorStart < 0) {
    throw new Error("could not isolate edition 1 escrow entries from the local edition 0 baseline");
  }
  source = source.slice(0, escrowStart) + source.slice(constructorStart);

  for (const marker of [
    "struct BountyState",
    "struct ClaimReceiptState",
    "mapping bounties:",
    "mapping nullifiers:",
    "mapping claim_receipts:",
    "fn prove_vault_invariant_break(",
    "fn submit_claim(",
    "fn create_bounty(",
    "fn pause_bounty(",
    "fn close_bounty(",
    "@admin(address =",
  ]) {
    assertContains(source, marker);
  }

  for (const marker of [
    "BountyEscrowState",
    "ClaimPayoutState",
    "ClaimTriageState",
    "bounty_escrows",
    "claim_payouts",
    "bounty_claim_counts",
    "claim_reporters",
    "claim_triage_states",
    "bounty_protocol_versions",
    "escrow_operation_markers",
    "fn submit_claim_v2(",
    "fn fund_bounty(",
    "fn lock_reward(",
    "fn request_encrypted_details(",
    "fn share_encrypted_details(",
    "fn mark_patched(",
    "fn release_reward(",
    "fn reject_claim(",
    "fn refund_bounty(",
  ]) {
    assertNotContains(source, marker);
  }

  return source;
}

export function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

export async function materializeTestnetEditionZeroBaseline({
  candidatePath,
  targetPath,
  fixturePath,
}) {
  const [candidateSource, fixtureSource] = await Promise.all([
    readFile(candidatePath, "utf8"),
    readFile(fixturePath, "utf8"),
  ]);
  const fixtureHash = sha256(fixtureSource);
  if (fixtureHash !== TESTNET_EDITION_ZERO_FIXTURE_SHA256) {
    throw new Error(`Testnet edition 0 fixture SHA256 mismatch: ${fixtureHash}`);
  }
  assertContains(fixtureSource, "finalize submit_claim:");
  assertContains(fixtureSource, "input r7 as field.public;");

  const baselineSource = materializeTestnetEditionZeroSource(candidateSource);
  await writeFile(targetPath, baselineSource, "utf8");
  return { fixtureHash, targetPath };
}

async function main() {
  const [candidatePath, targetPath, fixturePath] = process.argv.slice(2);
  if (!candidatePath || !targetPath || !fixturePath) {
    throw new Error("usage: materialize-testnet-edition0-baseline.mjs <candidate-source> <target-source> <fixture>");
  }

  const result = await materializeTestnetEditionZeroBaseline({
    candidatePath: path.resolve(candidatePath),
    targetPath: path.resolve(targetPath),
    fixturePath: path.resolve(fixturePath),
  });
  console.log(`[baseline-source] fixture SHA256 verified: ${result.fixtureHash}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}