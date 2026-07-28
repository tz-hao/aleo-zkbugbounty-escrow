export type Role = "ProjectOwner" | "Whitehat" | "TriageArbiter" | "PublicUser";

export type CurrentActor = {
  id: string;
  role: Role;
  displayName: string;
};

export type Severity = "Low" | "Medium" | "High" | "Critical";

export type BountyStatus = "Draft" | "Active" | "Paused" | "Closed";

export type DemoVaultRuleId =
  | "vault-accounting-safety"
  | "claims-vs-deposits"
  | "reward-reserve-safety"
  | "withdraw-limit-safety";

export type ProofStatus = "Pending" | "Verified" | "Invalid";

export type DisclosureStatus =
  | "NotRequested"
  | "Requested"
  | "EncryptedDetailsShared"
  | "Patched";

export type PayoutStatus = "Unfunded" | "RewardLocked" | "Paid" | "Rejected";

export type ActionType =
  | "RewardLocked"
  | "DetailsRequested"
  | "EncryptedDetailsShared"
  | "Patched"
  | "Paid"
  | "Rejected"
  | "PublicNoteAdded";

export type TriageAction = {
  id: string;
  claimId: string;
  actorId: string;
  actorRole: Role;
  actionType: ActionType;
  publicNote: string;
  createdAt: string;
};

export type BountyRewards = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type Bounty = {
  id: string;
  projectName: string;
  scope: string;
  scopeHash: string;
  ruleId: DemoVaultRuleId;
  ruleName: string;
  ruleText: string;
  affectedModule: string;
  bountyAmount: number;
  rewards: BountyRewards;
  disclosureDeadline: string;
  ownerId: string;
  status: BountyStatus;
  createdAt: string;
  updatedAt: string;
};

export type OnChainBountyStatus = "Active" | "Paused" | "Closed";

export type OnChainBountyState = {
  bountyId: string;
  owner: string;
  scopeHash: string;
  ruleId: DemoVaultRuleId;
  rewards: {
    critical: string;
    high: string;
    medium: string;
    low: string;
  };
  disclosureDeadline: number;
  status: OnChainBountyStatus;
  source: "AleoTestnet";
  network: "testnet";
  programId: string;
  mapping: "bounties";
};

export type OnChainNullifierState = {
  nullifier: string;
  bountyId: string;
  used: true;
  source: "AleoTestnet";
  network: "testnet";
  programId: string;
  mapping: "nullifiers";
};

export type OnChainClaimReceipt = {
  claimHash: string;
  bountyId: string;
  ruleId: DemoVaultRuleId;
  scopeHash: string;
  severity: Exclude<Severity, "Low">;
  witnessCommitment: string;
  nullifier: string;
  reporterCommitment: string;
  proofStatus: "Verified";
  createdHeight: number;
  protocolVersion: number;
  source: "AleoTestnet";
  network: "testnet";
  programId: string;
  mapping: "claim_receipts";
};

export type OnChainBountyEscrowState = {
  bountyId: string;
  owner: string;
  totalFunded: string;
  availableBalance: string;
  lockedAmount: string;
  paidAmount: string;
  refundedAmount: string;
  status: "Funded" | "Refunded";
  lastFundingHeight: number;
  lastFundingMarker: string | null;
  lastRefundMarker: string | null;
  source: "AleoTestnet";
  network: "testnet";
  programId: string;
  mapping: "bounty_escrows";
};

export type OnChainClaimPayoutState = {
  claimHash: string;
  bountyId: string;
  whitehatAddress: string;
  rewardAmount: string;
  status: "RewardLocked" | "Paid" | "Rejected";
  lockedHeight: number;
  paidHeight: number | null;
  releaseMarker: string | null;
  source: "AleoTestnet";
  network: "testnet";
  programId: string;
  mapping: "claim_payouts";
};

export type OnChainClaimTriageState = {
  claimHash: string;
  bountyId: string;
  status:
    | "RewardLocked"
    | "DetailsRequested"
    | "EncryptedDetailsShared"
    | "Patched"
    | "Paid"
    | "Rejected";
  packageHash: string | null;
  updatedHeight: number;
  source: "AleoTestnet";
  network: "testnet";
  programId: string;
  mapping: "claim_triage_states";
};

