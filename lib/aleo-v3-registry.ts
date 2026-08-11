import {
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "./aleo-bounty-registry.ts";
import type { ClaimV3State } from "./protocol-v3.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";
import {
  PROTOCOL_V3_MAPPINGS,
  type ProtocolV3MappingName,
} from "./aleo-protocol-v3.ts";

const ADDRESS_PATTERN = /^aleo1[0-9a-z]{58}$/;
const MAX_U64 = (1n << 64n) - 1n;
const MAX_U32 = (1n << 32n) - 1n;

type PublicV3Source<M extends ProtocolV3MappingName> = {
  source: "AleoTestnet";
  network: "testnet";
  programId: string;
  mapping: M;
};

export type OnChainBountyV3Config =
  PublicV3Source<"bounty_v3_configs"> & {
    bountyId: string;
    disclosureKeyCommitment: string;
    targetSystemCommitment: string;
    targetCodeHash: string;
    panelId: string;
    arbiters: readonly [string, string, string];
    quorum: 2 | 3;
    reviewWindowBlocks: number;
    decisionWindowBlocks: number;
    arbitrationFeeMicrocredits: string;
    paymentCondition: "OnReproduction" | "OnPatchAcceptance";
    configuredHeight: number;
  };

export type OnChainClaimV3Evidence =
  PublicV3Source<"claim_v3_evidence"> & {
    claimHash: string;
    bountyId: string;
    targetSystemCommitment: string;
    targetStateCommitment: string;
    targetCodeHash: string;
    executionCommitment: string;
    reportCommitment: string;
    submittedHeight: number;
  };

export type OnChainClaimV3State =
  PublicV3Source<"claim_v3_states"> & {
    claimHash: string;
    bountyId: string;
    whitehatAddress: string;
    status: ClaimV3State;
    statusCode: number;
    preDisputeStatus: ClaimV3State | null;
    preDisputeStatusCode: number;
    packageHash: string | null;
    reproductionCommitment: string | null;
    patchCommitment: string | null;
    disputeCommitment: string | null;
    updatedHeight: number;
  };

export type OnChainClaimV3Payout =
  PublicV3Source<"claim_v3_payouts"> & {
    claimHash: string;
    bountyId: string;
    whitehatAddress: string;
    reservedAmount: string;
    paidAmount: string;
    status: "RewardLocked" | "Paid" | "Rejected";
    lockedHeight: number;
    paidHeight: number | null;
    releaseMarker: string | null;
  };

export type OnChainClaimV3ArbitrationTally =
  PublicV3Source<"claim_v3_arbitration_tallies"> & {
    claimHash: string;
    bountyId: string;
    rejectVotes: number;
    mediumVotes: number;
    highVotes: number;
    criticalVotes: number;
    updatedHeight: number;
  };

export type OnChainClaimV3ArbitrationVote =
  PublicV3Source<"claim_v3_arbitration_votes"> & {
    voteKey: string;
    claimHash: string;
    bountyId: string;
    voter: string;
    verdict: "Reject" | "Medium" | "High" | "Critical";
    voteHeight: number;
    voteMarker: string;
  };

export type OnChainClaimV3DisputeBond =
  PublicV3Source<"claim_v3_dispute_bonds"> & {
    claimHash: string;
    bountyId: string;
    payer: string;
    amount: string;
    status: "Pending" | "Settled";
    settledHeight: number | null;
  };

function source<M extends ProtocolV3MappingName>(
  mapping: M,
  config: AleoBountyRegistryConfig,
): PublicV3Source<M> {
  return {
    source: "AleoTestnet",
    network: config.network,
    programId: config.programId,
    mapping,
  };
}

function normalizeMappingResponse(raw: string, label: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${label} mapping returned an empty response`);
  if (!trimmed.startsWith('"')) return trimmed;
  const parsed: unknown = JSON.parse(trimmed);
  if (typeof parsed !== "string") {
    throw new Error(`${label} mapping returned an invalid response`);
  }
  return parsed.trim();
}

function parseStructFields<const T extends readonly string[]>(
  raw: string,
  expectedFields: T,
  label: string,
) {
  const normalized = normalizeMappingResponse(raw, label);
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) {
    throw new Error(`${label} mapping returned an invalid struct`);
  }
  const fields = new Map<(typeof expectedFields)[number], string>();
  const body = normalized.slice(1, -1).trim();
  for (const entry of body.split(",")) {
    const separator = entry.indexOf(":");
    if (separator <= 0) throw new Error(`${label} mapping contains an invalid field`);
    const key = entry.slice(0, separator).trim() as (typeof expectedFields)[number];
    const value = entry.slice(separator + 1).trim();
    if (!expectedFields.includes(key) || fields.has(key) || !value) {
      throw new Error(`${label} mapping contains an unexpected field`);
    }
    fields.set(key, value);
  }
  if (
    fields.size !== expectedFields.length ||
    expectedFields.some((field) => !fields.has(field))
  ) {
    throw new Error(`${label} mapping is missing required fields`);
  }
  return fields;
}

function field(value: string, label: string, allowZero = false) {
  if (!isAleoFieldLiteral(value) || (!allowZero && value === "0field")) {
    throw new Error(`${label} contains an invalid Aleo field literal`);
  }
  return value;
}

function nullableField(value: string, label: string) {
  const parsed = field(value, label, true);
  return parsed === "0field" ? null : parsed;
}

function address(value: string, label: string) {
  if (!ADDRESS_PATTERN.test(value)) throw new Error(`${label} contains an invalid Aleo address`);
  return value;
}

function unsigned(value: string, suffix: "u8" | "u32" | "u64", label: string) {
  const match = value.match(new RegExp(`^([0-9]+)${suffix}$`));
  if (!match) throw new Error(`${label} contains an invalid Aleo ${suffix} literal`);
  const parsed = BigInt(match[1]);
  const maximum = suffix === "u8" ? 255n : suffix === "u32" ? MAX_U32 : MAX_U64;
  if (parsed > maximum) throw new Error(`${label} contains an out-of-range ${suffix} literal`);
  return parsed;
}

function height(value: string, label: string) {
  return Number(unsigned(value, "u32", label));
}

const stateNames: Record<number, ClaimV3State> = {
  1: "Submitted",
  2: "OwnerReviewing",
  3: "Accepted",
  4: "RewardLocked",
  5: "DisclosureDelivered",
  6: "DisclosureAcknowledged",
  7: "ReproductionConfirmed",
  8: "ReproductionRejected",
  9: "PatchProposed",
  10: "PatchAccepted",
  11: "Disputed",
  12: "Paid",
  13: "OwnerRejected",
  14: "Rejected",
};

function claimState(value: string, label: string, allowZero = false) {
  const code = Number(unsigned(value, "u8", label));
  if (allowZero && code === 0) return { code, state: null };
  const state = stateNames[code];
  if (!state) throw new Error(`${label} contains an unsupported V3 state`);
  return { code, state };
}

async function fetchMapping(
  mapping: ProtocolV3MappingName,
  key: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch,
) {
  if (!PROTOCOL_V3_MAPPINGS.includes(mapping) || !isAleoFieldLiteral(key)) {
    throw new Error("Invalid Protocol V3 mapping lookup");
  }
  const response = await fetcher(
    `${config.endpoint}/${config.network}/program/${encodeURIComponent(config.programId)}/mapping/${mapping}/${encodeURIComponent(key)}`,
    {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Aleo ${mapping} request failed with HTTP ${response.status}`);
  }
  const raw = await response.text();
  return raw.trim() === "null" || raw.trim() === '"null"' ? null : raw;
}

