import { assertNoPrivateFields } from "./privacy-guards.ts";
import type { DemoState } from "./models.ts";

export const DEMO_STATE_STORAGE_KEY = "zkbugbounty.public-demo-state.v1";

const PERSISTED_ARRAY_FIELDS = [
  "bounties",
  "claims",
  "claimReceipts",
  "publicClaimRegistry",
  "nullifierRecords",
  "disclosurePackages",
  "triageActions",
] as const;

const RULE_IDS = new Set([
  "vault-accounting-safety",
  "claims-vs-deposits",
  "reward-reserve-safety",
  "withdraw-limit-safety",
]);
const BOUNTY_STATUSES = new Set(["Draft", "Active", "Paused", "Closed"]);
const SEVERITIES = new Set(["Low", "Medium", "High", "Critical"]);
const PROOF_STATUSES = new Set(["Pending", "Verified", "Invalid"]);
const DISCLOSURE_STATUSES = new Set([
  "NotRequested",
  "Requested",
  "EncryptedDetailsShared",
  "Patched",
]);
const PAYOUT_STATUSES = new Set(["Unfunded", "RewardLocked", "Paid", "Rejected"]);
const ROLES = new Set(["ProjectOwner", "Whitehat", "TriageArbiter", "PublicUser"]);
const ACTION_TYPES = new Set([
  "RewardLocked",
  "DetailsRequested",
  "EncryptedDetailsShared",
  "Patched",
  "Paid",
  "Rejected",
  "PublicNoteAdded",
]);
const VERIFICATION_LEVELS = new Set([
  "Simulation",
  "LocalExecution",
  "RemoteExecution",
  "NetworkConfirmed",
  "Unavailable",
]);
const VERIFICATION_NETWORKS = new Set(["local", "testnet", "mainnet", "unavailable"]);
const DELIVERY_STATUSES = new Set(["Attested", "Acknowledged", "Expired"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasStringFields(value: Record<string, unknown>, fields: readonly string[]) {
  return fields.every((field) => typeof value[field] === "string");
}

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isAllowed(value: unknown, allowed: ReadonlySet<string>) {
  return typeof value === "string" && allowed.has(value);
}

function isProtocolVersion(value: unknown) {
  return isRecord(value) && hasStringFields(value, ["version", "proofSystem", "commitmentScheme", "nullifierScheme"]);
}

function isProofVerification(value: unknown) {
  if (value === undefined) return true;
  return (
    isRecord(value) &&
    isAllowed(value.level, VERIFICATION_LEVELS) &&
    isAllowed(value.network, VERIFICATION_NETWORKS) &&
    typeof value.programId === "string" &&
    (value.transactionId === undefined || typeof value.transactionId === "string")
  );
}

function isBounty(value: unknown) {
  if (!isRecord(value)) return false;
  const rewards = value.rewards;
  if (!isRecord(rewards)) return false;
  return (
    hasStringFields(value, [
      "id",
      "projectName",
      "scope",
      "scopeHash",
      "ruleId",
      "ruleName",
      "ruleText",
      "affectedModule",
      "disclosureDeadline",
      "ownerId",
      "status",
      "createdAt",
      "updatedAt",
    ]) &&
    isAllowed(value.ruleId, RULE_IDS) &&
    isAllowed(value.status, BOUNTY_STATUSES) &&
    isFiniteNumber(value.bountyAmount) &&
    ["critical", "high", "medium", "low"].every((field) => isFiniteNumber(rewards[field]))
  );
}

function isClaim(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    hasStringFields(value, [
      "id",
      "bountyId",
      "reporterId",
      "claimHash",
      "witnessCommitment",
      "nullifier",
      "reporterCommitment",
      "receiptId",
      "registryKey",
      "bugType",
      "ruleName",
      "affectedModule",
      "claimReceiptId",
      "createdAt",
      "updatedAt",
    ]) &&
    isFiniteNumber(value.impact) &&
    value.exploitDetailsVisible === false &&
    isAllowed(value.severity, SEVERITIES) &&
    isAllowed(value.proofStatus, PROOF_STATUSES) &&
    isAllowed(value.disclosureStatus, DISCLOSURE_STATUSES) &&
    isAllowed(value.payoutStatus, PAYOUT_STATUSES) &&
    isProofVerification(value.verification)
  );
}

function isClaimReceipt(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    hasStringFields(value, [
      "id",
      "receiptId",
      "claimHash",
      "bountyId",
      "projectId",
      "ruleId",
      "ruleName",
      "affectedModule",
      "scopeHash",
      "bugType",
      "proofEngine",
      "witnessCommitment",
      "nullifier",
      "reporterCommitment",
      "createdAt",
      "verifiedAt",
    ]) &&
    isFiniteNumber(value.impact) &&
    isAllowed(value.severity, SEVERITIES) &&
    isAllowed(value.proofStatus, PROOF_STATUSES) &&
    isProtocolVersion(value.protocolVersion) &&
    isProofVerification(value.verification)
  );
}

