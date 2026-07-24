import type { BugClaim, ProofResult } from "./models.ts";
import { DEFAULT_PROTOCOL_VERSION } from "./protocol/crypto.ts";

const sensitiveTerms = [
  "private witness",
  "hiddenDeltaBalance",
  "hiddenDeltaClaims",
  "hidden_delta_balance",
  "hidden_delta_claims",
  "reporterSecret",
  "reporter_secret",
  "privateCallSequence",
  "private call sequence",
  "privateStateValues",
  "private state values",
  "triggering parameters",
  "exploit path",
  "PoC",
  "private input",
  "hiddenDelta",
  "hidden delta",
  "hidden deltas",
  "delta values",
  "witness",
] as const;

const allowedCommitmentKeys = new Set(["witnessCommitment"]);

const sensitiveKeyTokens = [
  "privatewitness",
  "hiddendelta",
  "reportersecret",
  "privatecallsequence",
  "privatestatevalues",
  "triggeringparameters",
  "exploitpath",
  "poc",
  "privateinput",
  "deltavalues",
] as const;

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function termPattern(term: string) {
  return new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
}

function findSensitiveTerm(text: string) {
  return sensitiveTerms.find((term) => termPattern(term).test(text));
}

function normalizeSensitiveKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string) {
  const normalized = normalizeSensitiveKey(key);
  return sensitiveKeyTokens.some((token) => normalized.includes(token));
}

export function redactSensitiveText(text: string) {
  return sensitiveTerms.reduce(
    (redacted, term) => redacted.replace(termPattern(term), "[REDACTED]"),
    text,
  );
}

export function assertNoPrivateFields(value: unknown, path = "value"): void {
  if (typeof value === "string") {
    const term = findSensitiveTerm(value);
    if (term) {
      throw new Error(`Sensitive text "${term}" found at ${path}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPrivateFields(item, `${path}[${index}]`));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (!allowedCommitmentKeys.has(key)) {
      if (isSensitiveKey(key)) {
        throw new Error(`Sensitive field "${key}" found at ${path}`);
      }
      const term = findSensitiveTerm(key);
      if (term) {
        throw new Error(`Sensitive field "${key}" found at ${path}`);
      }
    }
    assertNoPrivateFields(nested, `${path}.${key}`);
  }
}

export function sanitizeProofResult(result: ProofResult | PlainObject): ProofResult {
  const sanitized: ProofResult = {
    verified: Boolean(result.verified),
    claimHash: String(result.claimHash ?? ""),
    witnessCommitment: String(result.witnessCommitment ?? ""),
    nullifier: String(result.nullifier ?? ""),
    reporterCommitment: String(result.reporterCommitment ?? ""),
    receiptId: String(result.receiptId ?? result.claimReceiptId ?? ""),
    registryKey: String(result.registryKey ?? ""),
    bugType: String(result.bugType ?? ""),
    severity: result.severity as ProofResult["severity"],
    proofStatus: result.proofStatus as ProofResult["proofStatus"],
    scopeHash: String(result.scopeHash ?? ""),
    ruleId: String(result.ruleId ?? ""),
    ruleName: String(result.ruleName ?? ""),
    affectedModule: String(result.affectedModule ?? ""),
    impact: Number(result.impact ?? 0),
    proofEngine: String(result.proofEngine ?? ""),
    protocolVersion:
      isPlainObject(result.protocolVersion)
        ? {
            version: String(result.protocolVersion.version ?? DEFAULT_PROTOCOL_VERSION.version),
            proofSystem: String(result.protocolVersion.proofSystem ?? DEFAULT_PROTOCOL_VERSION.proofSystem),
            commitmentScheme: String(
              result.protocolVersion.commitmentScheme ?? DEFAULT_PROTOCOL_VERSION.commitmentScheme,
            ),
            nullifierScheme: String(
              result.protocolVersion.nullifierScheme ?? DEFAULT_PROTOCOL_VERSION.nullifierScheme,
            ),
          }
        : DEFAULT_PROTOCOL_VERSION,
  };

  if (isPlainObject(result.verification)) {
    const allowedLevels = ["Simulation", "LocalExecution", "RemoteExecution", "NetworkConfirmed", "Unavailable"] as const;
    const allowedNetworks = ["local", "testnet", "mainnet", "unavailable"] as const;
    const rawLevel = String(result.verification.level ?? "Unavailable");
    const rawNetwork = String(result.verification.network ?? "unavailable");
    const level = allowedLevels.find((item) => item === rawLevel) ?? "Unavailable";
    const network = allowedNetworks.find((item) => item === rawNetwork) ?? "unavailable";
    sanitized.verification = {
      level,
      network,
      programId: String(result.verification.programId ?? ""),
    };
    if (typeof result.verification.transactionId === "string") {
      sanitized.verification.transactionId = result.verification.transactionId;
    }
  }

  if (typeof result.claimReceiptId === "string") {
    sanitized.claimReceiptId = result.claimReceiptId;
  }

  if (typeof result.reason === "string") {
    sanitized.reason = redactSensitiveText(result.reason);
  }

  assertNoPrivateFields(sanitized);
  return sanitized;
}

export function sanitizePublicClaim(claim: BugClaim) {
  const sanitized = {
    id: claim.id,
    bountyId: claim.bountyId,
    reporterId: claim.reporterId,
    bugType: claim.bugType,
    ruleName: claim.ruleName,
    affectedModule: claim.affectedModule,
    impact: claim.impact,
    severity: claim.severity,
    proofStatus: claim.proofStatus,
    disclosureStatus: claim.disclosureStatus,
    payoutStatus: claim.payoutStatus,
    exploitDetailsVisible: claim.exploitDetailsVisible,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };

  assertNoPrivateFields(sanitized);
  return sanitized;
}