const configFields = [
  "bounty_id",
  "disclosure_key_commitment",
  "target_system_commitment",
  "target_code_hash",
  "panel_id",
  "arbiter_one",
  "arbiter_two",
  "arbiter_three",
  "quorum",
  "review_window_blocks",
  "decision_window_blocks",
  "arbitration_fee_microcredits",
  "payment_condition",
  "configured_height",
] as const;

export function parseOnChainBountyV3Config(
  raw: string,
  bountyId: string,
  config: AleoBountyRegistryConfig,
): OnChainBountyV3Config {
  field(bountyId, "Bounty V3 key");
  const values = parseStructFields(raw, configFields, "Bounty V3 config");
  if (values.get("bounty_id") !== bountyId) {
    throw new Error("Bounty V3 config key does not match its Bounty ID");
  }
  const arbiters = [
    address(values.get("arbiter_one")!, "Bounty V3 arbiter one"),
    address(values.get("arbiter_two")!, "Bounty V3 arbiter two"),
    address(values.get("arbiter_three")!, "Bounty V3 arbiter three"),
  ] as const;
  if (new Set(arbiters).size !== 3) {
    throw new Error("Bounty V3 config contains duplicate arbiters");
  }
  const quorum = Number(unsigned(values.get("quorum")!, "u8", "Bounty V3 quorum"));
  if (quorum !== 2 && quorum !== 3) throw new Error("Bounty V3 quorum is unsupported");
  const payment = Number(unsigned(
    values.get("payment_condition")!,
    "u8",
    "Bounty V3 payment condition",
  ));
  if (payment !== 1 && payment !== 2) {
    throw new Error("Bounty V3 payment condition is unsupported");
  }
  const parsed: OnChainBountyV3Config = {
    bountyId,
    disclosureKeyCommitment: field(
      values.get("disclosure_key_commitment")!,
      "Bounty V3 disclosure key",
    ),
    targetSystemCommitment: field(
      values.get("target_system_commitment")!,
      "Bounty V3 target system",
    ),
    targetCodeHash: field(values.get("target_code_hash")!, "Bounty V3 target code"),
    panelId: field(values.get("panel_id")!, "Bounty V3 panel ID"),
    arbiters,
    quorum,
    reviewWindowBlocks: height(
      values.get("review_window_blocks")!,
      "Bounty V3 review window",
    ),
    decisionWindowBlocks: height(
      values.get("decision_window_blocks")!,
      "Bounty V3 decision window",
    ),
    arbitrationFeeMicrocredits: unsigned(
      values.get("arbitration_fee_microcredits")!,
      "u64",
      "Bounty V3 arbitration fee",
    ).toString(),
    paymentCondition: payment === 1 ? "OnReproduction" : "OnPatchAcceptance",
    configuredHeight: height(
      values.get("configured_height")!,
      "Bounty V3 configured height",
    ),
    ...source("bounty_v3_configs", config),
  };
  assertNoPrivateFields(parsed);
  return parsed;
}

