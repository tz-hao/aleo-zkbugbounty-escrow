import type {
  OnChainBountyEscrowState,
  OnChainClaimPayoutState,
  OnChainClaimTriageState,
} from "./models.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";
import {
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "./aleo-bounty-registry.ts";

export const BOUNTY_ESCROW_MAPPING_NAME = "bounty_escrows";
export const CLAIM_PAYOUT_MAPPING_NAME = "claim_payouts";
export const CLAIM_TRIAGE_MAPPING_NAME = "claim_triage_states";
export const CLAIM_REPORTER_MAPPING_NAME = "claim_reporters";
export const BOUNTY_PROTOCOL_VERSION_MAPPING_NAME = "bounty_protocol_versions";
export const BOUNTY_CLAIM_COUNT_MAPPING_NAME = "bounty_claim_counts";

const ADDRESS_PATTERN = /^aleo1[0-9a-z]{58}$/;

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
  requiredFields: T,
  label: string,
) {
  const normalized = normalizeMappingResponse(raw, label);
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) {
    throw new Error(`${label} mapping returned an invalid struct`);
  }
  const values = new Map<(typeof requiredFields)[number], string>();
  const body = normalized.slice(1, -1).trim();
  for (const entry of body.split(",")) {
    const separator = entry.indexOf(":");
    if (separator <= 0) throw new Error(`${label} mapping contains an invalid field`);
    const key = entry.slice(0, separator).trim() as (typeof requiredFields)[number];
    const value = entry.slice(separator + 1).trim();
    if (!requiredFields.includes(key) || values.has(key) || !value) {
      throw new Error(`${label} mapping contains an unexpected field`);
    }
    values.set(key, value);
  }
  if (
    values.size !== requiredFields.length ||
    requiredFields.some((field) => !values.has(field))
  ) {
    throw new Error(`${label} mapping is missing required fields`);
  }
  return values;
}

function parseUnsigned(value: string, suffix: "u64" | "u32" | "u8") {
  const match = value.match(new RegExp(`^([0-9]+)${suffix}$`));
  if (!match) throw new Error(`Invalid Aleo ${suffix} literal`);
  const parsed = BigInt(match[1]);
  const max = suffix === "u8"
    ? 255n
    : suffix === "u32"
      ? 4_294_967_295n
      : (1n << 64n) - 1n;
  if (parsed > max) throw new Error(`Aleo ${suffix} literal is out of range`);
  return parsed;
}

function parseHeight(value: string) {
  return Number(parseUnsigned(value, "u32"));
}

function nullableField(value: string) {
  if (!isAleoFieldLiteral(value)) throw new Error("Invalid Aleo field literal");
  return value === "0field" ? null : value;
}

