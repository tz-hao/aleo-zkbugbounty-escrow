import {
  ALEO_TESTNET_DEPLOYMENT,
  CANONICAL_ALEO_PROGRAM_ID,
} from "./aleo-program.ts";
import { isAleoFieldLiteral } from "./aleo-bounty-registry.ts";
import type { OnChainBountyState, OnChainClaimReceipt } from "./models.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";

export const REWARD_ESCROW_FUNCTIONS = [
  "fund_bounty",
  "lock_reward",
  "release_reward",
  "refund_bounty",
] as const;

export const RESPONSIBLE_DISCLOSURE_FUNCTIONS = [
  "request_disclosure",
  "attest_encrypted_details",
  "mark_patched",
  "reject_claim",
] as const;

export const REWARD_ESCROW_MAPPINGS = [
  "bounty_escrows",
  "claim_payouts",
  "bounty_claim_counts",
  "claim_reporters",
  "claim_triage_states",
  "bounty_protocol_versions",
  "escrow_operation_markers",
] as const;

export const REWARD_ESCROW_UPGRADE_PLAN = {
  newFunctions: [...REWARD_ESCROW_FUNCTIONS, ...RESPONSIBLE_DISCLOSURE_FUNCTIONS],
  newMappings: [...REWARD_ESCROW_MAPPINGS],
  preservedEntryFunctions: [
    "prove_vault_invariant_break",
    "submit_claim",
    "create_bounty",
    "pause_bounty",
    "close_bounty",
  ],
  securityChecks: [
    "fund_bounty transfers real public credits from self.signer to the program account",
    "fund_bounty accepts only protocol-v2 bounties before their disclosure deadline",
    "all economic operation markers are unique and replay protected",
    "lock_reward derives the exact reward from the verified receipt severity and advertised reward tier",
    "responsible disclosure advances strictly through requested, shared, and patched states",
    "release_reward requires a patched claim and transfers public credits to the recorded reporter",
    "reject_claim requires the protocol arbiter and cannot be authorized unilaterally by the Bounty owner",
    "reject_claim unlocks a locked reward and resolves the claim before refund accounting",
    "refund_bounty requires a closed expired bounty, zero unresolved claims, and zero locked amount",
    "Paid state is represented only by confirmed mapping state, never by UI-only local state",
  ],
} as const;

export type RewardEscrowCapabilityStatus =
  | "Available"
  | "ProgramUpgradeRequired"
  | "EndpointUnavailable"
  | "ConfigurationError";

export type RewardEscrowCapability = {
  status: RewardEscrowCapabilityStatus;
  source: "AleoTestnet";
  network: "testnet";
  programId: typeof CANONICAL_ALEO_PROGRAM_ID;
  localUpgradeReady: true;
  transactionBuilderReady: true;
  transactionBuilderEnabled: boolean;
  walletRequestEnabled: boolean;
  demoFallbackAllowed: false;
  paidRequiresConfirmedTransaction: true;
  paidRequiresMappingVerification: true;
  currentEdition: number | null;
  requiredEdition: 1;
  presentFunctions: string[];
  missingFunctions: string[];
  presentMappings: string[];
  missingMappings: string[];
};

export const REWARD_ESCROW_CAPABILITY: RewardEscrowCapability = {
  status: "ProgramUpgradeRequired",
  source: "AleoTestnet",
  network: "testnet",
  programId: CANONICAL_ALEO_PROGRAM_ID,
  localUpgradeReady: true,
  transactionBuilderReady: true,
  transactionBuilderEnabled: false,
  walletRequestEnabled: false,
  demoFallbackAllowed: false,
  paidRequiresConfirmedTransaction: true,
  paidRequiresMappingVerification: true,
  currentEdition: 0,
  requiredEdition: 1,
  presentFunctions: [],
  missingFunctions: [...REWARD_ESCROW_FUNCTIONS, ...RESPONSIBLE_DISCLOSURE_FUNCTIONS],
  presentMappings: [],
  missingMappings: [...REWARD_ESCROW_MAPPINGS],
};

