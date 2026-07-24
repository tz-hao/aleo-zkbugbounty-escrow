import {
  createClaimHash,
  createNullifier,
  createReporterCommitment,
  createWitnessCommitment,
  DEFAULT_PROTOCOL_VERSION,
} from "../protocol/crypto.ts";
import { getDemoVaultRule } from "../demo-vault.ts";
import type { ProofResult } from "../models.ts";
import type { ProofEngine } from "./types.ts";

export function createAleoPlaceholderEngine(): ProofEngine {
  return {
    name: "Aleo Leo Proof Placeholder",
    mode: "aleo-placeholder",
    supportsRule() {
      return false;
    },
    getSupportMessage() {
      return "Placeholder only. Use Mock Invariant Engine for a verifiable demo result.";
    },
    async generateProof(input, bounty) {
      const rule = getDemoVaultRule(bounty.ruleId);
      const bugType = input.bugType ?? "DemoVault invariant breach";
      const timestamp = new Date().toISOString();
      const nullifier = createNullifier({
        bountyId: bounty.id,
        ruleId: bounty.ruleId,
        reporterSecret: input.reporterSecret,
      });
      const reporterCommitment = createReporterCommitment({ reporterSecret: input.reporterSecret });
      const witnessCommitment = createWitnessCommitment({
        ruleId: bounty.ruleId,
        scopeHash: bounty.scopeHash,
        witnessSummary: "aleo-placeholder",
      });
      const claimHash = createClaimHash({
        bountyId: bounty.id,
        ruleId: bounty.ruleId,
        scopeHash: bounty.scopeHash,
        bugType,
        severity: "Low",
        witnessCommitment,
        nullifier,
        timestamp,
      });

      const result: ProofResult = {
        verified: false,
        claimHash,
        witnessCommitment,
        nullifier,
        reporterCommitment,
        receiptId: "",
        registryKey: "",
        bugType,
        severity: "Low",
        proofStatus: "Invalid",
        scopeHash: bounty.scopeHash,
        ruleId: bounty.ruleId,
        ruleName: bounty.ruleName ?? rule.name,
        affectedModule: bounty.affectedModule ?? rule.affectedModule,
        impact: 0,
        claimReceiptId: "",
        proofEngine: "Aleo Leo Proof Placeholder",
        protocolVersion: {
          ...DEFAULT_PROTOCOL_VERSION,
          proofSystem: "aleo-placeholder",
        },
        reason: "Aleo Leo proof placeholder is not connected in this MVP",
      };

      return result;
    },
    async verifyProof() {
      return false;
    },
  };
}
