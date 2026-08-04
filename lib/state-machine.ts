import type { ActionType, BugClaim, ProofStatus, Role } from "./models.ts";

export type ClaimWorkflowGuidance = {
  currentStage: string;
  nextAction: ActionType | null;
  requiredRole: Role | null;
  blockedReason: string | null;
  terminal: boolean;
};

export function getClaimWorkflowGuidance(claim: BugClaim): ClaimWorkflowGuidance {
  if (claim.proofStatus !== "Verified") {
    return {
      currentStage: claim.proofStatus,
      nextAction: null,
      requiredRole: null,
      blockedReason: "Only verified claims can enter responsible disclosure.",
      terminal: true,
    };
  }
  if (claim.payoutStatus === "Paid" || claim.payoutStatus === "Rejected") {
    return {
      currentStage: claim.payoutStatus,
      nextAction: null,
      requiredRole: null,
      blockedReason: `${claim.payoutStatus} claims are final.`,
      terminal: true,
    };
  }
  if (claim.payoutStatus === "Unfunded") {
    return { currentStage: "Verified", nextAction: "RewardLocked", requiredRole: "ProjectOwner", blockedReason: null, terminal: false };
  }
  if (claim.disclosureStatus === "NotRequested") {
    return { currentStage: "RewardLocked", nextAction: "DetailsRequested", requiredRole: "ProjectOwner", blockedReason: null, terminal: false };
  }
  if (claim.disclosureStatus === "Requested") {
    return { currentStage: "DetailsRequested", nextAction: "EncryptedDetailsShared", requiredRole: "Whitehat", blockedReason: null, terminal: false };
  }
  if (claim.disclosureStatus === "EncryptedDetailsShared") {
    return { currentStage: "EncryptedDetailsShared", nextAction: "Patched", requiredRole: "ProjectOwner", blockedReason: null, terminal: false };
  }
  return { currentStage: "Patched", nextAction: "Paid", requiredRole: "ProjectOwner", blockedReason: null, terminal: false };
}

function assertMutable(claim: BugClaim) {
  if (claim.payoutStatus === "Paid") {
    throw new Error("Paid claims are final and cannot be modified");
  }
  if (claim.payoutStatus === "Rejected") {
    throw new Error("Rejected claims cannot be paid");
  }
}

function withUpdatedAt(claim: BugClaim): BugClaim {
  return {
    ...claim,
    updatedAt: new Date().toISOString(),
  };
}

export function applyClaimAction(claim: BugClaim, actionType: ActionType): BugClaim {
  if (actionType === "PublicNoteAdded") {
    assertMutable(claim);
    return withUpdatedAt(claim);
  }

  if (actionType === "Rejected") {
    if (claim.payoutStatus === "Paid") {
      throw new Error("Paid claims are final and cannot be rejected");
    }
    if (claim.payoutStatus === "Rejected") {
      throw new Error("Rejected claims cannot be modified");
    }
    if (claim.proofStatus !== "Verified") {
      throw new Error("Only a claim with verified proof can enter triage payout flow");
    }
    if (claim.payoutStatus !== "RewardLocked") {
      throw new Error("Claim can only be rejected after reward is locked");
    }
    return withUpdatedAt({ ...claim, payoutStatus: "Rejected" });
  }

  assertMutable(claim);

  if (claim.proofStatus !== "Verified") {
    throw new Error("Only a claim with verified proof can enter triage payout flow");
  }

  switch (actionType) {
    case "RewardLocked":
      if (claim.payoutStatus !== "Unfunded") {
        throw new Error("Reward can only be locked from Unfunded payout state");
      }
      return withUpdatedAt({ ...claim, payoutStatus: "RewardLocked" });
    case "DetailsRequested":
      if (claim.payoutStatus !== "RewardLocked") {
        throw new Error("Encrypted details can only be requested after reward is locked");
      }
      if (claim.disclosureStatus !== "NotRequested") {
        throw new Error("Encrypted details were already requested");
      }
      return withUpdatedAt({ ...claim, disclosureStatus: "Requested" });
    case "EncryptedDetailsShared":
      if (claim.disclosureStatus !== "Requested") {
        throw new Error("Encrypted details can only be shared after they are requested");
      }
      return withUpdatedAt({ ...claim, disclosureStatus: "EncryptedDetailsShared" });
    case "Patched":
      if (claim.disclosureStatus !== "EncryptedDetailsShared") {
        throw new Error("Claim can only be marked patched after encrypted details are shared");
      }
      return withUpdatedAt({ ...claim, disclosureStatus: "Patched" });
    case "Paid":
      if (claim.disclosureStatus !== "Patched" || claim.payoutStatus !== "RewardLocked") {
        throw new Error("Bounty can only be released after patching while reward is locked");
      }
      return withUpdatedAt({ ...claim, payoutStatus: "Paid" });
    default:
      throw new Error(`Unsupported action ${actionType}`);
  }
}

export function transitionProofStatus(current: ProofStatus, next: ProofStatus): ProofStatus {
  if (current !== "Pending") {
    throw new Error("Proof status is final and cannot be modified");
  }
  if (next === "Verified" || next === "Invalid") {
    return next;
  }
  throw new Error(`Unsupported proof transition ${current} -> ${next}`);
}
