import { ALEO_WALLET_TESTNET_CHAIN_ID, getRuleFieldLiteral } from "./aleo-create-bounty.ts";
import {
  ALEO_TESTNET_DEPLOYMENT,
  ALEO_TESTNET_PROGRAM_OWNER,
  ALEO_TESTNET_V3_EXPECTED_EDITION,
  ALEO_TESTNET_V3_UPGRADE_EVIDENCE,
  CANONICAL_ALEO_PROGRAM_ID,
} from "./aleo-program.ts";
import {
  buildTransientSubmitClaimInputs,
  type TransientSubmitClaimRequest,
} from "./aleo-submit-claim.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";
import { verifyTestnetEditionOne } from "./testnet-edition-one.ts";

export const PROTOCOL_V3_FUNCTIONS = [
  "create_bounty_v3",
  "submit_claim_v3",
  "fund_bounty_v3",
  "review_claim_v3",
  "lock_reward_v3",
  "disclosure_action_v3",
  "resolution_action_v3",
  "dispute_claim_v3",
  "cast_arbitration_vote_v3",
  "settle_reward_v3",
  "finalize_arbitration_prelock_v3",
  "finalize_rejection_v3",
  "refund_bounty_v3",
] as const;

export const PROTOCOL_V3_PUBLIC_TRANSACTION_FUNCTIONS = PROTOCOL_V3_FUNCTIONS.filter(
  (name) => name !== "submit_claim_v3",
) as Exclude<(typeof PROTOCOL_V3_FUNCTIONS)[number], "submit_claim_v3">[];

export const PROTOCOL_V3_MAPPINGS = [
  "bounty_v3_configs",
  "claim_v3_evidence",
  "claim_v3_states",
  "claim_v3_payouts",
  "claim_v3_arbitration_tallies",
  "claim_v3_arbitration_votes",
  "v3_operation_markers",
  "claim_v3_acknowledgements",
  "claim_v3_dispute_bonds",
  "claim_v3_project_decisions",
  "claim_v3_dispute_metadata",
  "claim_v3_dispute_rounds",
  "claim_v3_active_disputes",
] as const;

export type ProtocolV3FunctionName = (typeof PROTOCOL_V3_FUNCTIONS)[number];
export type ProtocolV3PublicFunctionName =
  Exclude<ProtocolV3FunctionName, "submit_claim_v3">;
export type ProtocolV3MappingName = (typeof PROTOCOL_V3_MAPPINGS)[number];

export type ProtocolV3CapabilityStatus =
  | "Available"
  | "ProgramUpgradeRequired"
  | "DeploymentEvidencePending"
  | "EndpointUnavailable"
  | "ConfigurationError";

export type ProtocolV3Capability = {
  status: ProtocolV3CapabilityStatus;
  source: "AleoTestnet";
  network: "testnet";
  programId: typeof CANONICAL_ALEO_PROGRAM_ID;
  requiredEdition: typeof ALEO_TESTNET_V3_EXPECTED_EDITION;
  currentEdition: number | null;
  localBuildReady: true;
  transactionBuilderReady: true;
  transactionBuilderEnabled: boolean;
  walletRequestEnabled: boolean;
  upgradeEvidenceRecorded: boolean;
  upgradeEvidenceVerified: boolean;
  programHashVerified: boolean;
  demoFallbackAllowed: false;
  presentFunctions: string[];
  missingFunctions: string[];
  presentMappings: string[];
  missingMappings: string[];
};

export const PROTOCOL_V3_CAPABILITY: ProtocolV3Capability = {
  status: "ProgramUpgradeRequired",
  source: "AleoTestnet",
  network: "testnet",
  programId: CANONICAL_ALEO_PROGRAM_ID,
  requiredEdition: ALEO_TESTNET_V3_EXPECTED_EDITION,
  currentEdition: 1,
  localBuildReady: true,
  transactionBuilderReady: true,
  transactionBuilderEnabled: false,
  walletRequestEnabled: false,
  upgradeEvidenceRecorded: false,
  upgradeEvidenceVerified: false,
  programHashVerified: false,
  demoFallbackAllowed: false,
  presentFunctions: [],
  missingFunctions: [...PROTOCOL_V3_FUNCTIONS],
  presentMappings: [],
  missingMappings: [...PROTOCOL_V3_MAPPINGS],
};

