import { prefixedHash } from "./hash.ts";
import type { Severity } from "./models.ts";

type PublicProof = {
  claimHash: string;
  severity: Severity;
  bugType: string;
  verified: boolean;
};

type MockProofInput = {
  bountyId: string;
  bugType: string;
  severity: Severity;
  vaultBalanceBefore: number;
  totalClaimsBefore: number;
  hiddenDeltaBalance: number;
  hiddenDeltaClaims: number;
  triggeringParameters?: string;
};

function assertFiniteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

export function generateMockProof(input: MockProofInput): PublicProof {
  assertFiniteNumber(input.vaultBalanceBefore, "vaultBalanceBefore");
  assertFiniteNumber(input.totalClaimsBefore, "totalClaimsBefore");
  assertFiniteNumber(input.hiddenDeltaBalance, "hiddenDeltaBalance");
  assertFiniteNumber(input.hiddenDeltaClaims, "hiddenDeltaClaims");

  if (input.vaultBalanceBefore < input.totalClaimsBefore) {
    throw new Error("Initial vault invariant must hold before proof generation");
  }

  const vaultBalanceAfter = input.vaultBalanceBefore - input.hiddenDeltaBalance;
  const totalClaimsAfter = input.totalClaimsBefore + input.hiddenDeltaClaims;
  const verified = vaultBalanceAfter < totalClaimsAfter;

  return {
    claimHash: prefixedHash(
      "zkclaim",
      [
        input.bountyId,
        input.bugType,
        input.severity,
        input.vaultBalanceBefore,
        input.totalClaimsBefore,
        vaultBalanceAfter,
        totalClaimsAfter,
      ].join(":"),
    ),
    severity: input.severity,
    bugType: input.bugType,
    verified,
  };
}
