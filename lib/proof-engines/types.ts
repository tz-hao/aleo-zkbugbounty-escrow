import type { Bounty, ProofResult } from "../models.ts";

export type ProofEngineMode =
  | "mock-invariant"
  | "aleo-placeholder"
  | "aleo-program"
  | "aleo-program-boundary";

export type PrivateProofInput = {
  vaultBalance?: number;
  totalDeposits?: number;
  totalClaims?: number;
  reservedRewards?: number;
  withdrawLimit?: number;
  userBalance?: number;
  requestedWithdrawAmount?: number;
  vaultBalanceBefore?: number;
  totalClaimsBefore?: number;
  totalDepositsBefore?: number;
  reservedRewardsBefore?: number;
  withdrawLimitBefore?: number;
  hiddenDeltaBalance?: number;
  hiddenDeltaClaims?: number;
  hiddenDeltaDeposits?: number;
  hiddenDeltaReservedRewards?: number;
  hiddenDeltaWithdrawLimit?: number;
  hiddenDeltaWithdrawAmount?: number;
  hiddenDeltaUserBalance?: number;
  privateCallSequence?: string;
  privateStateValues?: string;
  reporterSecret: string;
  bugType?: string;
};

export type ProofEngine = {
  name: string;
  mode: ProofEngineMode;
  generateProof(input: PrivateProofInput, bounty: Bounty): Promise<ProofResult>;
  verifyProof(result: ProofResult): Promise<boolean>;
  supportsRule(ruleId: Bounty["ruleId"]): boolean;
  getSupportMessage(ruleId: Bounty["ruleId"]): string;
};