export type ProtocolV3SourceInspection = {
  available: boolean;
  presentFunctions: string[];
  missingFunctions: string[];
  presentMappings: string[];
  missingMappings: string[];
};

const SOURCE_FUNCTION_INPUTS: Record<ProtocolV3FunctionName, readonly string[]> = {
  create_bounty_v3: [
    "field", "field", "field", "u64", "u64", "u64", "u64", "u32",
    "BountyV3PolicyInput",
  ],
  submit_claim_v3: [
    "field", "field", "field", "ClaimV3BindingInput", "VaultWitnessInput",
  ],
  fund_bounty_v3: ["field", "u64", "field"],
  review_claim_v3: ["field", "field", "u8", "u8", "field", "field"],
  lock_reward_v3: ["field", "field", "u64", "field"],
  disclosure_action_v3: ["field", "field", "u8", "field", "field"],
  resolution_action_v3: ["field", "field", "u8", "field", "field"],
  dispute_claim_v3: ["field", "field", "u8", "u8", "field", "u64", "field"],
  cast_arbitration_vote_v3: ["field", "field", "u8", "field"],
  settle_reward_v3: ["field", "field", "address", "u64", "u64", "u8", "field"],
  finalize_arbitration_prelock_v3: [
    "field", "field", "address", "u64", "u64", "u8", "field",
  ],
  finalize_rejection_v3: ["field", "field", "address", "u64", "u8", "field"],
  refund_bounty_v3: ["field", "u64", "field"],
};

export const PROTOCOL_V3_PUBLIC_INPUT_COUNTS: Readonly<
  Record<ProtocolV3PublicFunctionName, number>
> = Object.fromEntries(
  PROTOCOL_V3_PUBLIC_TRANSACTION_FUNCTIONS.map((functionName) => [
    functionName,
    SOURCE_FUNCTION_INPUTS[functionName].length,
  ]),
) as Record<ProtocolV3PublicFunctionName, number>;

const SOURCE_MAPPING_VALUES: Record<ProtocolV3MappingName, string> = {
  bounty_v3_configs: "BountyV3Config",
  claim_v3_evidence: "ClaimV3Evidence",
  claim_v3_states: "ClaimV3State",
  claim_v3_payouts: "ClaimV3PayoutState",
  claim_v3_arbitration_tallies: "ClaimV3ArbitrationTally",
  claim_v3_arbitration_votes: "ClaimV3ArbitrationVote",
  v3_operation_markers: "boolean",
  claim_v3_acknowledgements: "field",
  claim_v3_dispute_bonds: "ClaimV3DisputeBond",
  claim_v3_project_decisions: "ClaimV3ProjectDecision",
  claim_v3_dispute_metadata: "ClaimV3DisputeMetadata",
  claim_v3_dispute_rounds: "u32",
  claim_v3_active_disputes: "field",
};

function sourceFunctionMatches(source: string, name: ProtocolV3FunctionName) {
  const compiled = source.match(
    new RegExp(`(?:^|\\n)function\\s+${name}:([\\s\\S]*?)(?=\\n(?:finalize\\s+${name}:|function\\s+))`),
  );
  const expected = SOURCE_FUNCTION_INPUTS[name];
  if (compiled) {
    const inputs = compiled[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("input "))
      .map((line) =>
        line.match(/^input r\d+ as ([A-Za-z0-9_./]+)\.(?:public|private);$/)?.[1] ??
        "invalid"
      );
    return inputs.length === expected.length &&
      inputs.every((type, index) => type === expected[index]);
  }

  const leo = source.match(
    new RegExp(
      `\\bfn\\s+${name}\\s*\\(([\\s\\S]*?)\\)\\s*->\\s*(?:Final|\\([^)]*\\bFinal\\b[^)]*\\))\\s*\\{`,
    ),
  );
  if (!leo) return false;
  const inputs = leo[1]
    .split(",")
    .map((input) => input.trim())
    .filter(Boolean)
    .map((input) =>
      input.match(/^(?:(?:public|private)\s+)?[a-z_][a-z0-9_]*:\s*([A-Za-z0-9_./]+)$/)?.[1] ??
      "invalid"
    );
  return inputs.length === expected.length &&
    inputs.every((type, index) => type === expected[index]);
}

