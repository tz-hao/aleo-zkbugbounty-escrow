import { DEMO_VAULT_RULES } from "./demo-vault.ts";
import { prefixedHash } from "./hash.ts";
import {
  createClaimHash,
  createReceiptId,
  createRegistryKey,
  DEFAULT_PROTOCOL_VERSION,
} from "./protocol/crypto.ts";
import type {
  Bounty,
  BugClaim,
  ClaimReceipt,
  NullifierRecord,
  PublicClaimRegistryEntry,
  TriageAction,
} from "./models.ts";

const createdAt = "2026-07-01T09:00:00.000Z";
const demoRuleId = DEMO_VAULT_RULES[0].id;
const demoScopeHash = prefixedHash("scope", "Vault accounting logic");
const demoWitnessCommitment = "0x8d3a845e91df42c0";
const demoNullifier = "0x59a1bb921328ab3c";
const demoReporterCommitment = "0xe9649aa4a2310c17";
const demoImpact = 100;
const demoProtocolVersion = {
  ...DEFAULT_PROTOCOL_VERSION,
  proofSystem: "mock-invariant",
};
const demoVerification = {
  level: "Simulation" as const,
  network: "local" as const,
  programId: "mock-vault-engine",
};
const demoClaimHash = createClaimHash({
  bountyId: "bounty-001",
  ruleId: demoRuleId,
  scopeHash: demoScopeHash,
  bugType: "Vault accounting invariant breach",
  severity: "Critical",
  witnessCommitment: demoWitnessCommitment,
  nullifier: demoNullifier,
  timestamp: "2026-07-01T09:18:00.000Z",
});
const demoReceiptId = createReceiptId({
  claimHash: demoClaimHash,
  bountyId: "bounty-001",
  proofEngine: "Mock Invariant Engine",
  verifiedAt: "2026-07-01T09:18:00.000Z",
});
const demoRegistryKey = createRegistryKey({
  bountyId: "bounty-001",
  claimHash: demoClaimHash,
});

export const demoBounties: Bounty[] = [
  {
    id: "bounty-001",
    projectName: "Demo Vault",
    scope: "Vault accounting logic",
    scopeHash: demoScopeHash,
    ruleId: demoRuleId,
    ruleName: DEMO_VAULT_RULES[0].name,
    ruleText: DEMO_VAULT_RULES[0].invariantText,
    affectedModule: DEMO_VAULT_RULES[0].affectedModule,
    bountyAmount: 100,
    rewards: {
      critical: 100,
      high: 50,
      medium: 20,
      low: 5,
    },
    disclosureDeadline: "7 days after verified claim",
    ownerId: "owner-demo",
    status: "Active",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "bounty-002",
    projectName: "ZK Bridge Relay",
    scope: "Bridge claim settlement logic",
    scopeHash: prefixedHash("scope", "Bridge claim settlement logic"),
    ruleId: DEMO_VAULT_RULES[1].id,
    ruleName: DEMO_VAULT_RULES[1].name,
    ruleText: DEMO_VAULT_RULES[1].invariantText,
    affectedModule: DEMO_VAULT_RULES[1].affectedModule,
    bountyAmount: 75,
    rewards: {
      critical: 75,
      high: 40,
      medium: 15,
      low: 3,
    },
    disclosureDeadline: "10 days after verified claim",
    ownerId: "owner-demo",
    status: "Active",
    createdAt: "2026-07-01T09:10:00.000Z",
    updatedAt: "2026-07-01T09:10:00.000Z",
  },
];

export const demoClaimReceipts: ClaimReceipt[] = [
  {
    id: demoReceiptId,
    receiptId: demoReceiptId,
    claimHash: demoClaimHash,
    bountyId: "bounty-001",
    projectId: "owner-demo",
    ruleId: demoRuleId,
    ruleName: DEMO_VAULT_RULES[0].name,
    affectedModule: DEMO_VAULT_RULES[0].affectedModule,
    scopeHash: demoScopeHash,
    impact: demoImpact,
    severity: "Critical",
    bugType: "Vault accounting invariant breach",
    proofEngine: "Mock Invariant Engine",
    proofStatus: "Verified",
    witnessCommitment: demoWitnessCommitment,
    nullifier: demoNullifier,
    reporterCommitment: demoReporterCommitment,
    createdAt: "2026-07-01T09:18:00.000Z",
    verifiedAt: "2026-07-01T09:18:00.000Z",
    protocolVersion: demoProtocolVersion,
    verification: demoVerification,
  },
];

export const demoClaims: BugClaim[] = [
  {
    id: "claim-001",
    bountyId: "bounty-001",
    reporterId: "whitehat-demo",
    claimHash: demoClaimHash,
    witnessCommitment: demoWitnessCommitment,
    nullifier: demoNullifier,
    reporterCommitment: demoReporterCommitment,
    receiptId: demoReceiptId,
    registryKey: demoRegistryKey,
    bugType: "Vault accounting invariant breach",
    ruleName: DEMO_VAULT_RULES[0].name,
    affectedModule: "Vault accounting logic",
    impact: demoImpact,
    severity: "Critical",
    proofStatus: "Verified",
    disclosureStatus: "NotRequested",
    payoutStatus: "Unfunded",
    exploitDetailsVisible: false,
    claimReceiptId: demoReceiptId,
    verification: demoVerification,
    createdAt: "2026-07-01T09:18:00.000Z",
    updatedAt: "2026-07-01T09:18:00.000Z",
  },
];

export const demoPublicClaimRegistry: PublicClaimRegistryEntry[] = [
  {
    registryKey: demoRegistryKey,
    claimId: "claim-001",
    claimHash: demoClaimHash,
    receiptId: demoReceiptId,
    bountyId: "bounty-001",
    projectId: "owner-demo",
    ruleId: demoRuleId,
    ruleName: DEMO_VAULT_RULES[0].name,
    affectedModule: DEMO_VAULT_RULES[0].affectedModule,
    impact: demoImpact,
    severity: "Critical",
    bugType: "Vault accounting invariant breach",
    proofStatus: "Verified",
    disclosureStatus: "NotRequested",
    payoutStatus: "Unfunded",
    proofEngine: "Mock Invariant Engine",
    witnessCommitment: demoWitnessCommitment,
    nullifier: demoNullifier,
    createdAt: "2026-07-01T09:18:00.000Z",
    updatedAt: "2026-07-01T09:18:00.000Z",
    verification: demoVerification,
  },
];

export const demoNullifierRecords: NullifierRecord[] = [
  {
    nullifier: demoNullifier,
    bountyId: "bounty-001",
    ruleId: demoRuleId,
    reporterCommitment: demoReporterCommitment,
    usedAt: "2026-07-01T09:18:00.000Z",
    claimId: "claim-001",
  },
];

export const demoTriageActions: TriageAction[] = [
  {
    id: "action-001",
    claimId: "claim-001",
    actorId: "arbiter-demo",
    actorRole: "TriageArbiter",
    actionType: "PublicNoteAdded",
    publicNote: "Verified Claim Receipt 已生成，可供 Project Owner 进行公开元数据审查。",
    createdAt: "2026-07-01T09:22:00.000Z",
  },
];
