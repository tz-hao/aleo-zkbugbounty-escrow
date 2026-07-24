import { assertNoPrivateFields } from "../privacy-guards.ts";
import type {
  Bounty,
  ClaimReceipt,
  DisclosureStatus,
  NullifierRecord,
  PayoutStatus,
  ProofResult,
  PublicClaimRegistryEntry,
} from "../models.ts";

export type PublicClaimRegistryState = {
  publicClaimRegistry: PublicClaimRegistryEntry[];
  nullifierRecords: NullifierRecord[];
  claimReceipts: ClaimReceipt[];
};

export type RegisterVerifiedClaimInput = {
  claimId: string;
  bounty: Bounty;
  proof: ProofResult;
  createdAt: string;
  disclosureStatus?: DisclosureStatus;
  payoutStatus?: PayoutStatus;
};

export type RegisterVerifiedClaimResult = {
  registry: PublicClaimRegistryState;
  entry: PublicClaimRegistryEntry;
  receipt: ClaimReceipt;
  nullifierRecord: NullifierRecord;
};

export function createEmptyClaimRegistry(): PublicClaimRegistryState {
  return {
    publicClaimRegistry: [],
    nullifierRecords: [],
    claimReceipts: [],
  };
}

export function isNullifierUsed(registry: PublicClaimRegistryState, nullifier: string) {
  return registry.nullifierRecords.some((record) => record.nullifier === nullifier);
}

export function getNullifierRecord(registry: PublicClaimRegistryState, nullifier: string) {
  return registry.nullifierRecords.find((record) => record.nullifier === nullifier);
}

export function getClaimByRegistryKey(registry: PublicClaimRegistryState, registryKey: string) {
  return registry.publicClaimRegistry.find((entry) => entry.registryKey === registryKey);
}

export function getReceiptById(registry: PublicClaimRegistryState, receiptId: string) {
  return registry.claimReceipts.find((receipt) => receipt.receiptId === receiptId || receipt.id === receiptId);
}

export function listPublicClaims(registry: PublicClaimRegistryState) {
  return [...registry.publicClaimRegistry];
}

export function listClaimsByBounty(registry: PublicClaimRegistryState, bountyId: string) {
  return registry.publicClaimRegistry.filter((entry) => entry.bountyId === bountyId);
}

export function registerVerifiedClaim(
  registry: PublicClaimRegistryState,
  input: RegisterVerifiedClaimInput,
): RegisterVerifiedClaimResult {
  if (!input.proof.verified || input.proof.proofStatus !== "Verified") {
    throw new Error("Only verified proofs can be registered");
  }
  if (isNullifierUsed(registry, input.proof.nullifier)) {
    throw new Error("Duplicate claim detected. This nullifier has already been used.");
  }
  if (!input.proof.witnessCommitment) {
    throw new Error("Witness commitment is required");
  }
  if (!input.proof.claimHash) {
    throw new Error("Claim hash is required");
  }
  if (!input.proof.receiptId) {
    throw new Error("Receipt ID is required");
  }
  if (!input.proof.registryKey) {
    throw new Error("Registry key is required");
  }

  const entry: PublicClaimRegistryEntry = {
    registryKey: input.proof.registryKey,
    claimId: input.claimId,
    claimHash: input.proof.claimHash,
    receiptId: input.proof.receiptId,
    bountyId: input.bounty.id,
    projectId: input.bounty.ownerId,
    ruleId: input.proof.ruleId,
    ruleName: input.proof.ruleName,
    affectedModule: input.proof.affectedModule,
    impact: input.proof.impact,
    severity: input.proof.severity,
    bugType: input.proof.bugType,
    proofStatus: input.proof.proofStatus,
    disclosureStatus: input.disclosureStatus ?? "NotRequested",
    payoutStatus: input.payoutStatus ?? "Unfunded",
    proofEngine: input.proof.proofEngine,
    witnessCommitment: input.proof.witnessCommitment,
    nullifier: input.proof.nullifier,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    verification: input.proof.verification,
  };

  const receipt: ClaimReceipt = {
    id: input.proof.receiptId,
    receiptId: input.proof.receiptId,
    claimHash: input.proof.claimHash,
    bountyId: input.bounty.id,
    projectId: input.bounty.ownerId,
    ruleId: input.proof.ruleId,
    ruleName: input.proof.ruleName,
    affectedModule: input.proof.affectedModule,
    scopeHash: input.proof.scopeHash,
    impact: input.proof.impact,
    severity: input.proof.severity,
    bugType: input.proof.bugType,
    proofEngine: input.proof.proofEngine,
    proofStatus: input.proof.proofStatus,
    witnessCommitment: input.proof.witnessCommitment,
    nullifier: input.proof.nullifier,
    reporterCommitment: input.proof.reporterCommitment,
    createdAt: input.createdAt,
    verifiedAt: input.createdAt,
    protocolVersion: input.proof.protocolVersion,
    verification: input.proof.verification,
  };

  const nullifierRecord: NullifierRecord = {
    nullifier: input.proof.nullifier,
    bountyId: input.bounty.id,
    ruleId: input.proof.ruleId,
    reporterCommitment: input.proof.reporterCommitment,
    usedAt: input.createdAt,
    claimId: input.claimId,
  };

  assertNoPrivateFields(entry);
  assertNoPrivateFields(receipt);
  assertNoPrivateFields(nullifierRecord);

  return {
    entry,
    receipt,
    nullifierRecord,
    registry: {
      publicClaimRegistry: [entry, ...registry.publicClaimRegistry],
      claimReceipts: [receipt, ...registry.claimReceipts],
      nullifierRecords: [nullifierRecord, ...registry.nullifierRecords],
    },
  };
}
