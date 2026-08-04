import type { DemoVaultRuleId, Severity } from "./models.ts";
import type { PrivateProofInput } from "./proof-engines/types.ts";

export type DemoVaultState = {
  vaultBalance: number;
  totalDeposits: number;
  totalClaims: number;
  reservedRewards: number;
  withdrawLimit: number;
  userBalance: number;
  requestedWithdrawAmount: number;
};

export type DemoVaultPrivateWitness = {
  hiddenDeltaBalance?: number;
  hiddenDeltaClaims?: number;
  hiddenDeltaReservedRewards?: number;
  hiddenDeltaWithdrawAmount?: number;
  hiddenDeltaUserBalance?: number;
  reporterSecret: string;
  privateCallSequence?: string;
  privateStateValues?: string;
};

export type DemoVaultRule = {
  id: DemoVaultRuleId;
  name: string;
  description: string;
  invariantText: string;
  affectedModule: string;
  defaultSeverityThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
};

export type DemoVaultInvariantResult = {
  rule: DemoVaultRule;
  initialStateValid: boolean;
  invariantBroken: boolean;
  impact: number;
  leftAfter: number;
  rightAfter: number;
  stateAfter: DemoVaultState;
  reason?: string;
};

const severityThresholds = {
  critical: 100,
  high: 50,
  medium: 10,
};

export const DEMO_VAULT_RULES: DemoVaultRule[] = [
  {
    id: "vault-accounting-safety",
    name: "Vault Accounting Safety",
    invariantText: "vaultBalance >= totalClaims",
    description: "The vault must always have enough balance to cover total user claims.",
    affectedModule: "Vault accounting logic",
    defaultSeverityThresholds: severityThresholds,
  },
  {
    id: "claims-vs-deposits",
    name: "Claims vs Deposits Safety",
    invariantText: "totalClaims <= totalDeposits",
    description: "The system should not allow total user claims to exceed total deposits.",
    affectedModule: "Claims accounting",
    defaultSeverityThresholds: severityThresholds,
  },
  {
    id: "reward-reserve-safety",
    name: "Reward Reserve Safety",
    invariantText: "reservedRewards <= vaultBalance",
    description: "The reserved bounty or reward pool must not exceed the actual vault balance.",
    affectedModule: "Reward reserve logic",
    defaultSeverityThresholds: severityThresholds,
  },
  {
    id: "withdraw-limit-safety",
    name: "Withdrawal Limit Safety",
    invariantText: "requestedWithdrawAmount <= withdrawLimit && requestedWithdrawAmount <= userBalance",
    description: "A user should not be able to withdraw more than their limit or their available balance.",
    affectedModule: "Withdrawal logic",
    defaultSeverityThresholds: severityThresholds,
  },
];

export function calculateSeverity(impact: number): Severity {
  if (impact >= severityThresholds.critical) {
    return "Critical";
  }
  if (impact >= severityThresholds.high) {
    return "High";
  }
  if (impact >= severityThresholds.medium) {
    return "Medium";
  }
  return "Low";
}

export function getDemoVaultRule(ruleId: DemoVaultRuleId) {
  return DEMO_VAULT_RULES.find((rule) => rule.id === ruleId) ?? DEMO_VAULT_RULES[0];
}