const evidenceFields = [
  "claim_hash",
  "bounty_id",
  "target_system_commitment",
  "target_state_commitment",
  "target_code_hash",
  "execution_commitment",
  "report_commitment",
  "submitted_height",
] as const;

export function parseOnChainClaimV3Evidence(
  raw: string,
  claimHash: string,
  config: AleoBountyRegistryConfig,
): OnChainClaimV3Evidence {
  field(claimHash, "Claim V3 evidence key");
  const values = parseStructFields(raw, evidenceFields, "Claim V3 evidence");
  if (values.get("claim_hash") !== claimHash) {
    throw new Error("Claim V3 evidence key does not match its Claim hash");
  }
  const parsed: OnChainClaimV3Evidence = {
    claimHash,
    bountyId: field(values.get("bounty_id")!, "Claim V3 evidence Bounty ID"),
    targetSystemCommitment: field(
      values.get("target_system_commitment")!,
      "Claim V3 target system",
    ),
    targetStateCommitment: field(
      values.get("target_state_commitment")!,
      "Claim V3 target state",
    ),
    targetCodeHash: field(values.get("target_code_hash")!, "Claim V3 target code"),
    executionCommitment: field(
      values.get("execution_commitment")!,
      "Claim V3 execution commitment",
    ),
    reportCommitment: field(
      values.get("report_commitment")!,
      "Claim V3 report commitment",
    ),
    submittedHeight: height(
      values.get("submitted_height")!,
      "Claim V3 submitted height",
    ),
    ...source("claim_v3_evidence", config),
  };
  assertNoPrivateFields(parsed);
  return parsed;
}