export type RewardEscrowAbiInspection = {
  available: boolean;
  presentFunctions: string[];
  missingFunctions: string[];
  presentMappings: string[];
  missingMappings: string[];
};

export type RewardEscrowFunctionName =
  | (typeof REWARD_ESCROW_FUNCTIONS)[number]
  | (typeof RESPONSIBLE_DISCLOSURE_FUNCTIONS)[number];

export type RewardEscrowTransactionPreview = {
  source: "AleoTestnet";
  network: "testnet";
  walletChainId: "testnetbeta";
  programId: typeof CANONICAL_ALEO_PROGRAM_ID;
  functionName: RewardEscrowFunctionName;
  feeMode: "Public";
  feeMicrocredits: number;
  inputs: readonly string[];
  publicSummary: {
    bountyId: string;
    claimHash?: string;
    amount?: string;
    operationMarker?: string;
    recipient?: string;
    packageHash?: string;
  };
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function inspectRewardEscrowAbi(abi: unknown): RewardEscrowAbiInspection {
  const root = recordOf(abi);
  const functionNames = new Set(
    (Array.isArray(root?.functions) ? root.functions : [])
      .map((entry) => recordOf(entry)?.name)
      .filter((name): name is string => typeof name === "string"),
  );
  const mappingNames = new Set(
    (Array.isArray(root?.mappings) ? root.mappings : [])
      .map((entry) => recordOf(entry)?.name)
      .filter((name): name is string => typeof name === "string"),
  );
  const requiredFunctions = [...REWARD_ESCROW_FUNCTIONS, ...RESPONSIBLE_DISCLOSURE_FUNCTIONS];
  const presentFunctions = requiredFunctions.filter((name) => functionNames.has(name));
  const presentMappings = REWARD_ESCROW_MAPPINGS.filter((name) => mappingNames.has(name));
  const missingFunctions = requiredFunctions.filter((name) => !functionNames.has(name));
  const missingMappings = REWARD_ESCROW_MAPPINGS.filter((name) => !mappingNames.has(name));

  return {
    available: missingFunctions.length === 0 && missingMappings.length === 0,
    presentFunctions: [...presentFunctions],
    missingFunctions: [...missingFunctions],
    presentMappings: [...presentMappings],
    missingMappings: [...missingMappings],
  };
}

const SOURCE_FUNCTION_INPUTS: Record<RewardEscrowFunctionName, readonly string[]> = {
  fund_bounty: ["field", "u64", "field"],
  lock_reward: ["field", "field", "address", "u64", "field"],
  request_disclosure: ["field", "field", "field"],
  attest_encrypted_details: ["field", "field", "field", "field"],
  mark_patched: ["field", "field", "field"],
  release_reward: ["field", "field", "address", "u64", "field"],
  reject_claim: ["field", "field", "field"],
  refund_bounty: ["field", "u64", "field"],
};

const SOURCE_MAPPING_VALUES: Record<(typeof REWARD_ESCROW_MAPPINGS)[number], string> = {
  bounty_escrows: "BountyEscrowState",
  claim_payouts: "ClaimPayoutState",
  bounty_claim_counts: "u64",
  claim_reporters: "address",
  claim_triage_states: "ClaimTriageState",
  bounty_protocol_versions: "u8",
  escrow_operation_markers: "boolean",
};

function sourceEntryMatches(source: string, name: RewardEscrowFunctionName) {
  const compiledMatch = source.match(
    new RegExp(`(?:^|\\n)function\\s+${name}:([\\s\\S]*?)(?=\\nfinalize\\s+${name}:)`),
  );
  const expectedInputs = SOURCE_FUNCTION_INPUTS[name];
  if (compiledMatch) {
    const inputLines = compiledMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("input "));
    const actualInputs = inputLines.map((line) =>
      line.match(/^input r\d+ as ([A-Za-z0-9_./]+)\.public;$/)?.[1] ?? "invalid"
    );
    return actualInputs.length === expectedInputs.length &&
      actualInputs.every((type, index) => type === expectedInputs[index]);
  }

  const leoMatch = source.match(
    new RegExp(`\\bfn\\s+${name}\\s*\\(([\\s\\S]*?)\\)\\s*->\\s*Final\\s*\\{`),
  );
  if (!leoMatch) return false;
  const actualInputs = leoMatch[1]
    .split(",")
    .map((input) => input.trim())
    .filter(Boolean)
    .map((input) =>
      input.match(/^public\s+[a-z_][a-z0-9_]*:\s*([A-Za-z0-9_./]+)$/)?.[1] ??
      "invalid"
    );
  return actualInputs.length === expectedInputs.length &&
    actualInputs.every((type, index) => type === expectedInputs[index]);
}
function sourceMappingMatches(
  source: string,
  name: (typeof REWARD_ESCROW_MAPPINGS)[number],
) {
  const valueType = SOURCE_MAPPING_VALUES[name];
  const leoValueType = valueType === "boolean" ? "bool" : valueType;
  const compiledMapping = new RegExp(
    `(?:^|\\n)mapping\\s+${name}:\\s*\\n` +
      `\\s*key as field\\.public;\\s*\\n` +
      `\\s*value as ${valueType}\\.public;`,
  ).test(source);
  const leoMapping = new RegExp(
    `\\bmapping\\s+${name}:\\s*field\\s*=>\\s*${leoValueType}\\s*;`,
  ).test(source);
  return compiledMapping || leoMapping;
}
export function inspectRewardEscrowSource(source: string): RewardEscrowAbiInspection {
  const escapedProgramId = CANONICAL_ALEO_PROGRAM_ID.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  if (!new RegExp(`\\bprogram\\s+${escapedProgramId}(?:;|\\s*\\{)`).test(source)) {
    throw new Error("Reward escrow Program ID mismatch");
  }
  const requiredFunctions = [...REWARD_ESCROW_FUNCTIONS, ...RESPONSIBLE_DISCLOSURE_FUNCTIONS];
  const presentFunctions = requiredFunctions.filter((name) => sourceEntryMatches(source, name));
  const presentMappings = REWARD_ESCROW_MAPPINGS.filter((name) =>
    sourceMappingMatches(source, name)
  );
  const missingFunctions = requiredFunctions.filter((name) => !presentFunctions.includes(name));
  const missingMappings = REWARD_ESCROW_MAPPINGS.filter((name) => !presentMappings.includes(name));
  return {
    available: missingFunctions.length === 0 && missingMappings.length === 0,
    presentFunctions,
    missingFunctions,
    presentMappings,
    missingMappings,
  };
}

