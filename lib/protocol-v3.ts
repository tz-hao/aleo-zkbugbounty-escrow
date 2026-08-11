import type { OnChainClaimReceipt, Severity } from "./models.ts";

/**
 * Protocol V3 makes the limits of a public ZK receipt explicit. A receipt is
 * a prerequisite for review and an escrow reservation, never a final finding
 * that a target system is vulnerable or repaired.
 */
export const PROTOCOL_V3_VERSION = 3 as const;

export const CLAIM_V3_STATES = [
  "Submitted",
  "OwnerReviewing",
  "Accepted",
  "RewardLocked",
  "DisclosureDelivered",
  "DisclosureAcknowledged",
  "ReproductionConfirmed",
  "ReproductionRejected",
  "PatchProposed",
  "PatchAccepted",
  "Disputed",
  "Paid",
  "OwnerRejected",
  "Rejected",
] as const;

export type ClaimV3State = (typeof CLAIM_V3_STATES)[number];

export type ProtocolV3Actor = "ProjectOwner" | "Whitehat" | "PanelMember" | "Public";

export type ClaimV3Action =
  | "BeginReview"
  | "AcceptClaim"
  | "LockReward"
  | "DeliverDisclosure"
  | "AcknowledgeDisclosure"
  | "ConfirmReproduction"
  | "RejectReproduction"
  | "ProposePatch"
  | "AcceptPatch"
  | "ReleaseReward"
  | "RejectClaim"
  | "OpenDispute"
  | "EscalateTimeout"
  | "FinalizeAcceptedDispute"
  | "FinalizeRejectedDispute";

export type ArbitrationVerdict = "Reject" | "Medium" | "High" | "Critical";

export type ArbitrationPanel = {
  /** Public, immutable Bounty-level identifier. */
  panelId: string;
  /** A V3 panel intentionally starts with an auditable 2-of-3 or 3-of-3 policy. */
  members: readonly [string, string, string];
  quorum: 2 | 3;
  reviewWindowBlocks: number;
  decisionWindowBlocks: number;
  arbitrationFeeMicrocredits: string;
};

export type BountyV3Policy = {
  protocolVersion: typeof PROTOCOL_V3_VERSION;
  /** Fingerprint of the Owner's dedicated disclosure public key; never a private key. */
  disclosureKeyCommitment: string;
  /** Commits every Claim to the target named by the Bounty. */
  targetSystemCommitment: string;
  /** Freezes the reviewed code/version boundary for this Bounty. */
  targetCodeHash: string;
  panel: ArbitrationPanel;
  /** A valid report can be paid after confirmation, or after a mutually accepted patch. */
  paymentCondition: "OnReproduction" | "OnPatchAcceptance";
};

export type PublicReceiptAssessment = {
  eligibleForOwnerReview: boolean;
  eligibleForRewardLock: boolean;
  recommendedSeverity: Exclude<Severity, "Low"> | null;
  verifiedFacts: readonly string[];
  unresolvedFacts: readonly string[];
};

const ownerActions = new Set<ClaimV3Action>([
  "BeginReview",
  "AcceptClaim",
  "LockReward",
  "AcknowledgeDisclosure",
  "ConfirmReproduction",
  "RejectReproduction",
  "ProposePatch",
  "RejectClaim",
]);

const whitehatActions = new Set<ClaimV3Action>([
  "DeliverDisclosure",
  "AcceptPatch",
]);