const stateFields = [
  "claim_hash",
  "bounty_id",
  "whitehat_address",
  "status",
  "pre_dispute_status",
  "package_hash",
  "reproduction_commitment",
  "patch_commitment",
  "dispute_commitment",
  "updated_height",
] as const;

export function parseOnChainClaimV3State(
  raw: string,
  claimHash: string,
  config: AleoBountyRegistryConfig,
): OnChainClaimV3State {
  field(claimHash, "Claim V3 state key");
  const values = parseStructFields(raw, stateFields, "Claim V3 state");
  if (values.get("claim_hash") !== claimHash) {
    throw new Error("Claim V3 state key does not match its Claim hash");
  }
  const status = claimState(values.get("status")!, "Claim V3 status");
  const previous = claimState(
    values.get("pre_dispute_status")!,
    "Claim V3 pre-dispute status",
    true,
  );
  const parsed: OnChainClaimV3State = {
    claimHash,
    bountyId: field(values.get("bounty_id")!, "Claim V3 state Bounty ID"),
    whitehatAddress: address(
      values.get("whitehat_address")!,
      "Claim V3 Whitehat",
    ),
    status: status.state!,
    statusCode: status.code,
    preDisputeStatus: previous.state,
    preDisputeStatusCode: previous.code,
    packageHash: nullableField(values.get("package_hash")!, "Claim V3 package hash"),
    reproductionCommitment: nullableField(
      values.get("reproduction_commitment")!,
      "Claim V3 reproduction commitment",
    ),
    patchCommitment: nullableField(
      values.get("patch_commitment")!,
      "Claim V3 patch commitment",
    ),
    disputeCommitment: nullableField(
      values.get("dispute_commitment")!,
      "Claim V3 dispute commitment",
    ),
    updatedHeight: height(values.get("updated_height")!, "Claim V3 updated height"),
    ...source("claim_v3_states", config),
  };
  assertNoPrivateFields(parsed);
  return parsed;
}

const payoutFields = [
  "claim_hash",
  "bounty_id",
  "whitehat_address",
  "reserved_amount",
  "paid_amount",
  "status",
  "locked_height",
  "paid_height",
  "release_marker",
] as const;

export function parseOnChainClaimV3Payout(
  raw: string,
  claimHash: string,
  config: AleoBountyRegistryConfig,
): OnChainClaimV3Payout {
  field(claimHash, "Claim V3 payout key");
  const values = parseStructFields(raw, payoutFields, "Claim V3 payout");
  if (values.get("claim_hash") !== claimHash) {
    throw new Error("Claim V3 payout key does not match its Claim hash");
  }
  const statusCode = Number(unsigned(values.get("status")!, "u8", "Claim V3 payout status"));
  const status = statusCode === 1
    ? "RewardLocked"
    : statusCode === 2
      ? "Paid"
      : statusCode === 3
        ? "Rejected"
        : null;
  if (!status) throw new Error("Claim V3 payout status is unsupported");
  const paidHeight = height(values.get("paid_height")!, "Claim V3 paid height");
  const parsed: OnChainClaimV3Payout = {
    claimHash,
    bountyId: field(values.get("bounty_id")!, "Claim V3 payout Bounty ID"),
    whitehatAddress: address(
      values.get("whitehat_address")!,
      "Claim V3 payout Whitehat",
    ),
    reservedAmount: unsigned(
      values.get("reserved_amount")!,
      "u64",
      "Claim V3 reserved amount",
    ).toString(),
    paidAmount: unsigned(
      values.get("paid_amount")!,
      "u64",
      "Claim V3 paid amount",
    ).toString(),
    status,
    lockedHeight: height(values.get("locked_height")!, "Claim V3 locked height"),
    paidHeight: paidHeight === 0 ? null : paidHeight,
    releaseMarker: nullableField(
      values.get("release_marker")!,
      "Claim V3 release marker",
    ),
    ...source("claim_v3_payouts", config),
  };
  assertNoPrivateFields(parsed);
  return parsed;
}