async function readProgramSource(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "string" ? parsed : text;
  } catch {
    return text;
  }
}

export async function fetchRewardEscrowCapability(
  fetcher: typeof fetch = fetch,
): Promise<RewardEscrowCapability> {
  try {
    const requestInit: RequestInit = {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    };
    const [programResponse, editionResponse] = await Promise.all([
      fetcher(ALEO_TESTNET_DEPLOYMENT.programApiUrl, requestInit),
      fetcher(ALEO_TESTNET_DEPLOYMENT.latestEditionApiUrl, {
        ...requestInit,
        signal: AbortSignal.timeout(8_000),
      }),
    ]);
    if (!programResponse.ok || !editionResponse.ok) {
      const status = !programResponse.ok ? programResponse.status : editionResponse.status;
      return {
        ...REWARD_ESCROW_CAPABILITY,
        status: status === 404 ? "ConfigurationError" : "EndpointUnavailable",
        currentEdition: null,
      };
    }
    const inspection = inspectRewardEscrowSource(await readProgramSource(programResponse));
    const currentEdition = Number(await editionResponse.text());
    if (!Number.isSafeInteger(currentEdition) || currentEdition < 0) {
      return {
        ...REWARD_ESCROW_CAPABILITY,
        status: "ConfigurationError",
        currentEdition: null,
      };
    }
    const editionReady = currentEdition >= REWARD_ESCROW_CAPABILITY.requiredEdition;
    const evidenceConsistent = editionReady === inspection.available;
    const available = editionReady && inspection.available;
    return {
      ...REWARD_ESCROW_CAPABILITY,
      status: available
        ? "Available"
        : evidenceConsistent
          ? "ProgramUpgradeRequired"
          : "ConfigurationError",
      transactionBuilderEnabled: available,
      walletRequestEnabled: available,
      currentEdition,
      presentFunctions: inspection.presentFunctions,
      missingFunctions: inspection.missingFunctions,
      presentMappings: inspection.presentMappings,
      missingMappings: inspection.missingMappings,
    };
  } catch (error) {
    const mismatch = error instanceof Error && error.message.includes("mismatch");
    return {
      ...REWARD_ESCROW_CAPABILITY,
      status: mismatch ? "ConfigurationError" : "EndpointUnavailable",
      currentEdition: null,
    };
  }
}
const MAX_U64 = (1n << 64n) - 1n;
const ALEO_ADDRESS_PATTERN = /^aleo1[0-9a-z]{58}$/;

