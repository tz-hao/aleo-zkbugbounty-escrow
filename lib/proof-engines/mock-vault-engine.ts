import { calculateSeverity, evaluateDemoVaultInvariant, getDemoVaultRule } from "../demo-vault.ts";
import {
  createClaimHash,
  createNullifier,
  createReceiptId,
  createRegistryKey,
  createReporterCommitment,
  createWitnessCommitment,
  DEFAULT_PROTOCOL_VERSION,
} from "../protocol/crypto.ts";
import type { ProofResult } from "../models.ts";
import type { ProofEngine } from "./types.ts";

function assertOptionalFiniteNumber(value: number | undefined, label: string) {
  if (value === undefined) {
    return;
  }
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

const bugTypeByRule: Record<string, string> = {
  "vault-accounting-safety": "Vault Invariant Break",
  "claims-vs-deposits": "Claims Exceed Deposits",
  "reward-reserve-safety": "Reward Reserve Violation",
  "withdraw-limit-safety": "Withdrawal Limit Bypass",
};

export function createMockVaultEngine(existingNullifiers: Set<string> = new Set()): ProofEngine {
  return {
    name: "Mock Invariant Engine",
    mode: "mock-invariant",
    supportsRule() {
      return true;
    },
    getSupportMessage() {
      return "Supports all four DemoVault invariants.";
    },
    async generateProof(input, bounty) {
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === "number") {
          assertOptionalFiniteNumber(value, key);
        }
      }

      const timestamp = new Date().toISOString();
      const rule = getDemoVaultRule(bounty.ruleId);
      const nullifier = createNullifier({
        bountyId: bounty.id,
        ruleId: bounty.ruleId,
        reporterSecret: input.reporterSecret,
      });
      const reporterCommitment = createReporterCommitment({ reporterSecret: input.reporterSecret });
      const bugType = input.bugType ?? bugTypeByRule[bounty.ruleId] ?? "DemoVault invariant breach";
      const invariant = evaluateDemoVaultInvariant(bounty.ruleId, input);
      const severity = calculateSeverity(invariant.impact);
      const duplicate = existingNullifiers.has(nullifier);
      const verified =
        invariant.initialStateValid && invariant.invariantBroken && severity !== "Low" && !duplicate;
      const reason = duplicate
        ? "Duplicate claim detected. This nullifier has already been used."
        : !invariant.initialStateValid
          ? "Initial state is invalid"
          : !invariant.invariantBroken
            ? `${invariant.rule.invariantText} was not broken`
            : severity === "Low"
              ? "Severity below Medium"
              : undefined;

      const witnessCommitment = createWitnessCommitment({
        ruleId: bounty.ruleId,
        scopeHash: bounty.scopeHash,
        witnessSummary: [
          input.privateCallSequence,
          input.privateStateValues,
          input.hiddenDeltaBalance,
          input.hiddenDeltaClaims,
          input.hiddenDeltaDeposits,
          input.hiddenDeltaReservedRewards,
          input.hiddenDeltaWithdrawLimit,
          input.hiddenDeltaWithdrawAmount,
          input.hiddenDeltaUserBalance,
          invariant.leftAfter,
          invariant.rightAfter,
        ].join("|"),
      });
      const claimHash = createClaimHash({
        bountyId: bounty.id,
        ruleId: bounty.ruleId,
        scopeHash: bounty.scopeHash,
        bugType,
        severity,
        witnessCommitment,
        nullifier,
        timestamp,
      });
      const receiptId = verified
        ? createReceiptId({
            claimHash,
            bountyId: bounty.id,
            proofEngine: "Mock Invariant Engine",
            verifiedAt: timestamp,
          })
        : "";
      const registryKey = verified ? createRegistryKey({ bountyId: bounty.id, claimHash }) : "";

      const result: ProofResult = {
        verified,
        claimHash,
        witnessCommitment,
        nullifier,
        reporterCommitment,
        receiptId,
        registryKey,
        bugType,
        severity,
        proofStatus: verified ? "Verified" : "Invalid",
        scopeHash: bounty.scopeHash,
        ruleId: bounty.ruleId,
        ruleName: bounty.ruleName ?? rule.name,
        affectedModule: bounty.affectedModule ?? rule.affectedModule,
        impact: invariant.impact,
        claimReceiptId: receiptId,
        proofEngine: "Mock Invariant Engine",
        protocolVersion: {
          ...DEFAULT_PROTOCOL_VERSION,
          proofSystem: "mock-invariant",
        },
        verification: {
          level: "Simulation",
          network: "local",
          programId: "mock-vault-engine",
        },
      };

      if (reason) {
        result.reason = reason;
      }

      return result;
    },
    async verifyProof(result) {
      return result.verified && result.proofStatus === "Verified" && result.scopeHash.length > 0;
    },
  };
}
