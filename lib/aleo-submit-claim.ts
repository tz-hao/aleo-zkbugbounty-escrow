import {
  ALEO_WALLET_TESTNET_CHAIN_ID,
  getRuleFieldLiteral,
} from "./aleo-create-bounty.ts";
import { CANONICAL_ALEO_PROGRAM_ID } from "./aleo-program.ts";
import type { OnChainBountyState } from "./models.ts";

export const SUBMIT_CLAIM_FUNCTION = "submit_claim";
export const DEFAULT_SUBMIT_CLAIM_FEE_MICROCREDITS = 5_000_000;

export const SUBMIT_CLAIM_ABI_INPUTS = [
  { name: "bounty_id", mode: "public", type: "field" },
  { name: "scope_hash", mode: "public", type: "field" },
  { name: "rule_id", mode: "public", type: "field" },
  { name: "vault_balance_before", mode: "private", type: "u64" },
  { name: "total_deposits_before", mode: "private", type: "u64" },
  { name: "total_claims_before", mode: "private", type: "u64" },
  { name: "reserved_rewards_before", mode: "private", type: "u64" },
  { name: "withdraw_limit_before", mode: "private", type: "u64" },
  { name: "user_balance_before", mode: "private", type: "u64" },
  { name: "requested_withdraw_before", mode: "private", type: "u64" },
  { name: "hidden_delta_balance", mode: "private", type: "u64" },
  { name: "hidden_delta_claims", mode: "private", type: "u64" },
  { name: "hidden_delta_reserved_rewards", mode: "private", type: "u64" },
  { name: "hidden_delta_withdraw_amount", mode: "private", type: "u64" },
  { name: "hidden_delta_user_balance", mode: "private", type: "u64" },
  { name: "reporter_secret", mode: "private", type: "field" },
] as const;

export type TransientSubmitClaimWitness = {
  vaultBalanceBefore: string;
  totalDepositsBefore: string;
  totalClaimsBefore: string;
  reservedRewardsBefore: string;
  withdrawLimitBefore: string;
  userBalanceBefore: string;
  requestedWithdrawBefore: string;
  hiddenDeltaBalance: string;
  hiddenDeltaClaims: string;
  hiddenDeltaReservedRewards: string;
  hiddenDeltaWithdrawAmount: string;
  hiddenDeltaUserBalance: string;
  reporterSecretField: string;
};

export type TransientSubmitClaimRequest = {
  bounty: OnChainBountyState;
  latestBlockHeight: number;
  feeMicrocredits: number;
  witness: TransientSubmitClaimWitness;
};

export type ControlledSubmitClaimInputPreview = {
  bountyId: string;
  scopeHash: string;
  rule: string;
  feeMicrocredits: number;
  claimHash: string;
  nullifier: string;
  witnessCommitment: string;
  reporterCommitment: string;
  severity: string;
};

export type PrivateDigest = (
  algorithm: AlgorithmIdentifier,
  data: BufferSource,
) => Promise<ArrayBuffer>;

const MAX_U64 = (1n << 64n) - 1n;
const FIELD_LITERAL_PATTERN = /^[0-9]+field$/;

function asU64Literal(value: string, label: string) {
  const normalized = value.trim();
  if (!/^[0-9]+$/.test(normalized)) {
    throw new Error(`${label} must be an unsigned integer`);
  }
  const parsed = BigInt(normalized);
  if (parsed > MAX_U64) throw new Error(`${label} exceeds u64`);
  return `${parsed}u64`;
}

function assertCanonicalBounty(
  bounty: OnChainBountyState,
  latestBlockHeight: number,
) {
  if (
    bounty.source !== "AleoTestnet" ||
    bounty.network !== "testnet" ||
    bounty.programId !== CANONICAL_ALEO_PROGRAM_ID ||
    bounty.mapping !== "bounties"
  ) {
    throw new Error("submit_claim requires a canonical Aleo Testnet bounty");
  }
  if (
    !FIELD_LITERAL_PATTERN.test(bounty.bountyId) ||
    !FIELD_LITERAL_PATTERN.test(bounty.scopeHash)
  ) {
    throw new Error("submit_claim public field inputs are invalid");
  }
  if (bounty.status !== "Active") {
    throw new Error("submit_claim requires an active bounty");
  }
  if (!Number.isSafeInteger(latestBlockHeight) || latestBlockHeight < 0) {
    throw new Error("Latest Aleo Testnet block height is invalid");
  }
  if (latestBlockHeight > bounty.disclosureDeadline) {
    throw new Error("Bounty disclosure deadline has passed");
  }
}

function defaultDigest(algorithm: AlgorithmIdentifier, data: BufferSource) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable");
  }
  return globalThis.crypto.subtle.digest(algorithm, data);
}

