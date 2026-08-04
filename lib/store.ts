import { prefixedHash } from "./hash.ts";
import { DEMO_VAULT_RULES, getDemoVaultRule } from "./demo-vault.ts";
import { assertNoPrivateFields, redactSensitiveText, sanitizeProofResult } from "./privacy-guards.ts";
import { demoActors, getDemoActor } from "./roles.ts";
import {
  demoBounties,
  demoClaimReceipts,
  demoClaims,
  demoNullifierRecords,
  demoPublicClaimRegistry,
  demoTriageActions,
} from "./mock-data.ts";
import {
  getClaimByRegistryKey,
  getReceiptById,
  isNullifierUsed as registryHasNullifier,
  listPublicClaims,
  registerVerifiedClaim as registerClaimInRegistry,
  type PublicClaimRegistryState,
} from "./protocol/claim-registry.ts";
import { applyClaimAction } from "./state-machine.ts";
import {
  canAddTriageNote,
  canCreateBounty,
  canLockReward,
  canMarkPatched,
  canRejectClaim,
  canReleaseBounty,
  canRequestEncryptedDetails,
  canShareEncryptedDetails,
  canSubmitProof,
} from "./permissions.ts";
import type {
  ActionType,
  Bounty,
  BountyRewards,
  BugClaim,
  ClaimReceipt,
  CurrentActor,
  DemoState,
  DisclosurePackage,
  ProofResult,
  PublicClaimRegistryEntry,
  Role,
  TriageAction,
} from "./models.ts";

type BountyInput = {
  projectName: string;
  scope: string;
  bountyAmount: number;
  rewards: BountyRewards;
  ruleId?: Bounty["ruleId"];
  ruleText?: string;
  disclosureDeadline: string;
};

export type DisclosureShareAttestation = {
  packageHash: string;
  recipientKeyId: string;
};

function now() {
  return new Date().toISOString();
}