export type ProtocolVersion = {
  version: string;
  proofSystem: string;
  commitmentScheme: string;
  nullifierScheme: string;
};

export type ProofVerification = {
  level: "Simulation" | "LocalExecution" | "RemoteExecution" | "NetworkConfirmed" | "Unavailable";
  network: "local" | "testnet" | "mainnet" | "unavailable";
  programId: string;
  transactionId?: string;
};

export type ProofResult = {
  verified: boolean;
  claimHash: string;
  witnessCommitment: string;
  nullifier: string;
  reporterCommitment: string;
  receiptId: string;
  registryKey: string;
  bugType: string;
  severity: Severity;
  proofStatus: ProofStatus;
  scopeHash: string;
  ruleId: string;
  ruleName: string;
  affectedModule: string;
  proofEngine: string;
  protocolVersion: ProtocolVersion;
  verification?: ProofVerification;
  impact: number;
  claimReceiptId?: string;
  reason?: string;
};

export type BugClaim = {
  id: string;
  bountyId: string;
  reporterId: string;
  claimHash: string;
  witnessCommitment: string;
  nullifier: string;
  reporterCommitment: string;
  receiptId: string;
  registryKey: string;
  bugType: string;
  ruleName: string;
  affectedModule: string;
  impact: number;
  severity: Severity;
  proofStatus: ProofStatus;
  disclosureStatus: DisclosureStatus;
  payoutStatus: PayoutStatus;
  exploitDetailsVisible: false;
  claimReceiptId: string;
  verification?: ProofVerification;
  createdAt: string;
  updatedAt: string;
};

export type ClaimReceipt = {
  id: string;
  receiptId: string;
  claimHash: string;
  bountyId: string;
  projectId: string;
  ruleId: string;
  ruleName: string;
  affectedModule: string;
  scopeHash: string;
  impact: number;
  severity: Severity;
  bugType: string;
  proofEngine: string;
  proofStatus: ProofStatus;
  witnessCommitment: string;
  nullifier: string;
  reporterCommitment: string;
  createdAt: string;
  verifiedAt: string;
  protocolVersion: ProtocolVersion;
  verification?: ProofVerification;
};

export type WitnessCommitment = {
  commitment: string;
  scheme: string;
  ruleId: string;
  scopeHash: string;
  createdAt: string;
};

export type NullifierRecord = {
  nullifier: string;
  bountyId: string;
  ruleId: string;
  reporterCommitment: string;
  usedAt: string;
  claimId: string;
};

export type PublicClaimRegistryEntry = {
  registryKey: string;
  claimId: string;
  claimHash: string;
  receiptId: string;
  bountyId: string;
  projectId: string;
  ruleId: string;
  ruleName: string;
  affectedModule: string;
  impact: number;
  severity: Severity;
  bugType: string;
  proofStatus: ProofStatus;
  disclosureStatus: DisclosureStatus;
  payoutStatus: PayoutStatus;
  proofEngine: string;
  witnessCommitment: string;
  nullifier: string;
  createdAt: string;
  updatedAt: string;
  verification?: ProofVerification;
};

export type DisclosurePackage = {
  id: string;
  claimId: string;
  packageHash: string;
  encryptedFor: string;
  recipientKeyId: string;
  sharedBy: string;
  sharedAt: string;
  status: "Shared";
  packageVersion: "zkbb-disclosure-package-v1";
  encryptionScheme: "ECDH-P256+HKDF-SHA256+A256GCM";
  expiresAt: string;
  acknowledgedAt: string | null;
  deliveryStatus: "Attested" | "Acknowledged" | "Expired";
};

export type DemoState = {
  actors: CurrentActor[];
  currentActor: CurrentActor;
  bounties: Bounty[];
  claims: BugClaim[];
  claimReceipts: ClaimReceipt[];
  publicClaimRegistry: PublicClaimRegistryEntry[];
  nullifierRecords: NullifierRecord[];
  disclosurePackages: DisclosurePackage[];
  triageActions: TriageAction[];
};
