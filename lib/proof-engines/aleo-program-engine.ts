import { getDemoVaultRule } from "../demo-vault.ts";
import { runLeoCommand } from "../leo-cli.ts";
import type { Bounty, ProofResult, ProofVerification, Severity } from "../models.ts";
import { assertNoPrivateFields } from "../privacy-guards.ts";
import type { LeoCliDetection, LeoCommandRunner } from "../leo-cli.ts";
import type { PrivateProofInput, ProofEngine } from "./types.ts";
import { CANONICAL_ALEO_PROGRAM_ID } from "../aleo-program.ts";

type AleoProgramEngineOptions = {
  cwd?: string;
  detection?: LeoCliDetection;
  runner?: LeoCommandRunner;
};

type LeoRunResult = {
  stdout?: string;
  reason?: string;
  verification: ProofVerification;
};

const ALEO_ENGINE_NAME = "Aleo Leo Proof";
const ALEO_PROGRAM_ID = CANONICAL_ALEO_PROGRAM_ID;
const ALEO_FAILURE_REASON =
  "Leo execution is unavailable. This development engine runs only with a local Leo CLI.";
const ALEO_CONSTRAINT_REJECTION_REASON =
  "Leo constraints rejected this proof. No verified claim was created.";
const DUPLICATE_REASON = "Duplicate claim detected. This nullifier has already been used.";

const ruleFieldById: Record<Bounty["ruleId"], string> = {
  "vault-accounting-safety": "1field",
  "claims-vs-deposits": "2field",
  "reward-reserve-safety": "3field",
  "withdraw-limit-safety": "4field",
};

const bugTypeByRule: Record<Bounty["ruleId"], string> = {
  "vault-accounting-safety": "Vault Accounting Invariant Break",
  "claims-vs-deposits": "Claims Exceed Deposits",
  "reward-reserve-safety": "Reward Reserve Invariant Break",
  "withdraw-limit-safety": "Withdrawal Limit Bypass",
};

function severityFromLeo(value: string | undefined): Severity | undefined {
  if (value === "3") return "Critical";
  if (value === "2") return "High";
  if (value === "1") return "Medium";
  if (value === "0") return "Low";
  return undefined;
}

function minimumImpactForSeverity(severity: Severity) {
  if (severity === "Critical") return 100;
  if (severity === "High") return 50;
  if (severity === "Medium") return 10;
  return 0;
}

function fieldValue(output: string, name: string) {
  const match = output.match(new RegExp(`${name}\\s*[:=]\\s*([0-9]+field)`, "i"));
  return match?.[1];
}

function u8Value(output: string, name: string) {
  const match = output.match(new RegExp(`${name}\\s*[:=]\\s*([0-9]+)u8`, "i"));
  return match?.[1];
}

async function stringToFieldLiteral(domain: string, value: string) {
  const { createHash } = await import("node:crypto");
  const digest = createHash("sha256").update(`${domain}:${value}`, "utf8").digest("hex");
  return `${BigInt(`0x${digest.slice(0, 62)}`).toString()}field`;
}

function u64Literal(value: number | undefined, fallback = 0) {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error("Leo numeric inputs must be non-negative safe integers");
  }
  return `${normalized}u64`;
}

async function buildLeoInput(input: PrivateProofInput, bounty: Bounty) {
  const vaultBalance = input.vaultBalance ?? input.vaultBalanceBefore ?? 0;
  const totalDeposits = input.totalDeposits ?? input.totalDepositsBefore ?? vaultBalance;
  const totalClaims = input.totalClaims ?? input.totalClaimsBefore ?? 0;
  const reservedRewards = input.reservedRewards ?? input.reservedRewardsBefore ?? 0;
  const withdrawLimit = input.withdrawLimit ?? input.withdrawLimitBefore ?? 0;

  if (!input.reporterSecret.trim()) {
    throw new Error("Reporter secret is required");
  }

  return [
    await stringToFieldLiteral("bounty", bounty.id),
    await stringToFieldLiteral("scope", bounty.scopeHash),
    ruleFieldById[bounty.ruleId],
    u64Literal(vaultBalance),
    u64Literal(totalDeposits),
    u64Literal(totalClaims),
    u64Literal(reservedRewards),
    u64Literal(withdrawLimit),
    u64Literal(input.userBalance),
    u64Literal(input.requestedWithdrawAmount),
    u64Literal(input.hiddenDeltaBalance),
    u64Literal(input.hiddenDeltaClaims),
    u64Literal(input.hiddenDeltaReservedRewards),
    u64Literal(input.hiddenDeltaWithdrawAmount ?? input.hiddenDeltaWithdrawLimit),
    u64Literal(input.hiddenDeltaUserBalance),
    await stringToFieldLiteral("reporter-secret", input.reporterSecret),
  ].join("\n");
}