const tallyFields = [
  "claim_hash",
  "bounty_id",
  "reject_votes",
  "medium_votes",
  "high_votes",
  "critical_votes",
  "updated_height",
] as const;

export function parseOnChainClaimV3ArbitrationTally(
  raw: string,
  claimHash: string,
  config: AleoBountyRegistryConfig,
): OnChainClaimV3ArbitrationTally {
  field(claimHash, "Claim V3 tally key");
  const values = parseStructFields(raw, tallyFields, "Claim V3 arbitration tally");
  if (values.get("claim_hash") !== claimHash) {
    throw new Error("Claim V3 tally key does not match its Claim hash");
  }
  const parsed: OnChainClaimV3ArbitrationTally = {
    claimHash,
    bountyId: field(values.get("bounty_id")!, "Claim V3 tally Bounty ID"),
    rejectVotes: Number(unsigned(values.get("reject_votes")!, "u8", "Reject votes")),
    mediumVotes: Number(unsigned(values.get("medium_votes")!, "u8", "Medium votes")),
    highVotes: Number(unsigned(values.get("high_votes")!, "u8", "High votes")),
    criticalVotes: Number(unsigned(values.get("critical_votes")!, "u8", "Critical votes")),
    updatedHeight: height(values.get("updated_height")!, "Claim V3 tally height"),
    ...source("claim_v3_arbitration_tallies", config),
  };
  assertNoPrivateFields(parsed);
  return parsed;
}

const voteFields = [
  "claim_hash",
  "bounty_id",
  "voter",
  "verdict",
  "vote_height",
  "vote_marker",
] as const;

export function parseOnChainClaimV3ArbitrationVote(
  raw: string,
  voteKey: string,
  config: AleoBountyRegistryConfig,
): OnChainClaimV3ArbitrationVote {
  field(voteKey, "Claim V3 vote key");
  const values = parseStructFields(raw, voteFields, "Claim V3 arbitration vote");
  const verdictCode = Number(unsigned(values.get("verdict")!, "u8", "Claim V3 verdict"));
  const verdict = (["Reject", "Medium", "High", "Critical"] as const)[verdictCode];
  if (!verdict) throw new Error("Claim V3 verdict is unsupported");
  const parsed: OnChainClaimV3ArbitrationVote = {
    voteKey,
    claimHash: field(values.get("claim_hash")!, "Claim V3 vote Claim hash"),
    bountyId: field(values.get("bounty_id")!, "Claim V3 vote Bounty ID"),
    voter: address(values.get("voter")!, "Claim V3 voter"),
    verdict,
    voteHeight: height(values.get("vote_height")!, "Claim V3 vote height"),
    voteMarker: field(values.get("vote_marker")!, "Claim V3 vote marker"),
    ...source("claim_v3_arbitration_votes", config),
  };
  assertNoPrivateFields(parsed);
  return parsed;
}

const bondFields = [
  "claim_hash",
  "bounty_id",
  "payer",
  "amount",
  "status",
  "settled_height",
] as const;