function sourceMappingMatches(source: string, name: ProtocolV3MappingName) {
  const valueType = SOURCE_MAPPING_VALUES[name];
  const leoType = valueType === "boolean" ? "bool" : valueType;
  return new RegExp(
    `(?:^|\\n)mapping\\s+${name}:\\s*\\n\\s*key as field\\.public;\\s*\\n\\s*value as ${valueType}\\.public;`,
  ).test(source) ||
    new RegExp(`\\bmapping\\s+${name}:\\s*field\\s*=>\\s*${leoType}\\s*;`).test(source);
}

export function inspectProtocolV3Source(source: string): ProtocolV3SourceInspection {
  const escapedProgramId = CANONICAL_ALEO_PROGRAM_ID.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  if (!new RegExp(`\\bprogram\\s+${escapedProgramId}(?:;|\\s*\\{)`).test(source)) {
    throw new Error("Protocol V3 Program ID mismatch");
  }
  const presentFunctions = PROTOCOL_V3_FUNCTIONS.filter((name) =>
    sourceFunctionMatches(source, name)
  );
  const presentMappings = PROTOCOL_V3_MAPPINGS.filter((name) =>
    sourceMappingMatches(source, name)
  );
  const missingFunctions = PROTOCOL_V3_FUNCTIONS.filter(
    (name) => !presentFunctions.includes(name),
  );
  const missingMappings = PROTOCOL_V3_MAPPINGS.filter(
    (name) => !presentMappings.includes(name),
  );
  return {
    available: missingFunctions.length === 0 && missingMappings.length === 0,
    presentFunctions: [...presentFunctions],
    missingFunctions: [...missingFunctions],
    presentMappings: [...presentMappings],
    missingMappings: [...missingMappings],
  };
}

async function readProgramSource(response: Response) {
  const text = await response.text();
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "string" ? parsed : text;
  } catch {
    return text;
  }
}