function invalidAleoProof(bounty: Bounty, reason = ALEO_FAILURE_REASON): ProofResult {
  const rule = getDemoVaultRule(bounty.ruleId);
  return {
    verified: false,
    claimHash: "",
    witnessCommitment: "",
    nullifier: "",
    reporterCommitment: "",
    receiptId: "",
    registryKey: "",
    bugType: bugTypeByRule[bounty.ruleId],
    severity: "Low",
    proofStatus: "Invalid",
    scopeHash: bounty.scopeHash,
    ruleId: bounty.ruleId,
    ruleName: bounty.ruleName ?? rule.name,
    affectedModule: bounty.affectedModule ?? rule.affectedModule,
    impact: 0,
    proofEngine: ALEO_ENGINE_NAME,
    protocolVersion: {
      version: "zkbb-aleo-v2",
      proofSystem: "unavailable",
      commitmentScheme: "poseidon-domain-separated-v1",
      nullifierScheme: "poseidon-bounty-rule-reporter-v1",
    },
    verification: {
      level: "Unavailable",
      network: "unavailable",
      programId: ALEO_PROGRAM_ID,
    },
    reason,
  };
}

function parseLeoProofResult(
  output: string,
  bounty: Bounty,
  verification: ProofVerification,
): ProofResult | null {
  const verifiedMatch = output.match(/verified\s*[:=]\s*(true|false)/i);
  const severity = severityFromLeo(u8Value(output, "severity"));
  const claimHash = fieldValue(output, "claim_hash");
  const witnessCommitment = fieldValue(output, "witness_commitment");
  const nullifier = fieldValue(output, "nullifier");
  const reporterCommitment = fieldValue(output, "reporter_commitment");
  const outputRuleId = fieldValue(output, "rule_id");

  if (
    !verifiedMatch ||
    !severity ||
    !claimHash ||
    !witnessCommitment ||
    !nullifier ||
    !reporterCommitment ||
    outputRuleId !== ruleFieldById[bounty.ruleId]
  ) {
    return null;
  }

  const verified = verifiedMatch[1].toLowerCase() === "true";
  const rule = getDemoVaultRule(bounty.ruleId);
  const receiptPrefix = verification.level === "LocalExecution" ? "leo-local" : "leo-remote";
  const receiptId = verified ? `${receiptPrefix}:${claimHash}` : "";
  const registryKey = verified ? `${receiptPrefix}:${bounty.id}:${claimHash}` : "";
  const proof: ProofResult = {
    verified,
    claimHash,
    witnessCommitment,
    nullifier,
    reporterCommitment,
    receiptId,
    registryKey,
    bugType: bugTypeByRule[bounty.ruleId],
    severity,
    proofStatus: verified ? "Verified" : "Invalid",
    scopeHash: bounty.scopeHash,
    ruleId: bounty.ruleId,
    ruleName: bounty.ruleName ?? rule.name,
    affectedModule: bounty.affectedModule ?? rule.affectedModule,
    impact: minimumImpactForSeverity(severity),
    proofEngine: ALEO_ENGINE_NAME,
    protocolVersion: {
      version: "zkbb-aleo-v2",
      proofSystem:
        verification.level === "LocalExecution" ? "leo-local-execution" : "leo-remote-execution",
      commitmentScheme: "poseidon-domain-separated-v1",
      nullifierScheme: "poseidon-bounty-rule-reporter-v1",
    },
    verification,
    claimReceiptId: receiptId,
  };

  assertNoPrivateFields(proof);
  return proof;
}

async function runLeo(
  input: PrivateProofInput,
  bounty: Bounty,
  options: AleoProgramEngineOptions,
): Promise<LeoRunResult> {
  const leoInput = await buildLeoInput(input, bounty);
  const result = await runLeoCommand("leo run prove_vault_invariant_break", {
    projectPath: options.cwd,
    input: leoInput,
    detection: options.detection,
    runner: options.runner,
  });
  if (!result.ok) {
    const commandOutput = `${result.stdout}\n${result.stderr}`;
    const rejectedByConstraints =
      /Failed to evaluate program/i.test(commandOutput) && /assert(?:\.eq)?/i.test(commandOutput);
    return {
      reason: rejectedByConstraints ? ALEO_CONSTRAINT_REJECTION_REASON : ALEO_FAILURE_REASON,
      verification: { level: "Unavailable", network: "unavailable", programId: ALEO_PROGRAM_ID },
    };
  }
  return {
    stdout: result.stdout,
    verification: { level: "LocalExecution", network: "local", programId: ALEO_PROGRAM_ID },
  };
}

export function createAleoProgramEngine(
  existingNullifiers: Set<string> = new Set(),
  options: AleoProgramEngineOptions = {},
): ProofEngine {
  return {
    name: ALEO_ENGINE_NAME,
    mode: "aleo-program",
    supportsRule() {
      return true;
    },
    getSupportMessage() {
      return `All four DemoVault rules are implemented in ${CANONICAL_ALEO_PROGRAM_ID}.`;
    },
    async generateProof(input, bounty) {
      const leoRun = await runLeo(input, bounty, options);
      const parsed = leoRun.stdout
        ? parseLeoProofResult(leoRun.stdout, bounty, leoRun.verification)
        : null;
      if (!parsed) return invalidAleoProof(bounty, leoRun.reason);
      if (parsed.verified && existingNullifiers.has(parsed.nullifier)) {
        return {
          ...parsed,
          verified: false,
          proofStatus: "Invalid",
          receiptId: "",
          registryKey: "",
          claimReceiptId: "",
          reason: DUPLICATE_REASON,
        };
      }
      return parsed;
    },
    async verifyProof(result) {
      return Boolean(
        result.verified &&
          result.proofStatus === "Verified" &&
          result.proofEngine === ALEO_ENGINE_NAME &&
          result.verification?.level === "NetworkConfirmed" &&
          result.verification.transactionId,
      );
    },
  };
}