function finiteOrZero(value: number | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function numericField(input: DemoVaultState | PrivateProofInput | DemoVaultPrivateWitness, key: string) {
  const value = (input as Record<string, number | undefined>)[key];
  return typeof value === "number" ? value : undefined;
}

function normalizeState(input: DemoVaultState | PrivateProofInput): DemoVaultState {
  const vaultBalance = finiteOrZero(numericField(input, "vaultBalance") ?? numericField(input, "vaultBalanceBefore"));
  const totalClaims = finiteOrZero(numericField(input, "totalClaims") ?? numericField(input, "totalClaimsBefore"));
  return {
    vaultBalance,
    totalDeposits: finiteOrZero(
      numericField(input, "totalDeposits") ?? numericField(input, "totalDepositsBefore") ?? vaultBalance,
    ),
    totalClaims,
    reservedRewards: finiteOrZero(
      numericField(input, "reservedRewards") ?? numericField(input, "reservedRewardsBefore"),
    ),
    withdrawLimit: finiteOrZero(
      numericField(input, "withdrawLimit") ?? numericField(input, "withdrawLimitBefore"),
    ),
    userBalance: finiteOrZero(numericField(input, "userBalance")),
    requestedWithdrawAmount: finiteOrZero(numericField(input, "requestedWithdrawAmount")),
  };
}

function normalizeWitness(input: DemoVaultPrivateWitness | PrivateProofInput): DemoVaultPrivateWitness {
  return {
    hiddenDeltaBalance: finiteOrZero(numericField(input, "hiddenDeltaBalance")),
    hiddenDeltaClaims: finiteOrZero(numericField(input, "hiddenDeltaClaims")),
    hiddenDeltaReservedRewards: finiteOrZero(numericField(input, "hiddenDeltaReservedRewards")),
    hiddenDeltaWithdrawAmount: finiteOrZero(
      numericField(input, "hiddenDeltaWithdrawAmount") ?? numericField(input, "hiddenDeltaWithdrawLimit"),
    ),
    hiddenDeltaUserBalance: finiteOrZero(numericField(input, "hiddenDeltaUserBalance")),
    reporterSecret: input.reporterSecret,
    privateCallSequence: input.privateCallSequence,
    privateStateValues: input.privateStateValues,
  };
}

function result(input: {
  rule: DemoVaultRule;
  stateBefore: DemoVaultState;
  stateAfter: DemoVaultState;
  initialStateValid: boolean;
  invariantBroken: boolean;
  impact: number;
  leftAfter: number;
  rightAfter: number;
}): DemoVaultInvariantResult {
  const impact = Math.max(0, input.impact);
  return {
    rule: input.rule,
    initialStateValid: input.initialStateValid,
    invariantBroken: input.initialStateValid && input.invariantBroken,
    impact,
    leftAfter: input.leftAfter,
    rightAfter: input.rightAfter,
    stateAfter: input.stateAfter,
    reason: input.initialStateValid ? undefined : "Initial state is invalid",
  };
}

export function evaluateDemoVaultInvariant(
  ruleId: DemoVaultRuleId,
  stateBeforeInput: DemoVaultState | PrivateProofInput,
  privateWitnessInput?: DemoVaultPrivateWitness,
): DemoVaultInvariantResult {
  const rule = getDemoVaultRule(ruleId);
  const stateBefore = normalizeState(stateBeforeInput);
  const witness = normalizeWitness(privateWitnessInput ?? (stateBeforeInput as PrivateProofInput));
  const stateAfter: DemoVaultState = {
    vaultBalance: stateBefore.vaultBalance - finiteOrZero(witness.hiddenDeltaBalance),
    totalDeposits: stateBefore.totalDeposits,
    totalClaims: stateBefore.totalClaims + finiteOrZero(witness.hiddenDeltaClaims),
    reservedRewards:
      stateBefore.reservedRewards + finiteOrZero(witness.hiddenDeltaReservedRewards),
    withdrawLimit: stateBefore.withdrawLimit,
    userBalance: stateBefore.userBalance - finiteOrZero(witness.hiddenDeltaUserBalance),
    requestedWithdrawAmount:
      stateBefore.requestedWithdrawAmount + finiteOrZero(witness.hiddenDeltaWithdrawAmount),
  };

  if (rule.id === "claims-vs-deposits") {
    return result({
      rule,
      stateBefore,
      stateAfter,
      initialStateValid: stateBefore.totalClaims <= stateBefore.totalDeposits,
      invariantBroken: stateAfter.totalClaims > stateAfter.totalDeposits,
      impact: stateAfter.totalClaims - stateAfter.totalDeposits,
      leftAfter: stateAfter.totalClaims,
      rightAfter: stateAfter.totalDeposits,
    });
  }

  if (rule.id === "reward-reserve-safety") {
    return result({
      rule,
      stateBefore,
      stateAfter,
      initialStateValid: stateBefore.reservedRewards <= stateBefore.vaultBalance,
      invariantBroken: stateAfter.reservedRewards > stateAfter.vaultBalance,
      impact: stateAfter.reservedRewards - stateAfter.vaultBalance,
      leftAfter: stateAfter.reservedRewards,
      rightAfter: stateAfter.vaultBalance,
    });
  }

  if (rule.id === "withdraw-limit-safety") {
    const limitImpact = stateAfter.requestedWithdrawAmount - stateAfter.withdrawLimit;
    const balanceImpact = stateAfter.requestedWithdrawAmount - stateAfter.userBalance;
    return result({
      rule,
      stateBefore,
      stateAfter,
      initialStateValid:
        stateBefore.requestedWithdrawAmount <= stateBefore.withdrawLimit &&
        stateBefore.requestedWithdrawAmount <= stateBefore.userBalance,
      invariantBroken: limitImpact > 0 || balanceImpact > 0,
      impact: Math.max(limitImpact, balanceImpact),
      leftAfter: stateAfter.requestedWithdrawAmount,
      rightAfter: Math.min(stateAfter.withdrawLimit, stateAfter.userBalance),
    });
  }

  return result({
    rule,
    stateBefore,
    stateAfter,
    initialStateValid: stateBefore.vaultBalance >= stateBefore.totalClaims,
    invariantBroken: stateAfter.vaultBalance < stateAfter.totalClaims,
    impact: stateAfter.totalClaims - stateAfter.vaultBalance,
    leftAfter: stateAfter.vaultBalance,
    rightAfter: stateAfter.totalClaims,
  });
}