function isPublicClaimRegistryEntry(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    hasStringFields(value, [
      "registryKey",
      "claimId",
      "claimHash",
      "receiptId",
      "bountyId",
      "projectId",
      "ruleId",
      "ruleName",
      "affectedModule",
      "bugType",
      "proofEngine",
      "witnessCommitment",
      "nullifier",
      "createdAt",
      "updatedAt",
    ]) &&
    isFiniteNumber(value.impact) &&
    isAllowed(value.severity, SEVERITIES) &&
    isAllowed(value.proofStatus, PROOF_STATUSES) &&
    isAllowed(value.disclosureStatus, DISCLOSURE_STATUSES) &&
    isAllowed(value.payoutStatus, PAYOUT_STATUSES) &&
    isProofVerification(value.verification)
  );
}

function isNullifierRecord(value: unknown) {
  return isRecord(value) && hasStringFields(value, ["nullifier", "bountyId", "ruleId", "reporterCommitment", "usedAt", "claimId"]);
}

function isDisclosurePackage(value: unknown) {
  return (
    isRecord(value) &&
    hasStringFields(value, [
      "id",
      "claimId",
      "packageHash",
      "encryptedFor",
      "recipientKeyId",
      "sharedBy",
      "sharedAt",
      "packageVersion",
      "encryptionScheme",
      "expiresAt",
    ]) &&
    value.status === "Shared" &&
    (value.acknowledgedAt === null || typeof value.acknowledgedAt === "string") &&
    isAllowed(value.deliveryStatus, DELIVERY_STATUSES)
  );
}

function isTriageAction(value: unknown) {
  return (
    isRecord(value) &&
    hasStringFields(value, ["id", "claimId", "actorId", "publicNote", "createdAt"]) &&
    isAllowed(value.actorRole, ROLES) &&
    isAllowed(value.actionType, ACTION_TYPES)
  );
}

function isPersistedDemoState(value: unknown): value is PersistedDemoState {
  if (!isRecord(value)) return false;

  return (
    value.version === 1 &&
    PERSISTED_ARRAY_FIELDS.every((field) => Array.isArray(value[field])) &&
    (value.bounties as unknown[]).every(isBounty) &&
    (value.claims as unknown[]).every(isClaim) &&
    (value.claimReceipts as unknown[]).every(isClaimReceipt) &&
    (value.publicClaimRegistry as unknown[]).every(isPublicClaimRegistryEntry) &&
    (value.nullifierRecords as unknown[]).every(isNullifierRecord) &&
    (value.disclosurePackages as unknown[]).every(isDisclosurePackage) &&
    (value.triageActions as unknown[]).every(isTriageAction)
  );
}

export type PersistedDemoState = Pick<
  DemoState,
  | "bounties"
  | "claims"
  | "claimReceipts"
  | "publicClaimRegistry"
  | "nullifierRecords"
  | "disclosurePackages"
  | "triageActions"
> & {
  version: 1;
};

export function createPersistedDemoState(state: DemoState): PersistedDemoState {
  const persisted: PersistedDemoState = {
    version: 1,
    bounties: state.bounties,
    claims: state.claims,
    claimReceipts: state.claimReceipts,
    publicClaimRegistry: state.publicClaimRegistry,
    nullifierRecords: state.nullifierRecords,
    disclosurePackages: state.disclosurePackages,
    triageActions: state.triageActions,
  };

  assertNoPrivateFields(persisted);
  return persisted;
}

export function hydratePersistedDemoState(
  initialState: DemoState,
  persisted: PersistedDemoState,
): DemoState {
  if (!isPersistedDemoState(persisted)) return initialState;

  assertNoPrivateFields(persisted);
  const receipts = persisted.claimReceipts.map((receipt) => {
    if (receipt.verification) return receipt;
    const isBundledDemo = receipt.bountyId === "bounty-001" && receipt.projectId === "owner-demo";
    return {
      ...receipt,
      proofEngine: isBundledDemo ? "Mock Invariant Engine" : receipt.proofEngine,
      protocolVersion: isBundledDemo
        ? { ...receipt.protocolVersion, proofSystem: "mock-invariant" }
        : receipt.protocolVersion,
      verification: isBundledDemo
        ? { level: "Simulation" as const, network: "local" as const, programId: "mock-vault-engine" }
        : { level: "Unavailable" as const, network: "unavailable" as const, programId: "unknown" },
    };
  });
  const verificationByReceipt = new Map(
    receipts.map((receipt) => [receipt.receiptId, receipt.verification]),
  );
  return {
    ...initialState,
    bounties: persisted.bounties,
    claims: persisted.claims.map((claim) => ({
      ...claim,
      verification: claim.verification ?? verificationByReceipt.get(claim.receiptId),
    })),
    claimReceipts: receipts,
    publicClaimRegistry: persisted.publicClaimRegistry.map((entry) => {
      const verification = entry.verification ?? verificationByReceipt.get(entry.receiptId);
      return {
        ...entry,
        proofEngine:
          verification?.level === "Simulation" ? "Mock Invariant Engine" : entry.proofEngine,
        verification,
      };
    }),
    nullifierRecords: persisted.nullifierRecords,
    disclosurePackages: persisted.disclosurePackages,
    triageActions: persisted.triageActions,
  };
}

export function parsePersistedDemoState(value: string): PersistedDemoState | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isPersistedDemoState(parsed)) return null;
    assertNoPrivateFields(parsed);
    return parsed;
  } catch {
    return null;
  }
}