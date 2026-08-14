import { CANONICAL_ALEO_PROGRAM_ID } from "./aleo-program.ts";
import type { DemoVaultRuleId } from "./models.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";

// Legacy preview identifier retained for deployed public API compatibility; Shield receives Network.TESTNET.
export const ALEO_WALLET_TESTNET_CHAIN_ID = "testnetbeta";
export const CREATE_BOUNTY_FUNCTION = "create_bounty";
export const DEFAULT_CREATE_BOUNTY_FEE_MICROCREDITS = 1_000_000;

const MAX_U64 = (1n << 64n) - 1n;
const MAX_U32 = (1n << 32n) - 1n;
const MAX_APP_FIELD = (1n << 128n) - 1n;

export const CREATE_BOUNTY_ABI_INPUTS = [
  { name: "bounty_id", type: "field" },
  { name: "scope_hash", type: "field" },
  { name: "rule_id", type: "field" },
  { name: "critical_reward", type: "u64" },
  { name: "high_reward", type: "u64" },
  { name: "medium_reward", type: "u64" },
  { name: "low_reward", type: "u64" },
  { name: "disclosure_deadline", type: "u32" },
] as const;

const ruleFieldById: Record<DemoVaultRuleId, `${number}field`> = {
  "vault-accounting-safety": "1field",
  "claims-vs-deposits": "2field",
  "reward-reserve-safety": "3field",
  "withdraw-limit-safety": "4field",
};

export type CreateBountyDraft = {
  bountyId: string;
  scopeHash: string;
  ruleId: DemoVaultRuleId;
  criticalReward: string;
  highReward: string;
  mediumReward: string;
  lowReward: string;
  disclosureDeadline: number;
  feeMicrocredits: number;
};

export type CreateBountyPublicInputs = {
  bountyId: string;
  scopeHash: string;
  ruleId: DemoVaultRuleId;
  ruleField: string;
  criticalReward: string;
  highReward: string;
  mediumReward: string;
  lowReward: string;
  disclosureDeadline: number;
};

export type CreateBountyTransactionPreview = {
  source: "AleoTestnet";
  network: "testnet";
  walletChainId: typeof ALEO_WALLET_TESTNET_CHAIN_ID;
  programId: typeof CANONICAL_ALEO_PROGRAM_ID;
  functionName: typeof CREATE_BOUNTY_FUNCTION;
  ownerSource: "std::ctx::signer()";
  feeMode: "Public";
  feeMicrocredits: number;
  fundingStatus: "NotEscrowed";
  inputs: readonly [string, string, string, string, string, string, string, string];
  publicInputs: CreateBountyPublicInputs;
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`create_bounty ABI ${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function parseUnsigned(value: string, label: string, max: bigint) {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${label} must be an unsigned integer`);
  }
  const parsed = BigInt(value);
  if (parsed > max) {
    throw new Error(`${label} exceeds the Aleo integer range`);
  }
  return parsed;
}

export function isAppAleoFieldLiteral(value: string) {
  if (!/^[0-9]+field$/.test(value)) return false;
  const numeric = BigInt(value.slice(0, -5));
  return numeric <= MAX_APP_FIELD;
}

export function getRuleFieldLiteral(ruleId: DemoVaultRuleId) {
  return ruleFieldById[ruleId];
}