function requireField(value: string, label: string, allowZero = false) {
  if (!isAleoFieldLiteral(value) || (!allowZero && value === "0field")) {
    throw new Error(`${label} must be a non-zero Aleo field literal`);
  }
  return value;
}

function requireAddress(value: string) {
  if (!ALEO_ADDRESS_PATTERN.test(value)) {
    throw new Error("Whitehat address must be a valid Aleo address");
  }
  return value;
}

function requireU64(value: string, label: string) {
  if (!/^[0-9]+$/.test(value)) throw new Error(`${label} must be an unsigned integer`);
  const parsed = BigInt(value);
  if (parsed === 0n || parsed > MAX_U64) {
    throw new Error(`${label} must be a positive u64 value`);
  }
  return parsed.toString();
}

function requireFee(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Transaction fee must be positive microcredits");
  }
  return value;
}

function buildPreview(
  functionName: RewardEscrowFunctionName,
  inputs: readonly string[],
  feeMicrocredits: number,
  publicSummary: RewardEscrowTransactionPreview["publicSummary"],
): RewardEscrowTransactionPreview {
  const preview: RewardEscrowTransactionPreview = {
    source: "AleoTestnet",
    network: "testnet",
    walletChainId: "testnetbeta",
    programId: CANONICAL_ALEO_PROGRAM_ID,
    functionName,
    feeMode: "Public",
    feeMicrocredits: requireFee(feeMicrocredits),
    inputs,
    publicSummary,
  };
  assertNoPrivateFields(preview);
  return preview;
}

export function rewardForSeverity(
  bounty: Pick<OnChainBountyState, "rewards">,
  severity: OnChainClaimReceipt["severity"],
) {
  const reward = severity === "Critical"
    ? bounty.rewards.critical
    : severity === "High"
      ? bounty.rewards.high
      : severity === "Medium"
        ? bounty.rewards.medium
        : null;
  if (reward === null) {
    throw new Error("Low severity Claims are not eligible for escrow payout");
  }
  return requireU64(reward, `${severity} reward`);
}