export function parseOnChainClaimV3DisputeBond(
  raw: string,
  claimHash: string,
  config: AleoBountyRegistryConfig,
): OnChainClaimV3DisputeBond {
  field(claimHash, "Claim V3 bond key");
  const values = parseStructFields(raw, bondFields, "Claim V3 dispute bond");
  if (values.get("claim_hash") !== claimHash) {
    throw new Error("Claim V3 bond key does not match its Claim hash");
  }
  const statusCode = Number(unsigned(values.get("status")!, "u8", "Claim V3 bond status"));
  if (statusCode !== 1 && statusCode !== 2) {
    throw new Error("Claim V3 bond status is unsupported");
  }
  const settled = height(values.get("settled_height")!, "Claim V3 bond settled height");
  const parsed: OnChainClaimV3DisputeBond = {
    claimHash,
    bountyId: field(values.get("bounty_id")!, "Claim V3 bond Bounty ID"),
    payer: address(values.get("payer")!, "Claim V3 bond payer"),
    amount: unsigned(values.get("amount")!, "u64", "Claim V3 bond amount").toString(),
    status: statusCode === 1 ? "Pending" : "Settled",
    settledHeight: settled === 0 ? null : settled,
    ...source("claim_v3_dispute_bonds", config),
  };
  assertNoPrivateFields(parsed);
  return parsed;
}

export async function fetchOnChainBountyV3Config(
  bountyId: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping("bounty_v3_configs", bountyId, config, fetcher);
  return raw ? parseOnChainBountyV3Config(raw, bountyId, config) : null;
}

export async function fetchOnChainClaimV3Evidence(
  claimHash: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping("claim_v3_evidence", claimHash, config, fetcher);
  return raw ? parseOnChainClaimV3Evidence(raw, claimHash, config) : null;
}

export async function fetchOnChainClaimV3State(
  claimHash: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping("claim_v3_states", claimHash, config, fetcher);
  return raw ? parseOnChainClaimV3State(raw, claimHash, config) : null;
}

export async function fetchOnChainClaimV3Payout(
  claimHash: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping("claim_v3_payouts", claimHash, config, fetcher);
  return raw ? parseOnChainClaimV3Payout(raw, claimHash, config) : null;
}

export async function fetchOnChainClaimV3ArbitrationTally(
  claimHash: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping(
    "claim_v3_arbitration_tallies",
    claimHash,
    config,
    fetcher,
  );
  return raw ? parseOnChainClaimV3ArbitrationTally(raw, claimHash, config) : null;
}

export async function fetchOnChainClaimV3ArbitrationVote(
  voteKey: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping("claim_v3_arbitration_votes", voteKey, config, fetcher);
  return raw ? parseOnChainClaimV3ArbitrationVote(raw, voteKey, config) : null;
}

export async function fetchOnChainClaimV3Acknowledgement(
  claimHash: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping(
    "claim_v3_acknowledgements",
    claimHash,
    config,
    fetcher,
  );
  if (!raw) return null;
  const acknowledgement = field(
    normalizeMappingResponse(raw, "Claim V3 acknowledgement"),
    "Claim V3 acknowledgement",
  );
  const parsed = {
    claimHash,
    acknowledgement,
    ...source("claim_v3_acknowledgements", config),
  };
  assertNoPrivateFields(parsed);
  return parsed;
}

export async function fetchOnChainClaimV3DisputeBond(
  claimHash: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping("claim_v3_dispute_bonds", claimHash, config, fetcher);
  return raw ? parseOnChainClaimV3DisputeBond(raw, claimHash, config) : null;
}

export async function fetchOnChainV3OperationMarker(
  marker: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping("v3_operation_markers", marker, config, fetcher);
  if (!raw) return null;
  const normalized = normalizeMappingResponse(raw, "V3 operation marker");
  if (normalized !== "true") throw new Error("V3 operation marker returned an invalid value");
  return {
    marker,
    used: true as const,
    ...source("v3_operation_markers", config),
  };
}
