import type { Bounty, BugClaim, CurrentActor } from "./models.ts";

function ownsBounty(actor: CurrentActor, bounty: Bounty) {
  return actor.role === "ProjectOwner" && bounty.ownerId === actor.id;
}

export function canCreateBounty(actor: CurrentActor) {
  return actor.role === "ProjectOwner";
}

export function canSubmitProof(actor: CurrentActor) {
  return actor.role === "Whitehat";
}

export function canViewTriage(actor: CurrentActor) {
  return actor.role === "ProjectOwner" || actor.role === "TriageArbiter" || actor.role === "Whitehat";
}

export function canViewPublicClaims(actor: CurrentActor) {
  void actor;
  return true;
}

export function canLockReward(actor: CurrentActor, bounty: Bounty, claim: BugClaim) {
  return ownsBounty(actor, bounty) && claim.proofStatus === "Verified" && claim.payoutStatus === "Unfunded";
}

export function canRequestEncryptedDetails(actor: CurrentActor, bounty: Bounty, claim: BugClaim) {
  return (
    ownsBounty(actor, bounty) &&
    claim.payoutStatus === "RewardLocked" &&
    claim.disclosureStatus === "NotRequested"
  );
}

export function canShareEncryptedDetails(actor: CurrentActor, claim: BugClaim) {
  return (
    actor.role === "Whitehat" &&
    actor.id === claim.reporterId &&
    claim.disclosureStatus === "Requested" &&
    claim.payoutStatus !== "Paid" &&
    claim.payoutStatus !== "Rejected"
  );
}

export function canMarkPatched(actor: CurrentActor, bounty: Bounty, claim: BugClaim) {
  return (
    ownsBounty(actor, bounty) &&
    claim.proofStatus === "Verified" &&
    claim.payoutStatus === "RewardLocked" &&
    claim.disclosureStatus === "EncryptedDetailsShared"
  );
}

export function canReleaseBounty(actor: CurrentActor, bounty: Bounty, claim: BugClaim) {
  return ownsBounty(actor, bounty) && claim.disclosureStatus === "Patched" && claim.payoutStatus === "RewardLocked";
}

export function canRejectClaim(actor: CurrentActor, bounty: Bounty, claim: BugClaim) {
  return ownsBounty(actor, bounty) && claim.proofStatus === "Verified" && claim.payoutStatus === "RewardLocked";
}

export function canAddTriageNote(actor: CurrentActor, claim: BugClaim) {
  return (
    (actor.role === "ProjectOwner" || actor.role === "TriageArbiter") &&
    claim.payoutStatus !== "Paid" &&
    claim.payoutStatus !== "Rejected"
  );
}

export function canViewPrivateWitness(actor: CurrentActor) {
  void actor;
  return false;
}