export async function deriveReporterSecretField(
  reporterSecret: string,
  digest: PrivateDigest = defaultDigest,
) {
  if (!reporterSecret.trim()) throw new Error("Reporter secret is required");
  const payload = new TextEncoder().encode(`reporter-secret:${reporterSecret}`);
  let bytes: Uint8Array | undefined;
  try {
    bytes = new Uint8Array(await digest("SHA-256", payload));
    let value = 0n;
    for (const byte of bytes.slice(0, 31)) {
      value = (value << 8n) | BigInt(byte);
    }
    return `${value}field`;
  } finally {
    payload.fill(0);
    bytes?.fill(0);
  }
}

// The returned array contains private inputs. Keep it on the wallet call stack and zero it afterward.
export function buildTransientSubmitClaimInputs(request: TransientSubmitClaimRequest) {
  const { bounty, witness, latestBlockHeight, feeMicrocredits } = request;
  assertCanonicalBounty(bounty, latestBlockHeight);
  if (!Number.isSafeInteger(feeMicrocredits) || feeMicrocredits <= 0) {
    throw new Error("submit_claim fee must be positive microcredits");
  }
  if (!FIELD_LITERAL_PATTERN.test(witness.reporterSecretField)) {
    throw new Error("Reporter secret field is invalid");
  }

  const inputs = [
    bounty.bountyId,
    bounty.scopeHash,
    getRuleFieldLiteral(bounty.ruleId),
    asU64Literal(witness.vaultBalanceBefore, "vault balance"),
    asU64Literal(witness.totalDepositsBefore, "total deposits"),
    asU64Literal(witness.totalClaimsBefore, "total claims"),
    asU64Literal(witness.reservedRewardsBefore, "reserved rewards"),
    asU64Literal(witness.withdrawLimitBefore, "withdraw limit"),
    asU64Literal(witness.userBalanceBefore, "user balance"),
    asU64Literal(witness.requestedWithdrawBefore, "requested withdraw"),
    asU64Literal(witness.hiddenDeltaBalance, "balance delta"),
    asU64Literal(witness.hiddenDeltaClaims, "claims delta"),
    asU64Literal(witness.hiddenDeltaReservedRewards, "reserved rewards delta"),
    asU64Literal(witness.hiddenDeltaWithdrawAmount, "withdraw amount delta"),
    asU64Literal(witness.hiddenDeltaUserBalance, "user balance delta"),
    witness.reporterSecretField,
  ];
  if (inputs.length !== SUBMIT_CLAIM_ABI_INPUTS.length) {
    throw new Error("submit_claim ABI input count mismatch");
  }
  return inputs;
}

function assertU64Literal(value: string, label: string) {
  const match = value.trim().match(/^([0-9]+)u64$/);
  if (!match) throw new Error(`${label} must be a u64 literal`);
  const parsed = BigInt(match[1]);
  if (parsed > MAX_U64) throw new Error(`${label} exceeds u64`);
}

export function assertSubmitClaimRawInputs(inputs: readonly string[]) {
  if (inputs.length !== SUBMIT_CLAIM_ABI_INPUTS.length) {
    throw new Error("submit_claim ABI input count mismatch");
  }
  for (const [index, input] of SUBMIT_CLAIM_ABI_INPUTS.entries()) {
    const value = inputs[index]?.trim();
    if (!value) throw new Error(`submit_claim input ${index + 1} is empty`);
    if (input.type === "field" && !FIELD_LITERAL_PATTERN.test(value)) {
      throw new Error(`${input.name} must be an Aleo field literal`);
    }
    if (input.type === "u64") {
      assertU64Literal(value, input.name);
    }
  }
}

export function createControlledSubmitClaimPreview(
  inputs: readonly string[],
  publicReceipt: Omit<ControlledSubmitClaimInputPreview, "bountyId" | "scopeHash" | "rule" | "feeMicrocredits">,
  feeMicrocredits: number,
): ControlledSubmitClaimInputPreview {
  assertSubmitClaimRawInputs(inputs);
  if (!Number.isSafeInteger(feeMicrocredits) || feeMicrocredits <= 0) {
    throw new Error("submit_claim fee must be positive microcredits");
  }
  for (const [label, value] of Object.entries(publicReceipt)) {
    if (label === "severity") {
      if (!/^[123]u8$/.test(value)) throw new Error("severity must be a verified severity literal");
    } else if (!FIELD_LITERAL_PATTERN.test(value)) {
      throw new Error(`${label} must be an Aleo field literal`);
    }
  }
  return {
    bountyId: inputs[0],
    scopeHash: inputs[1],
    rule: inputs[2],
    feeMicrocredits,
    ...publicReceipt,
  };
}

export const SUBMIT_CLAIM_WALLET_BOUNDARY = {
  network: "testnet" as const,
  walletChainId: ALEO_WALLET_TESTNET_CHAIN_ID,
  programId: CANONICAL_ALEO_PROGRAM_ID,
  functionName: SUBMIT_CLAIM_FUNCTION,
};