async function fetchMapping(
  mapping: string,
  key: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch,
) {
  if (!isAleoFieldLiteral(key)) throw new Error("Invalid Aleo mapping key");
  const url = `${config.endpoint}/${config.network}/program/${encodeURIComponent(config.programId)}/mapping/${mapping}/${encodeURIComponent(key)}`;
  const response = await fetcher(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Aleo ${mapping} request failed with HTTP ${response.status}`);
  }
  const raw = await response.text();
  return raw.trim() === "null" ? null : raw;
}

const escrowFields = [
  "owner_address",
  "total_funded",
  "available_balance",
  "locked_amount",
  "paid_amount",
  "refunded_amount",
  "status",
  "last_funding_height",
  "last_funding_marker",
  "last_refund_marker",
] as const;

export function parseOnChainBountyEscrow(
  raw: string,
  bountyId: string,
  config: AleoBountyRegistryConfig,
): OnChainBountyEscrowState {
  if (!isAleoFieldLiteral(bountyId)) throw new Error("Invalid Aleo bounty ID");
  const values = parseStructFields(raw, escrowFields, "Bounty escrow");
  const owner = values.get("owner_address")!;
  if (!ADDRESS_PATTERN.test(owner)) throw new Error("Invalid escrow owner address");
  const statusLiteral = values.get("status")!;
  const status = statusLiteral === "1u8"
    ? "Funded"
    : statusLiteral === "3u8"
      ? "Refunded"
      : null;
  if (!status) throw new Error("Unsupported escrow status");

  const escrow: OnChainBountyEscrowState = {
    bountyId,
    owner,
    totalFunded: parseUnsigned(values.get("total_funded")!, "u64").toString(),
    availableBalance: parseUnsigned(values.get("available_balance")!, "u64").toString(),
    lockedAmount: parseUnsigned(values.get("locked_amount")!, "u64").toString(),
    paidAmount: parseUnsigned(values.get("paid_amount")!, "u64").toString(),
    refundedAmount: parseUnsigned(values.get("refunded_amount")!, "u64").toString(),
    status,
    lastFundingHeight: parseHeight(values.get("last_funding_height")!),
    lastFundingMarker: nullableField(values.get("last_funding_marker")!),
    lastRefundMarker: nullableField(values.get("last_refund_marker")!),
    source: "AleoTestnet",
    network: config.network,
    programId: config.programId,
    mapping: BOUNTY_ESCROW_MAPPING_NAME,
  };
  assertNoPrivateFields(escrow);
  return escrow;
}

const payoutFields = [
  "claim_hash",
  "bounty_id",
  "whitehat_address",
  "reward_amount",
  "status",
  "locked_height",
  "paid_height",
  "release_marker",
] as const;

export function parseOnChainClaimPayout(
  raw: string,
  claimHash: string,
  config: AleoBountyRegistryConfig,
): OnChainClaimPayoutState {
  if (!isAleoFieldLiteral(claimHash)) throw new Error("Invalid Aleo claim hash");
  const values = parseStructFields(raw, payoutFields, "Claim payout");
  if (values.get("claim_hash") !== claimHash || !isAleoFieldLiteral(values.get("bounty_id")!)) {
    throw new Error("Claim payout key or Bounty ID is invalid");
  }
  const whitehatAddress = values.get("whitehat_address")!;
  if (!ADDRESS_PATTERN.test(whitehatAddress)) throw new Error("Invalid payout recipient");
  const statusLiteral = values.get("status")!;
  const status = statusLiteral === "1u8"
    ? "RewardLocked"
    : statusLiteral === "2u8"
      ? "Paid"
      : statusLiteral === "3u8"
        ? "Rejected"
        : null;
  if (!status) throw new Error("Unsupported payout status");
  const paidHeight = parseHeight(values.get("paid_height")!);

  const payout: OnChainClaimPayoutState = {
    claimHash,
    bountyId: values.get("bounty_id")!,
    whitehatAddress,
    rewardAmount: parseUnsigned(values.get("reward_amount")!, "u64").toString(),
    status,
    lockedHeight: parseHeight(values.get("locked_height")!),
    paidHeight: paidHeight === 0 ? null : paidHeight,
    releaseMarker: nullableField(values.get("release_marker")!),
    source: "AleoTestnet",
    network: config.network,
    programId: config.programId,
    mapping: CLAIM_PAYOUT_MAPPING_NAME,
  };
  assertNoPrivateFields(payout);
  return payout;
}

const triageFields = [
  "claim_hash",
  "bounty_id",
  "status",
  "package_hash",
  "updated_height",
] as const;

export function parseOnChainClaimTriage(
  raw: string,
  claimHash: string,
  config: AleoBountyRegistryConfig,
): OnChainClaimTriageState {
  if (!isAleoFieldLiteral(claimHash)) throw new Error("Invalid Aleo claim hash");
  const values = parseStructFields(raw, triageFields, "Claim triage");
  if (values.get("claim_hash") !== claimHash || !isAleoFieldLiteral(values.get("bounty_id")!)) {
    throw new Error("Claim triage key or Bounty ID is invalid");
  }
  const statusByLiteral: Record<string, OnChainClaimTriageState["status"]> = {
    "1u8": "RewardLocked",
    "2u8": "DetailsRequested",
    "3u8": "EncryptedDetailsShared",
    "4u8": "Patched",
    "5u8": "Paid",
    "6u8": "Rejected",
  };
  const status = statusByLiteral[values.get("status")!];
  if (!status) throw new Error("Unsupported triage status");

  const triage: OnChainClaimTriageState = {
    claimHash,
    bountyId: values.get("bounty_id")!,
    status,
    packageHash: nullableField(values.get("package_hash")!),
    updatedHeight: parseHeight(values.get("updated_height")!),
    source: "AleoTestnet",
    network: config.network,
    programId: config.programId,
    mapping: CLAIM_TRIAGE_MAPPING_NAME,
  };
  assertNoPrivateFields(triage);
  return triage;
}

export async function fetchOnChainBountyEscrow(
  bountyId: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping(BOUNTY_ESCROW_MAPPING_NAME, bountyId, config, fetcher);
  return raw ? parseOnChainBountyEscrow(raw, bountyId, config) : null;
}

export async function fetchOnChainClaimPayout(
  claimHash: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping(CLAIM_PAYOUT_MAPPING_NAME, claimHash, config, fetcher);
  return raw ? parseOnChainClaimPayout(raw, claimHash, config) : null;
}

export async function fetchOnChainClaimTriage(
  claimHash: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping(CLAIM_TRIAGE_MAPPING_NAME, claimHash, config, fetcher);
  return raw ? parseOnChainClaimTriage(raw, claimHash, config) : null;
}

export async function fetchOnChainClaimReporter(
  claimHash: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping(CLAIM_REPORTER_MAPPING_NAME, claimHash, config, fetcher);
  if (!raw) return null;
  const reporterAddress = normalizeMappingResponse(raw, "Claim reporter");
  if (!ADDRESS_PATTERN.test(reporterAddress)) {
    throw new Error("Claim reporter mapping returned an invalid Aleo address");
  }
  assertNoPrivateFields({ claimHash, reporterAddress });
  return reporterAddress;
}

export async function fetchOnChainBountyProtocolVersion(
  bountyId: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping(
    BOUNTY_PROTOCOL_VERSION_MAPPING_NAME,
    bountyId,
    config,
    fetcher,
  );
  if (!raw) return null;
  const value = normalizeMappingResponse(raw, "Bounty protocol version");
  return Number(parseUnsigned(value, "u8"));
}

export async function fetchOnChainBountyClaimCount(
  bountyId: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  const raw = await fetchMapping(
    BOUNTY_CLAIM_COUNT_MAPPING_NAME,
    bountyId,
    config,
    fetcher,
  );
  if (!raw) return null;
  const value = normalizeMappingResponse(raw, "Bounty claim count");
  return parseUnsigned(value, "u64").toString();
}
