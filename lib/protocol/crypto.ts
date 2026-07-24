import { stableHash } from "../hash.ts";
import type { ProtocolVersion, Severity } from "../models.ts";

export const DEFAULT_PROTOCOL_VERSION: ProtocolVersion = {
  version: "zkbb-protocol-v1",
  proofSystem: "local-proof-engine",
  commitmentScheme: "commitment-v1",
  nullifierScheme: "bounty-rule-reporter-v1",
};

function protocolHash(parts: Array<string | number | boolean | undefined>) {
  return `0x${stableHash(parts.map((part) => String(part ?? "")).join("|"))}`;
}

export type ProtocolCryptoProvider = {
  name: string;
  hashScheme: string;
  witnessCommitment(input: { ruleId: string; scopeHash: string; witnessSummary: string }): string;
  nullifier(input: { bountyId: string; ruleId: string; reporterSecret: string }): string;
  reporterCommitment(input: { reporterSecret: string }): string;
};

export const deterministicProtocolCryptoProvider: ProtocolCryptoProvider = {
  name: "Deterministic Demo Crypto",
  hashScheme: "stable-hash-demo-v1",
  witnessCommitment(input) {
    return protocolHash(["wcommit", input.ruleId, input.scopeHash, stableHash(input.witnessSummary)]);
  },
  nullifier(input) {
    return protocolHash(["nullifier", input.bountyId, input.ruleId, stableHash(input.reporterSecret)]);
  },
  reporterCommitment(input) {
    return protocolHash(["reporter", stableHash(input.reporterSecret)]);
  },
};

export function createWitnessCommitment(input: {
  ruleId: string;
  scopeHash: string;
  witnessSummary: string;
}) {
  return deterministicProtocolCryptoProvider.witnessCommitment(input);
}

export function createNullifier(input: {
  bountyId: string;
  ruleId: string;
  reporterSecret: string;
}) {
  return deterministicProtocolCryptoProvider.nullifier(input);
}

export function createReporterCommitment(input: { reporterSecret: string }) {
  return deterministicProtocolCryptoProvider.reporterCommitment(input);
}

export function createClaimHash(input: {
  bountyId: string;
  ruleId: string;
  scopeHash: string;
  bugType: string;
  severity: Severity;
  witnessCommitment: string;
  nullifier: string;
  timestamp: string;
}) {
  return protocolHash([
    "claim",
    input.bountyId,
    input.ruleId,
    input.scopeHash,
    input.bugType,
    input.severity,
    input.witnessCommitment,
    input.nullifier,
    input.timestamp,
  ]);
}

export function createReceiptId(input: {
  claimHash: string;
  bountyId: string;
  proofEngine: string;
  verifiedAt: string;
}) {
  return protocolHash(["receipt", input.claimHash, input.bountyId, input.proofEngine, input.verifiedAt]);
}

export function createRegistryKey(input: { bountyId: string; claimHash: string }) {
  return protocolHash(["registry", input.bountyId, input.claimHash]);
}