async function sha256Hex(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function disabledCapability(
  status: ProtocolV3CapabilityStatus,
  currentEdition: number | null,
  inspection?: ProtocolV3SourceInspection,
): ProtocolV3Capability {
  return {
    ...PROTOCOL_V3_CAPABILITY,
    status,
    currentEdition,
    upgradeEvidenceRecorded:
      Boolean(ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId) &&
      Boolean(ALEO_TESTNET_V3_UPGRADE_EVIDENCE.feeTransactionId) &&
      Boolean(ALEO_TESTNET_V3_UPGRADE_EVIDENCE.compiledProgramSha256) &&
      Boolean(ALEO_TESTNET_V3_UPGRADE_EVIDENCE.onChainProgramSourceSha256),
    presentFunctions: inspection?.presentFunctions ?? [],
    missingFunctions: inspection?.missingFunctions ?? [...PROTOCOL_V3_FUNCTIONS],
    presentMappings: inspection?.presentMappings ?? [],
    missingMappings: inspection?.missingMappings ?? [...PROTOCOL_V3_MAPPINGS],
  };
}

export async function fetchProtocolV3Capability(
  fetcher: typeof fetch = fetch,
): Promise<ProtocolV3Capability> {
  const requestInit: RequestInit = {
    method: "GET",
    headers: { accept: "application/json", "cache-control": "no-cache" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  };
  try {
    const [programResponse, editionResponse] = await Promise.all([
      fetcher(ALEO_TESTNET_DEPLOYMENT.programApiUrl, requestInit),
      fetcher(ALEO_TESTNET_DEPLOYMENT.latestEditionApiUrl, {
        ...requestInit,
        signal: AbortSignal.timeout(8_000),
      }),
    ]);
    if (!programResponse.ok || !editionResponse.ok) {
      const status = !programResponse.ok ? programResponse.status : editionResponse.status;
      return disabledCapability(
        status === 404 ? "ConfigurationError" : "EndpointUnavailable",
        null,
      );
    }

    const source = await readProgramSource(programResponse);
    const currentEdition = Number(await editionResponse.text());
    if (!Number.isSafeInteger(currentEdition) || currentEdition < 0) {
      return disabledCapability("ConfigurationError", null);
    }

    let inspection: ProtocolV3SourceInspection;
    try {
      inspection = inspectProtocolV3Source(source);
    } catch {
      return disabledCapability("ConfigurationError", currentEdition);
    }

    if (currentEdition < ALEO_TESTNET_V3_EXPECTED_EDITION) {
      return disabledCapability("ProgramUpgradeRequired", currentEdition, inspection);
    }
    if (
      currentEdition !== ALEO_TESTNET_V3_EXPECTED_EDITION ||
      !inspection.available
    ) {
      return disabledCapability("ConfigurationError", currentEdition, inspection);
    }

    const transactionId = ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId;
    const feeTransactionId = ALEO_TESTNET_V3_UPGRADE_EVIDENCE.feeTransactionId;
    const compiledProgramSha256 =
      ALEO_TESTNET_V3_UPGRADE_EVIDENCE.compiledProgramSha256;
    const onChainProgramSourceSha256 =
      ALEO_TESTNET_V3_UPGRADE_EVIDENCE.onChainProgramSourceSha256;
    if (!transactionId || !feeTransactionId || !compiledProgramSha256 || !onChainProgramSourceSha256) {
      return disabledCapability("DeploymentEvidencePending", currentEdition, inspection);
    }
    const actualProgramSha256 = await sha256Hex(source);
    if (actualProgramSha256 !== onChainProgramSourceSha256) {
      return disabledCapability("ConfigurationError", currentEdition, inspection);
    }

    const verification = await verifyTestnetEditionOne(
      {
        endpoint: ALEO_TESTNET_DEPLOYMENT.apiEndpoint,
        programId: CANONICAL_ALEO_PROGRAM_ID,
        upgradeTransactionId: transactionId,
        feeTransactionId,
        adminAddress: ALEO_TESTNET_PROGRAM_OWNER,
        expectedEdition: ALEO_TESTNET_V3_EXPECTED_EDITION,
        expectedProgramSha256: onChainProgramSourceSha256,
      },
      fetcher,
    );
    if (verification.overallVerification !== "PASS") {
      return disabledCapability("ConfigurationError", currentEdition, inspection);
    }

    return {
      ...disabledCapability("Available", currentEdition, inspection),
      transactionBuilderEnabled: true,
      walletRequestEnabled: true,
      upgradeEvidenceRecorded: true,
      upgradeEvidenceVerified: true,
      programHashVerified: true,
    };
  } catch {
    return disabledCapability("EndpointUnavailable", null);
  }
}

export type ProtocolV3TransactionPreview = {
  source: "AleoTestnet";
  network: "testnet";
  walletChainId: typeof ALEO_WALLET_TESTNET_CHAIN_ID;
  programId: typeof CANONICAL_ALEO_PROGRAM_ID;
  functionName: ProtocolV3PublicFunctionName;
  feeMode: "Public";
  feeMicrocredits: number;
  inputs: readonly string[];
  publicSummary: {
    bountyId: string;
    claimHash?: string;
    action?: number;
    amount?: string;
    bondAmount?: string;
    recipient?: string;
    operationMarker?: string;
  };
};

const FIELD_PATTERN = /^[0-9]+field$/;
const ADDRESS_PATTERN = /^aleo1[0-9a-z]{58}$/;
const MAX_U64 = (1n << 64n) - 1n;
const MAX_U32 = (1n << 32n) - 1n;

function requireField(value: string, label: string, allowZero = false) {
  const normalized = value.trim();
  if (!FIELD_PATTERN.test(normalized) || (!allowZero && normalized === "0field")) {
    throw new Error(`${label} must be a ${allowZero ? "" : "non-zero "}Aleo field literal`);
  }
  return normalized;
}

function requireAddress(value: string, label = "Address") {
  const normalized = value.trim();
  if (!ADDRESS_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a valid Aleo address`);
  }
  return normalized;
}

function requireUnsigned(
  value: string | number,
  suffix: "u64" | "u32" | "u8",
  label: string,
  allowZero = false,
) {
  const normalized = String(value).trim().replace(new RegExp(`${suffix}$`), "");
  if (!/^[0-9]+$/.test(normalized)) {
    throw new Error(`${label} must be an unsigned integer`);
  }
  const parsed = BigInt(normalized);
  const max = suffix === "u8" ? 255n : suffix === "u32" ? MAX_U32 : MAX_U64;
  if (parsed > max || (!allowZero && parsed === 0n)) {
    throw new Error(`${label} is outside the allowed ${suffix} range`);
  }
  return `${parsed}${suffix}`;
}

function requireFee(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Transaction fee must be positive microcredits");
  }
  return value;
}

function serializeStruct(entries: readonly (readonly [string, string])[]) {
  return `{ ${entries.map(([name, value]) => `${name}: ${value}`).join(", ")} }`;
}

function buildPreview(
  functionName: ProtocolV3PublicFunctionName,
  inputs: readonly string[],
  feeMicrocredits: number,
  publicSummary: ProtocolV3TransactionPreview["publicSummary"],
): ProtocolV3TransactionPreview {
  const preview: ProtocolV3TransactionPreview = {
    source: "AleoTestnet",
    network: "testnet",
    walletChainId: ALEO_WALLET_TESTNET_CHAIN_ID,
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

export type BountyV3PolicyTransactionInput = {
  disclosureKeyCommitment: string;
  targetSystemCommitment: string;
  targetCodeHash: string;
  panelId: string;
  arbiters: readonly [string, string, string];
  quorum: 2 | 3;
  reviewWindowBlocks: number;
  decisionWindowBlocks: number;
  arbitrationFeeMicrocredits: string;
  paymentCondition: 1 | 2;
};

export function buildCreateBountyV3Transaction(input: {
  bountyId: string;
  scopeHash: string;
  ruleId: string;
  criticalReward: string;
  highReward: string;
  mediumReward: string;
  lowReward?: string;
  disclosureDeadline: number;
  policy: BountyV3PolicyTransactionInput;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const scopeHash = requireField(input.scopeHash, "Scope hash");
  const ruleId = requireField(input.ruleId, "Rule ID");
  const critical = requireUnsigned(input.criticalReward, "u64", "Critical reward");
  const high = requireUnsigned(input.highReward, "u64", "High reward");
  const medium = requireUnsigned(input.mediumReward, "u64", "Medium reward");
  const low = requireUnsigned(input.lowReward ?? "0", "u64", "Low reward", true);
  if (
    BigInt(critical.slice(0, -3)) < BigInt(high.slice(0, -3)) ||
    BigInt(high.slice(0, -3)) < BigInt(medium.slice(0, -3)) ||
    low !== "0u64"
  ) {
    throw new Error("V3 reward tiers must be descending and Low must be zero");
  }
  const deadline = requireUnsigned(
    input.disclosureDeadline,
    "u32",
    "Disclosure deadline",
  );
  const arbiters = input.policy.arbiters.map((address, index) =>
    requireAddress(address, `Arbiter ${index + 1}`)
  ) as [string, string, string];
  if (new Set(arbiters).size !== 3) {
    throw new Error("V3 arbitration panel requires three distinct addresses");
  }
  const policy = serializeStruct([
    ["disclosure_key_commitment", requireField(
      input.policy.disclosureKeyCommitment,
      "Disclosure key commitment",
    )],
    ["target_system_commitment", requireField(
      input.policy.targetSystemCommitment,
      "Target system commitment",
    )],
    ["target_code_hash", requireField(input.policy.targetCodeHash, "Target code hash")],
    ["panel_id", requireField(input.policy.panelId, "Panel ID")],
    ["arbiter_one", arbiters[0]],
    ["arbiter_two", arbiters[1]],
    ["arbiter_three", arbiters[2]],
    ["quorum", requireUnsigned(input.policy.quorum, "u8", "Panel quorum")],
    ["review_window_blocks", requireUnsigned(
      input.policy.reviewWindowBlocks,
      "u32",
      "Review window",
    )],
    ["decision_window_blocks", requireUnsigned(
      input.policy.decisionWindowBlocks,
      "u32",
      "Decision window",
    )],
    ["arbitration_fee_microcredits", requireUnsigned(
      input.policy.arbitrationFeeMicrocredits,
      "u64",
      "Arbitration fee",
    )],
    ["payment_condition", requireUnsigned(
      input.policy.paymentCondition,
      "u8",
      "Payment condition",
    )],
  ]);
  return buildPreview(
    "create_bounty_v3",
    [bountyId, scopeHash, ruleId, critical, high, medium, low, deadline, policy],
    input.feeMicrocredits,
    { bountyId },
  );
}

export type TransientSubmitClaimV3Request = TransientSubmitClaimRequest & {
  binding: {
    targetSystemCommitment: string;
    targetStateCommitment: string;
    targetCodeHash: string;
    executionCommitment: string;
    reportCommitment: string;
  };
};

export const SUBMIT_CLAIM_V3_FUNCTION = "submit_claim_v3" as const;

// This returns private inputs. Keep the array on the wallet call stack and clear
// it together with request.witness immediately after the wallet request resolves.
export function buildTransientSubmitClaimV3Inputs(
  request: TransientSubmitClaimV3Request,
) {
  const base = buildTransientSubmitClaimInputs(request);
  const binding = serializeStruct([
    ["target_system_commitment", requireField(
      request.binding.targetSystemCommitment,
      "Target system commitment",
    )],
    ["target_state_commitment", requireField(
      request.binding.targetStateCommitment,
      "Target state commitment",
    )],
    ["target_code_hash", requireField(request.binding.targetCodeHash, "Target code hash")],
    ["execution_commitment", requireField(
      request.binding.executionCommitment,
      "Execution commitment",
    )],
    ["report_commitment", requireField(
      request.binding.reportCommitment,
      "Report commitment",
    )],
  ]);
  const witnessNames = [
    "vault_balance_before",
    "total_deposits_before",
    "total_claims_before",
    "reserved_rewards_before",
    "withdraw_limit_before",
    "user_balance_before",
    "requested_withdraw_before",
    "hidden_delta_balance",
    "hidden_delta_claims",
    "hidden_delta_reserved_rewards",
    "hidden_delta_withdraw_amount",
    "hidden_delta_user_balance",
    "reporter_secret",
  ] as const;
  const witness = serializeStruct(
    witnessNames.map((name, index) => [name, base[index + 3]] as const),
  );
  const inputs = [base[0], base[1], base[2], binding, witness];
  base.fill("");
  if (inputs.length !== 5) throw new Error("submit_claim_v3 ABI input count mismatch");
  return inputs;
}

export function buildFundBountyV3Transaction(input: {
  bountyId: string;
  amount: string;
  fundingMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const amount = requireUnsigned(input.amount, "u64", "Funding amount");
  const marker = requireField(input.fundingMarker, "Funding marker");
  return buildPreview(
    "fund_bounty_v3",
    [bountyId, amount, marker],
    input.feeMicrocredits,
    { bountyId, amount: amount.slice(0, -3), operationMarker: marker },
  );
}

export function buildReviewClaimV3Transaction(input: {
  bountyId: string;
  claimHash: string;
  action: 1 | 2 | 3 | 4 | 5 | 6;
  projectSeverity: 0 | 1 | 2 | 3;
  decisionCommitment: string;
  actionMarker: string;
  feeMicrocredits: number;
}) {
  if (!Number.isSafeInteger(input.action) || input.action < 1 || input.action > 6) {
    throw new Error("review_claim_v3 action is outside the supported range");
  }
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim hash");
  const severity = requireUnsigned(
    input.projectSeverity,
    "u8",
    "Project severity",
    true,
  );
  if (input.action !== 2 && input.action !== 6 && severity !== "0u8") {
    throw new Error("Only accept and severity decisions may include a severity");
  }
  const commitment = requireField(input.decisionCommitment, "Decision commitment");
  const marker = requireField(input.actionMarker, "Action marker");
  return buildPreview(
    "review_claim_v3",
    [bountyId, claimHash, `${input.action}u8`, severity, commitment, marker],
    input.feeMicrocredits,
    { bountyId, claimHash, action: input.action, operationMarker: marker },
  );
}

export function buildLockRewardV3Transaction(input: {
  bountyId: string;
  claimHash: string;
  rewardAmount: string;
  lockMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim hash");
  const amount = requireUnsigned(input.rewardAmount, "u64", "Reward amount");
  const marker = requireField(input.lockMarker, "Lock marker");
  return buildPreview(
    "lock_reward_v3",
    [bountyId, claimHash, amount, marker],
    input.feeMicrocredits,
    {
      bountyId,
      claimHash,
      amount: amount.slice(0, -3),
      operationMarker: marker,
    },
  );
}

type ActionPreviewInput = {
  bountyId: string;
  claimHash: string;
  action: number;
  actionCommitment: string;
  actionMarker: string;
  feeMicrocredits: number;
};

function buildActionPreview(
  functionName:
    | "review_claim_v3"
    | "disclosure_action_v3"
    | "resolution_action_v3",
  input: ActionPreviewInput | {
    bountyId: string;
    claimHash: string;
    action: number;
    decisionCommitment: string;
    actionMarker: string;
    feeMicrocredits: number;
  },
  minimum: number,
  maximum: number,
  commitmentLabel: string,
) {
  if (!Number.isSafeInteger(input.action) || input.action < minimum || input.action > maximum) {
    throw new Error(`${functionName} action is outside the supported range`);
  }
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim hash");
  const commitmentValue = "decisionCommitment" in input
    ? input.decisionCommitment
    : input.actionCommitment;
  const commitment = requireField(commitmentValue, commitmentLabel);
  const marker = requireField(input.actionMarker, "Action marker");
  return buildPreview(
    functionName,
    [bountyId, claimHash, `${input.action}u8`, commitment, marker],
    input.feeMicrocredits,
    { bountyId, claimHash, action: input.action, operationMarker: marker },
  );
}

export function buildDisclosureActionV3Transaction(input: ActionPreviewInput) {
  return buildActionPreview(
    "disclosure_action_v3",
    input,
    1,
    2,
    "Disclosure commitment",
  );
}

export function buildResolutionActionV3Transaction(input: ActionPreviewInput) {
  return buildActionPreview(
    "resolution_action_v3",
    input,
    1,
    5,
    "Resolution commitment",
  );
}

export const PROTOCOL_V3_DISPUTE_TYPES = {
  Rejection: 1,
  Duplicate: 2,
  Scope: 3,
  Severity: 4,
  Reproduction: 5,
  Remediation: 6,
  SlaTimeout: 7,
} as const;

export type ProtocolV3DisputeType =
  (typeof PROTOCOL_V3_DISPUTE_TYPES)[keyof typeof PROTOCOL_V3_DISPUTE_TYPES];

export function buildDisputeClaimV3Transaction(input: {
  bountyId: string;
  claimHash: string;
  disputeType: ProtocolV3DisputeType;
  requestedSeverity: 0 | 1 | 2 | 3;
  disputeCommitment: string;
  feeAmount: string;
  disputeMarker: string;
  feeMicrocredits: number;
}) {
  if (!Number.isSafeInteger(input.disputeType) || input.disputeType < 1 || input.disputeType > 7) {
    throw new Error("Dispute type is outside the supported range");
  }
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim hash");
  const requestedSeverity = requireUnsigned(
    input.requestedSeverity,
    "u8",
    "Requested severity",
    true,
  );
  if (input.disputeType === PROTOCOL_V3_DISPUTE_TYPES.Severity) {
    if (requestedSeverity === "0u8") {
      throw new Error("Severity disputes require a payable requested severity");
    }
  } else if (requestedSeverity !== "0u8") {
    throw new Error("Only severity disputes may include a requested severity");
  }
  const commitment = requireField(input.disputeCommitment, "Dispute commitment");
  const feeAmount = requireUnsigned(input.feeAmount, "u64", "Arbitration fee");
  const marker = requireField(input.disputeMarker, "Dispute marker");
  return buildPreview(
    "dispute_claim_v3",
    [
      bountyId,
      claimHash,
      `${input.disputeType}u8`,
      requestedSeverity,
      commitment,
      feeAmount,
      marker,
    ],
    input.feeMicrocredits,
    {
      bountyId,
      claimHash,
      action: input.disputeType,
      bondAmount: feeAmount.slice(0, -3),
      operationMarker: marker,
    },
  );
}

export function buildCastArbitrationVoteV3Transaction(input: {
  bountyId: string;
  claimHash: string;
  verdict: 0 | 1 | 2 | 3;
  voteMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim hash");
  const marker = requireField(input.voteMarker, "Vote marker");
  return buildPreview(
    "cast_arbitration_vote_v3",
    [bountyId, claimHash, `${input.verdict}u8`, marker],
    input.feeMicrocredits,
    {
      bountyId,
      claimHash,
      action: input.verdict,
      operationMarker: marker,
    },
  );
}

type AwardSettlementInput = {
  bountyId: string;
  claimHash: string;
  whitehatAddress: string;
  rewardAmount: string;
  bondAmount: string;
  verdict: 0 | 1 | 2 | 3;
  marker: string;
  feeMicrocredits: number;
};

function buildAwardPreview(
  functionName: "settle_reward_v3" | "finalize_arbitration_prelock_v3",
  input: AwardSettlementInput,
) {
  if (functionName === "finalize_arbitration_prelock_v3" && input.verdict === 0) {
    throw new Error("Pre-lock arbitration finalization requires an award verdict");
  }
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim hash");
  const recipient = requireAddress(input.whitehatAddress, "Whitehat address");
  const reward = requireUnsigned(input.rewardAmount, "u64", "Reward amount");
  const bond = requireUnsigned(input.bondAmount, "u64", "Bond amount", true);
  if (functionName === "finalize_arbitration_prelock_v3" && bond === "0u64") {
    throw new Error("Pre-lock arbitration finalization requires a dispute bond");
  }
  const marker = requireField(input.marker, "Settlement marker");
  return buildPreview(
    functionName,
    [bountyId, claimHash, recipient, reward, bond, `${input.verdict}u8`, marker],
    input.feeMicrocredits,
    {
      bountyId,
      claimHash,
      recipient,
      amount: reward.slice(0, -3),
      bondAmount: bond.slice(0, -3),
      action: input.verdict,
      operationMarker: marker,
    },
  );
}

export function buildSettleRewardV3Transaction(input: AwardSettlementInput) {
  return buildAwardPreview("settle_reward_v3", input);
}

export function buildFinalizeArbitrationPrelockV3Transaction(
  input: AwardSettlementInput,
) {
  return buildAwardPreview("finalize_arbitration_prelock_v3", input);
}

export function buildFinalizeRejectionV3Transaction(input: {
  bountyId: string;
  claimHash: string;
  bondRecipient: string;
  bondAmount: string;
  verdict: 0 | 1 | 2 | 3;
  rejectionMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const claimHash = requireField(input.claimHash, "Claim hash");
  const recipient = requireAddress(input.bondRecipient, "Bond recipient");
  const bond = requireUnsigned(input.bondAmount, "u64", "Bond amount");
  const marker = requireField(input.rejectionMarker, "Rejection marker");
  return buildPreview(
    "finalize_rejection_v3",
    [bountyId, claimHash, recipient, bond, `${input.verdict}u8`, marker],
    input.feeMicrocredits,
    {
      bountyId,
      claimHash,
      recipient,
      bondAmount: bond.slice(0, -3),
      action: input.verdict,
      operationMarker: marker,
    },
  );
}

export function buildRefundBountyV3Transaction(input: {
  bountyId: string;
  amount: string;
  refundMarker: string;
  feeMicrocredits: number;
}) {
  const bountyId = requireField(input.bountyId, "Bounty ID");
  const amount = requireUnsigned(input.amount, "u64", "Refund amount");
  const marker = requireField(input.refundMarker, "Refund marker");
  return buildPreview(
    "refund_bounty_v3",
    [bountyId, amount, marker],
    input.feeMicrocredits,
    { bountyId, amount: amount.slice(0, -3), operationMarker: marker },
  );
}

export const PROTOCOL_V3_WALLET_BOUNDARY = {
  network: "testnet" as const,
  walletChainId: ALEO_WALLET_TESTNET_CHAIN_ID,
  programId: CANONICAL_ALEO_PROGRAM_ID,
  requiredEdition: ALEO_TESTNET_V3_EXPECTED_EDITION,
  functionNames: PROTOCOL_V3_FUNCTIONS,
  serverSubmissionAllowed: false,
  demoFallbackAllowed: false,
} as const;

export { getRuleFieldLiteral };