export function buildFundBountyTransaction(input: {
  bountyId: string;
  amount: string;
  fundingMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const amount = requireU64(input.amount, "Funding amount");
  const marker = requireField(input.fundingMarker, "Funding marker");
  return buildPreview(
    "fund_bounty",
    [bountyId, `${amount}u64`, marker],
    input.feeMicrocredits,
    { bountyId, amount, operationMarker: marker },
  );
}

function assertMatchingReceipt(
  bounty: OnChainBountyState,
  receipt: OnChainClaimReceipt,
) {
  if (receipt.bountyId !== bounty.bountyId || receipt.scopeHash !== bounty.scopeHash) {
    throw new Error("Claim Receipt does not belong to this Bounty");
  }
  if (receipt.ruleId !== bounty.ruleId || receipt.proofStatus !== "Verified") {
    throw new Error("Claim Receipt is not eligible for payout");
  }
  if (receipt.protocolVersion !== 2) {
    throw new Error("Only protocol-v2 Claim Receipts are eligible for escrow payout");
  }
}

export function buildLockRewardTransaction(input: {
  bounty: OnChainBountyState;
  receipt: OnChainClaimReceipt;
  whitehatAddress: string;
  lockMarker: string;
  feeMicrocredits: number;
}) {
  assertMatchingReceipt(input.bounty, input.receipt);
  const recipient = requireAddress(input.whitehatAddress);
  const amount = rewardForSeverity(input.bounty, input.receipt.severity);
  const marker = requireField(input.lockMarker, "Lock marker");
  return buildPreview(
    "lock_reward",
    [
      input.bounty.bountyId,
      input.receipt.claimHash,
      recipient,
      `${amount}u64`,
      marker,
    ],
    input.feeMicrocredits,
    {
      bountyId: input.bounty.bountyId,
      claimHash: input.receipt.claimHash,
      amount,
      operationMarker: marker,
      recipient,
    },
  );
}

export function buildRequestDisclosureTransaction(input: {
  bountyId: string;
  claimHash: string;
  requestMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim Hash");
  const marker = requireField(input.requestMarker, "Disclosure request marker");
  return buildPreview(
    "request_disclosure",
    [bountyId, claimHash, marker],
    input.feeMicrocredits,
    { bountyId, claimHash, operationMarker: marker },
  );
}

export function buildAttestEncryptedDetailsTransaction(input: {
  bountyId: string;
  claimHash: string;
  packageHash: string;
  shareMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim Hash");
  const packageHash = requireField(input.packageHash, "Disclosure package hash");
  const marker = requireField(input.shareMarker, "Disclosure share marker");
  return buildPreview(
    "attest_encrypted_details",
    [bountyId, claimHash, packageHash, marker],
    input.feeMicrocredits,
    { bountyId, claimHash, packageHash, operationMarker: marker },
  );
}

export function buildMarkPatchedTransaction(input: {
  bountyId: string;
  claimHash: string;
  patchedMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim Hash");
  const marker = requireField(input.patchedMarker, "Patched marker");
  return buildPreview(
    "mark_patched",
    [bountyId, claimHash, marker],
    input.feeMicrocredits,
    { bountyId, claimHash, operationMarker: marker },
  );
}

export function buildReleaseRewardTransaction(input: {
  bounty: OnChainBountyState;
  receipt: OnChainClaimReceipt;
  whitehatAddress: string;
  releaseMarker: string;
  feeMicrocredits: number;
}) {
  assertMatchingReceipt(input.bounty, input.receipt);
  const recipient = requireAddress(input.whitehatAddress);
  const marker = requireField(input.releaseMarker, "Release marker");
  const amount = rewardForSeverity(input.bounty, input.receipt.severity);
  return buildPreview(
    "release_reward",
    [
      input.bounty.bountyId,
      input.receipt.claimHash,
      recipient,
      `${amount}u64`,
      marker,
    ],
    input.feeMicrocredits,
    {
      bountyId: input.bounty.bountyId,
      claimHash: input.receipt.claimHash,
      amount,
      operationMarker: marker,
      recipient,
    },
  );
}

export function buildRejectClaimTransaction(input: {
  bountyId: string;
  claimHash: string;
  rejectionMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim Hash");
  const marker = requireField(input.rejectionMarker, "Rejection marker");
  return buildPreview(
    "reject_claim",
    [bountyId, claimHash, marker],
    input.feeMicrocredits,
    { bountyId, claimHash, operationMarker: marker },
  );
}

export function buildRefundBountyTransaction(input: {
  bountyId: string;
  amount: string;
  refundMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const amount = requireU64(input.amount, "Refund amount");
  const marker = requireField(input.refundMarker, "Refund marker");
  return buildPreview(
    "refund_bounty",
    [bountyId, `${amount}u64`, marker],
    input.feeMicrocredits,
    { bountyId, amount, operationMarker: marker },
  );
}