function publicAction(
  claimId: string,
  actor: CurrentActor,
  actionType: ActionType,
  publicNote: string,
): TriageAction {
  return {
    id: `action-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    claimId,
    actorId: actor.id,
    actorRole: actor.role,
    actionType,
    publicNote: redactSensitiveText(publicNote),
    createdAt: now(),
  };
}

function findClaim(state: DemoState, claimId: string) {
  const claim = state.claims.find((item) => item.id === claimId);
  if (!claim) {
    throw new Error("Claim not found");
  }
  return claim;
}

function findBounty(state: DemoState, bountyId: string) {
  const bounty = state.bounties.find((item) => item.id === bountyId);
  if (!bounty) {
    throw new Error("Bounty not found");
  }
  return bounty;
}

function replaceClaim(state: DemoState, claim: BugClaim): DemoState {
  return {
    ...state,
    claims: state.claims.map((item) => (item.id === claim.id ? claim : item)),
    publicClaimRegistry: state.publicClaimRegistry.map((entry) =>
      entry.claimId === claim.id
        ? {
            ...entry,
            disclosureStatus: claim.disclosureStatus,
            payoutStatus: claim.payoutStatus,
            proofStatus: claim.proofStatus,
            updatedAt: claim.updatedAt,
          }
        : entry,
    ),
  };
}

function addAction(state: DemoState, action: TriageAction): DemoState {
  return {
    ...state,
    triageActions: [action, ...state.triageActions],
  };
}

export function createInitialDemoState(): DemoState {
  return {
    actors: demoActors.map((actor) => ({ ...actor })),
    currentActor: getDemoActor("ProjectOwner"),
    bounties: demoBounties.map((bounty) => ({ ...bounty, rewards: { ...bounty.rewards } })),
    claims: demoClaims.map((claim) => ({ ...claim })),
    claimReceipts: demoClaimReceipts.map((receipt) => ({
      ...receipt,
      protocolVersion: { ...receipt.protocolVersion },
    })),
    publicClaimRegistry: demoPublicClaimRegistry.map((entry) => ({ ...entry })),
    nullifierRecords: demoNullifierRecords.map((record) => ({ ...record })),
    disclosurePackages: [],
    triageActions: demoTriageActions.map((action) => ({ ...action })),
  };
}

export function switchActor(state: DemoState, role: Role): DemoState {
  return {
    ...state,
    currentActor: getDemoActor(role),
  };
}

export function createBounty(state: DemoState, actor: CurrentActor, input: BountyInput): DemoState {
  if (!canCreateBounty(actor)) {
    throw new Error("Only Project Owner can create bounty programs");
  }

  const timestamp = now();
  const rule = getDemoVaultRule(input.ruleId ?? DEMO_VAULT_RULES[0].id);
  const bounty: Bounty = {
    id: `bounty-${Date.now().toString(36)}`,
    projectName: input.projectName,
    scope: input.scope,
    scopeHash: prefixedHash("scope", input.scope),
    ruleId: rule.id,
    ruleName: rule.name,
    ruleText: input.ruleText || rule.invariantText,
    affectedModule: rule.affectedModule,
    bountyAmount: input.bountyAmount,
    rewards: { ...input.rewards },
    disclosureDeadline: input.disclosureDeadline,
    ownerId: actor.id,
    status: "Active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    ...state,
    bounties: [bounty, ...state.bounties],
  };
}

export function submitClaim(
  state: DemoState,
  actor: CurrentActor,
  bountyId: string,
  proof: ProofResult,
): DemoState {
  const publicProof = sanitizeProofResult(proof);
  if (!canSubmitProof(actor)) {
    throw new Error("Only Whitehat can submit proof");
  }
  if (!publicProof.verified || publicProof.proofStatus !== "Verified") {
    throw new Error("Only verified proofs can create public claims");
  }

  const bounty = findBounty(state, bountyId);
  if (bounty.status !== "Active") {
    throw new Error("Only active bounties accept claims");
  }
  if (bounty.scopeHash !== publicProof.scopeHash || bounty.ruleId !== publicProof.ruleId) {
    throw new Error("Proof does not match bounty scope or rule");
  }

  const timestamp = now();
  const claimId = `claim-${Date.now().toString(36)}-${state.claims.length + 1}`;
  const registryState: PublicClaimRegistryState = {
    publicClaimRegistry: state.publicClaimRegistry,
    nullifierRecords: state.nullifierRecords,
    claimReceipts: state.claimReceipts,
  };
  const registration = registerClaimInRegistry(registryState, {
    claimId,
    bounty,
    proof: publicProof,
    createdAt: timestamp,
  });

  const claim: BugClaim = {
    id: claimId,
    bountyId,
    reporterId: actor.id,
    claimHash: publicProof.claimHash,
    witnessCommitment: publicProof.witnessCommitment,
    nullifier: publicProof.nullifier,
    reporterCommitment: publicProof.reporterCommitment,
    receiptId: publicProof.receiptId,
    registryKey: publicProof.registryKey,
    bugType: publicProof.bugType,
    ruleName: publicProof.ruleName,
    affectedModule: publicProof.affectedModule,
    impact: publicProof.impact,
    severity: publicProof.severity,
    proofStatus: "Verified",
    disclosureStatus: "NotRequested",
    payoutStatus: "Unfunded",
    exploitDetailsVisible: false,
    claimReceiptId: publicProof.receiptId,
    verification: publicProof.verification,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  assertNoPrivateFields(registration.receipt);

  return {
    ...state,
    claims: [claim, ...state.claims],
    claimReceipts: registration.registry.claimReceipts,
    publicClaimRegistry: registration.registry.publicClaimRegistry,
    nullifierRecords: registration.registry.nullifierRecords,
  };
}

export function registerVerifiedClaim(
  state: DemoState,
  bounty: Bounty,
  claimId: string,
  proof: ProofResult,
  createdAt = now(),
) {
  return registerClaimInRegistry(
    {
      publicClaimRegistry: state.publicClaimRegistry,
      nullifierRecords: state.nullifierRecords,
      claimReceipts: state.claimReceipts,
    },
    {
      claimId,
      bounty,
      proof: sanitizeProofResult(proof),
      createdAt,
    },
  );
}

export function getClaimReceipt(state: DemoState, receiptId: string): ClaimReceipt | undefined {
  return getReceiptById(
    {
      publicClaimRegistry: state.publicClaimRegistry,
      nullifierRecords: state.nullifierRecords,
      claimReceipts: state.claimReceipts,
    },
    receiptId,
  );
}

export function isNullifierUsed(state: DemoState, nullifier: string): boolean {
  return registryHasNullifier(
    {
      publicClaimRegistry: state.publicClaimRegistry,
      nullifierRecords: state.nullifierRecords,
      claimReceipts: state.claimReceipts,
    },
    nullifier,
  );
}

export function getPublicRegistryEntry(
  state: DemoState,
  registryKey: string,
): PublicClaimRegistryEntry | undefined {
  return getClaimByRegistryKey(
    {
      publicClaimRegistry: state.publicClaimRegistry,
      nullifierRecords: state.nullifierRecords,
      claimReceipts: state.claimReceipts,
    },
    registryKey,
  );
}

export function listPublicRegistryEntries(state: DemoState): PublicClaimRegistryEntry[] {
  return listPublicClaims({
    publicClaimRegistry: state.publicClaimRegistry,
    nullifierRecords: state.nullifierRecords,
    claimReceipts: state.claimReceipts,
  });
}

function applyTriageAction(
  state: DemoState,
  actor: CurrentActor,
  claimId: string,
  actionType: ActionType,
  publicNote: string,
): DemoState {
  const claim = findClaim(state, claimId);
  const updated = applyClaimAction(claim, actionType);
  return addAction(replaceClaim(state, updated), publicAction(claimId, actor, actionType, publicNote));
}

export function lockReward(state: DemoState, actor: CurrentActor, claimId: string, publicNote = ""): DemoState {
  const claim = findClaim(state, claimId);
  const bounty = findBounty(state, claim.bountyId);
  if (!canLockReward(actor, bounty, claim)) {
    throw new Error("Actor cannot lock reward for this claim");
  }
  return applyTriageAction(state, actor, claimId, "RewardLocked", publicNote || "Reward lock demo state recorded.");
}

export function requestEncryptedDetails(
  state: DemoState,
  actor: CurrentActor,
  claimId: string,
  publicNote = "",
): DemoState {
  const claim = findClaim(state, claimId);
  const bounty = findBounty(state, claim.bountyId);
  if (!canRequestEncryptedDetails(actor, bounty, claim)) {
    throw new Error("Actor cannot request encrypted details for this claim");
  }
  return applyTriageAction(
    state,
    actor,
    claimId,
    "DetailsRequested",
    publicNote || "Encrypted disclosure details requested.",
  );
}

export function shareEncryptedDetails(
  state: DemoState,
  actor: CurrentActor,
  claimId: string,
  attestation: DisclosureShareAttestation,
): DemoState {
  const claim = findClaim(state, claimId);
  if (!canShareEncryptedDetails(actor, claim)) {
    throw new Error("Actor cannot share encrypted details for this claim");
  }
  if (!/^0x[0-9a-f]{64}$/.test(attestation.packageHash)) {
    throw new Error("Encrypted disclosure package hash is invalid");
  }
  if (!/^0x[0-9a-f]{64}$/.test(attestation.recipientKeyId)) {
    throw new Error("Encrypted disclosure recipient key ID is invalid");
  }
  assertNoPrivateFields(attestation);

  const owner = findBounty(state, claim.bountyId).ownerId;
  const updated = applyClaimAction(claim, "EncryptedDetailsShared");
  const disclosurePackage: DisclosurePackage = {
    id: `disclosure-${Date.now().toString(36)}`,
    claimId,
    packageHash: attestation.packageHash,
    encryptedFor: owner,
    recipientKeyId: attestation.recipientKeyId,
    sharedBy: actor.id,
    sharedAt: now(),
    status: "Shared",
    packageVersion: "zkbb-disclosure-package-v1",
    encryptionScheme: "ECDH-P256+HKDF-SHA256+A256GCM",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acknowledgedAt: null,
    deliveryStatus: "Attested",
  };

  return addAction(
    {
      ...replaceClaim(state, updated),
      disclosurePackages: [disclosurePackage, ...state.disclosurePackages],
    },
    publicAction(
      claimId,
      actor,
      "EncryptedDetailsShared",
      "Encrypted disclosure package hash and recipient attestation recorded. Payload remains off-store.",
    ),
  );
}

export function markPatched(state: DemoState, actor: CurrentActor, claimId: string, publicNote = ""): DemoState {
  const claim = findClaim(state, claimId);
  const bounty = findBounty(state, claim.bountyId);
  if (!canMarkPatched(actor, bounty, claim)) {
    throw new Error("Actor cannot mark this claim patched");
  }
  return applyTriageAction(state, actor, claimId, "Patched", publicNote || "Patch confirmed.");
}

export function releaseBounty(state: DemoState, actor: CurrentActor, claimId: string, publicNote = ""): DemoState {
  const claim = findClaim(state, claimId);
  const bounty = findBounty(state, claim.bountyId);
  if (!canReleaseBounty(actor, bounty, claim)) {
    throw new Error("Actor cannot release bounty for this claim");
  }
  return applyTriageAction(state, actor, claimId, "Paid", publicNote || "Payout demo state recorded; no on-chain transfer was submitted.");
}

export function rejectClaim(state: DemoState, actor: CurrentActor, claimId: string, publicNote = ""): DemoState {
  const claim = findClaim(state, claimId);
  const bounty = findBounty(state, claim.bountyId);
  if (!canRejectClaim(actor, bounty, claim)) {
    throw new Error("Actor cannot reject this claim");
  }
  return applyTriageAction(state, actor, claimId, "Rejected", publicNote || "Claim rejected.");
}

export function addTriageNote(state: DemoState, actor: CurrentActor, claimId: string, publicNote: string): DemoState {
  const claim = findClaim(state, claimId);
  if (!canAddTriageNote(actor, claim)) {
    throw new Error("Actor cannot add public note");
  }
  return addAction(state, publicAction(claimId, actor, "PublicNoteAdded", publicNote));
}

export function createPublicClaimFromProof(
  state: DemoState,
  proof: Pick<ProofResult, "verified" | "claimHash" | "severity" | "bugType"> & {
    bountyId: string;
    witnessCommitment?: string;
    nullifier?: string;
    reporterCommitment?: string;
    receiptId?: string;
    registryKey?: string;
    proofStatus?: ProofResult["proofStatus"];
    scopeHash?: string;
    ruleId?: string;
    ruleName?: string;
    affectedModule?: string;
    impact?: number;
    claimReceiptId?: string;
    proofEngine?: string;
    verification?: ProofResult["verification"];
  },
): BugClaim {
  if (!proof.verified) {
    throw new Error("Only verified proofs can create public claims");
  }
  const bounty = findBounty(state, proof.bountyId);
  const timestamp = now();
  return {
    id: `claim-${Date.now().toString(36)}-${state.claims.length + 1}`,
    bountyId: proof.bountyId,
    reporterId: "whitehat-demo",
    claimHash: proof.claimHash,
    witnessCommitment: proof.witnessCommitment ?? prefixedHash("wcommit", proof.claimHash),
    nullifier: proof.nullifier ?? prefixedHash("nullifier", `${proof.bountyId}:${proof.claimHash}`),
    reporterCommitment: proof.reporterCommitment ?? prefixedHash("reporter", proof.claimHash),
    receiptId: proof.receiptId ?? proof.claimReceiptId ?? prefixedHash("receipt", `${proof.claimHash}:${bounty.id}`),
    registryKey: proof.registryKey ?? prefixedHash("registry", `${proof.bountyId}:${proof.claimHash}`),
    bugType: proof.bugType,
    ruleName: proof.ruleName ?? bounty.ruleName,
    affectedModule: proof.affectedModule ?? bounty.affectedModule,
    impact: proof.impact ?? 0,
    severity: proof.severity,
    proofStatus: proof.proofStatus ?? "Verified",
    disclosureStatus: "NotRequested",
    payoutStatus: "Unfunded",
    exploitDetailsVisible: false,
    claimReceiptId: proof.receiptId ?? proof.claimReceiptId ?? prefixedHash("receipt", `${proof.claimHash}:${bounty.id}`),
    verification: proof.verification,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function transitionClaim(claim: BugClaim, actionType: ActionType): BugClaim {
  return applyClaimAction(claim, actionType);
}

export function upsertBounty(state: DemoState, bounty: Bounty): DemoState {
  return {
    ...state,
    bounties: [bounty, ...state.bounties],
  };
}

export function upsertClaim(state: DemoState, claim: BugClaim): DemoState {
  return {
    ...state,
    claims: [claim, ...state.claims],
  };
}

export { replaceClaim };