export function buildCreateBountyTransaction(
  draft: CreateBountyDraft,
  currentBlockHeight: number,
): CreateBountyTransactionPreview {
  if (!isAppAleoFieldLiteral(draft.bountyId)) {
    throw new Error("Bounty ID must be a conservative Aleo field literal");
  }
  if (!isAppAleoFieldLiteral(draft.scopeHash)) {
    throw new Error("Scope Hash must be a conservative Aleo field literal");
  }
  if (!Number.isSafeInteger(currentBlockHeight) || currentBlockHeight < 0) {
    throw new Error("Current Testnet block height is invalid");
  }
  if (!Number.isSafeInteger(draft.disclosureDeadline)) {
    throw new Error("Disclosure deadline must be an integer block height");
  }
  const deadline = BigInt(draft.disclosureDeadline);
  if (deadline > MAX_U32 || draft.disclosureDeadline <= currentBlockHeight) {
    throw new Error("Disclosure deadline must be a future u32 block height");
  }
  if (!Number.isSafeInteger(draft.feeMicrocredits) || draft.feeMicrocredits <= 0) {
    throw new Error("Transaction fee must be a positive integer in microcredits");
  }

  const critical = parseUnsigned(draft.criticalReward, "Critical reward", MAX_U64);
  const high = parseUnsigned(draft.highReward, "High reward", MAX_U64);
  const medium = parseUnsigned(draft.mediumReward, "Medium reward", MAX_U64);
  const low = parseUnsigned(draft.lowReward, "Low reward", MAX_U64);
  if (
    critical === 0n ||
    medium === 0n ||
    low !== 0n ||
    critical < high ||
    high < medium
  ) {
    throw new Error(
      "Rewards must satisfy Critical >= High >= Medium > 0; Low must be 0 because Low proofs are not claimable",
    );
  }

  const ruleField = getRuleFieldLiteral(draft.ruleId);
  const publicInputs: CreateBountyPublicInputs = {
    bountyId: draft.bountyId,
    scopeHash: draft.scopeHash,
    ruleId: draft.ruleId,
    ruleField,
    criticalReward: critical.toString(),
    highReward: high.toString(),
    mediumReward: medium.toString(),
    lowReward: low.toString(),
    disclosureDeadline: draft.disclosureDeadline,
  };
  const preview: CreateBountyTransactionPreview = {
    source: "AleoTestnet",
    network: "testnet",
    walletChainId: ALEO_WALLET_TESTNET_CHAIN_ID,
    programId: CANONICAL_ALEO_PROGRAM_ID,
    functionName: CREATE_BOUNTY_FUNCTION,
    ownerSource: "std::ctx::signer()",
    feeMode: "Public",
    feeMicrocredits: draft.feeMicrocredits,
    fundingStatus: "NotEscrowed",
    inputs: [
      publicInputs.bountyId,
      publicInputs.scopeHash,
      publicInputs.ruleField,
      `${publicInputs.criticalReward}u64`,
      `${publicInputs.highReward}u64`,
      `${publicInputs.mediumReward}u64`,
      `${publicInputs.lowReward}u64`,
      `${publicInputs.disclosureDeadline}u32`,
    ],
    publicInputs,
  };
  assertNoPrivateFields(preview);
  return preview;
}

function readAbiPrimitive(input: Record<string, unknown>) {
  const type = asRecord(input.ty, "input type");
  const plaintext = asRecord(type.Plaintext, "plaintext input type");
  const primitive = plaintext.Primitive;
  if (primitive === "Field") return "field";
  const unsigned = asRecord(primitive, "unsigned input type");
  if (unsigned.UInt === "U64") return "u64";
  if (unsigned.UInt === "U32") return "u32";
  throw new Error("create_bounty ABI contains an unsupported input type");
}

export function assertCreateBountyAbi(abi: unknown) {
  const root = asRecord(abi, "root");
  if (root.program !== CANONICAL_ALEO_PROGRAM_ID || !Array.isArray(root.functions)) {
    throw new Error("create_bounty ABI Program ID is invalid");
  }
  const matches = root.functions.filter(
    (entry) => asRecord(entry, "function").name === CREATE_BOUNTY_FUNCTION,
  );
  if (matches.length !== 1) {
    throw new Error("create_bounty ABI must contain exactly one canonical function");
  }
  const fn = asRecord(matches[0], "function");
  if (fn.is_final !== true || !Array.isArray(fn.inputs) || !Array.isArray(fn.outputs)) {
    throw new Error("create_bounty ABI Final boundary is invalid");
  }
  if (fn.inputs.length !== CREATE_BOUNTY_ABI_INPUTS.length) {
    throw new Error("create_bounty ABI input count mismatch");
  }
  fn.inputs.forEach((entry, index) => {
    const input = asRecord(entry, `input ${index}`);
    const expected = CREATE_BOUNTY_ABI_INPUTS[index];
    if (input.name !== expected.name || input.mode !== "Public" || readAbiPrimitive(input) !== expected.type) {
      throw new Error(`create_bounty ABI input ${index} mismatch`);
    }
  });
  if (fn.outputs.length !== 1) {
    throw new Error("create_bounty ABI output count mismatch");
  }
  const output = asRecord(fn.outputs[0], "output");
  if (output.ty !== "Final" || output.mode !== "None") {
    throw new Error("create_bounty ABI output must be Final");
  }
  return true;
}

function bytesToFieldLiteral(bytes: Uint8Array) {
  let value = 0n;
  for (const byte of bytes.slice(0, 16)) {
    value = (value << 8n) | BigInt(byte);
  }
  return `${value}field`;
}

export function generateBountyFieldId(randomValues: (array: Uint8Array) => Uint8Array) {
  return bytesToFieldLiteral(randomValues(new Uint8Array(16)));
}

export async function createScopeFieldHash(
  scope: string,
  ruleId: DemoVaultRuleId,
  digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => Promise<ArrayBuffer>,
) {
  const canonicalScope = scope.trim().replace(/\s+/g, " ");
  if (!canonicalScope) throw new Error("Public scope is required");
  const bytes = new TextEncoder().encode(`zkbugbounty:scope:v1:${ruleId}:${canonicalScope}`);
  return bytesToFieldLiteral(new Uint8Array(await digest("SHA-256", bytes)));
}