function isPositiveInteger(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function isAleoAddress(value: string) {
  return /^aleo1[0-9a-z]+$/.test(value);
}

function isFieldCommitment(value: string) {
  return /^[0-9]+field$/.test(value);
}

export function validateArbitrationPanel(panel: ArbitrationPanel) {
  if (!isFieldCommitment(panel.panelId)) {
    throw new Error("Arbitration panel ID must be an Aleo field literal");
  }
  if (new Set(panel.members).size !== panel.members.length || !panel.members.every(isAleoAddress)) {
    throw new Error("Arbitration panel requires three distinct Aleo addresses");
  }
  if (panel.quorum !== 2 && panel.quorum !== 3) {
    throw new Error("Arbitration panel quorum must be two or three");
  }
  if (!isPositiveInteger(panel.reviewWindowBlocks) || !isPositiveInteger(panel.decisionWindowBlocks)) {
    throw new Error("Arbitration review windows must be positive block counts");
  }
  if (!/^[1-9][0-9]*$/.test(panel.arbitrationFeeMicrocredits)) {
    throw new Error("Arbitration fee must be a positive microcredit amount");
  }
  return true;
}

export function validateBountyV3Policy(policy: BountyV3Policy) {
  if (policy.protocolVersion !== PROTOCOL_V3_VERSION) {
    throw new Error("Unsupported protocol policy version");
  }
  if (!isFieldCommitment(policy.disclosureKeyCommitment)) {
    throw new Error("Disclosure key commitment must be an Aleo field literal");
  }
  if (!isFieldCommitment(policy.targetSystemCommitment) || !isFieldCommitment(policy.targetCodeHash)) {
    throw new Error("Target system and code commitments must be Aleo field literals");
  }
  validateArbitrationPanel(policy.panel);
  return true;
}

export function assessPublicReceiptForV3(receipt: OnChainClaimReceipt): PublicReceiptAssessment {
  const verified = receipt.proofStatus === "Verified" && receipt.protocolVersion >= 2;
  return {
    eligibleForOwnerReview: verified,
    eligibleForRewardLock: verified,
    recommendedSeverity: verified ? receipt.severity : null,
    verifiedFacts: verified
      ? [
          "The Claim is bound to this Bounty, Scope Hash, and safety rule.",
          "The submitted private witness satisfies the published proof circuit.",
          "The public Claim Hash and Nullifier have been recorded by Aleo.",
          "The receipt derives a recommended reward tier from the circuit output.",
        ]
      : [],
    unresolvedFacts: [
      "Whether the private witness describes a real target-system vulnerability.",
      "Whether the report is duplicate, in scope, reproducible, or correctly prioritized.",
      "Whether a remediation is complete or safe to release.",
    ],
  };
}

const transitions: Record<ClaimV3State, Partial<Record<ClaimV3Action, ClaimV3State>>> = {
  Submitted: { BeginReview: "OwnerReviewing", EscalateTimeout: "Disputed" },
  OwnerReviewing: {
    AcceptClaim: "Accepted",
    RejectClaim: "OwnerRejected",
    EscalateTimeout: "Disputed",
  },
  Accepted: {
    LockReward: "RewardLocked",
    RejectClaim: "OwnerRejected",
    EscalateTimeout: "Disputed",
  },
  RewardLocked: {
    DeliverDisclosure: "DisclosureDelivered",
    EscalateTimeout: "Disputed",
  },
  DisclosureDelivered: {
    AcknowledgeDisclosure: "DisclosureAcknowledged",
    EscalateTimeout: "Disputed",
  },
  DisclosureAcknowledged: {
    ConfirmReproduction: "ReproductionConfirmed",
    RejectReproduction: "ReproductionRejected",
    EscalateTimeout: "Disputed",
  },
  ReproductionConfirmed: {
    ProposePatch: "PatchProposed",
    ReleaseReward: "Paid",
    EscalateTimeout: "Disputed",
  },
  ReproductionRejected: {
    OpenDispute: "Disputed",
    FinalizeRejectedDispute: "Rejected",
  },
  PatchProposed: {
    AcceptPatch: "PatchAccepted",
    ReleaseReward: "Paid",
    EscalateTimeout: "Disputed",
  },
  PatchAccepted: { ReleaseReward: "Paid" },
  Disputed: {
    FinalizeAcceptedDispute: "RewardLocked",
    FinalizeRejectedDispute: "Rejected",
    ReleaseReward: "Paid",
  },
  Paid: {},
  OwnerRejected: {
    OpenDispute: "Disputed",
    FinalizeRejectedDispute: "Rejected",
  },
  Rejected: {},
};

export function transitionClaimV3(
  current: ClaimV3State,
  action: ClaimV3Action,
  actor: ProtocolV3Actor,
  paymentCondition: BountyV3Policy["paymentCondition"],
) {
  if (ownerActions.has(action) && actor !== "ProjectOwner") {
    throw new Error("Only the Project Owner can perform this review action");
  }
  if (whitehatActions.has(action) && actor !== "Whitehat") {
    throw new Error("Only the Whitehat can perform this disclosure action");
  }
  if (action === "OpenDispute") {
    const directAppeal =
      actor === "Whitehat" &&
      (current === "ReproductionRejected" || current === "OwnerRejected");
    if (!directAppeal) {
      throw new Error("Only the Whitehat can appeal an owner rejection");
    }
  }
  if (action === "EscalateTimeout") {
    const ownerCanEscalate =
      actor === "ProjectOwner" &&
      (current === "RewardLocked" || current === "PatchProposed");
    const whitehatCanEscalate =
      actor === "Whitehat" &&
      (current === "Submitted" ||
       current === "OwnerReviewing" ||
       current === "Accepted" ||
       current === "DisclosureDelivered" ||
       current === "DisclosureAcknowledged" ||
       current === "ReproductionConfirmed");
    if (!ownerCanEscalate && !whitehatCanEscalate) {
      throw new Error("Only the party waiting on the expired SLA can escalate");
    }
  }
  if (
    action === "ReleaseReward" &&
    paymentCondition === "OnPatchAcceptance" &&
    current !== "PatchAccepted" &&
    current !== "Disputed"
  ) {
    throw new Error("This Bounty pays only after the Whitehat accepts the proposed patch");
  }
  if (
    action === "ReleaseReward" &&
    paymentCondition === "OnReproduction" &&
    current !== "ReproductionConfirmed" &&
    current !== "PatchProposed" &&
    current !== "PatchAccepted" &&
    current !== "Disputed"
  ) {
    throw new Error("This Bounty pays only after reproduction is confirmed");
  }
  const next = transitions[current][action];
  if (!next) {
    throw new Error("Unsupported V3 transition: " + current + " -> " + action);
  }
  return next;
}

export function canPanelMemberVote(panel: ArbitrationPanel, address: string) {
  return panel.members.includes(address);
}

export function resolveArbitrationVotes(
  votes: readonly ArbitrationVerdict[],
  panel: ArbitrationPanel,
  maximumSeverity: Exclude<Severity, "Low">,
) {
  validateArbitrationPanel(panel);
  if (votes.length > panel.members.length) throw new Error("An arbitration panel member may vote only once");
  const counts = votes.reduce<Record<ArbitrationVerdict, number>>(
    (result, vote) => ({ ...result, [vote]: result[vote] + 1 }),
    { Reject: 0, Medium: 0, High: 0, Critical: 0 },
  );
  const ordered: ArbitrationVerdict[] = ["Critical", "High", "Medium", "Reject"];
  const verdict = ordered.find((candidate) => counts[candidate] >= panel.quorum) ?? null;
  if (verdict === "Critical" && maximumSeverity !== "Critical") {
    throw new Error("The panel cannot raise a receipt above its circuit-proven maximum severity");
  }
  if (verdict === "High" && maximumSeverity === "Medium") {
    throw new Error("The panel cannot raise a receipt above its circuit-proven maximum severity");
  }
  return { verdict, counts };
}
