import { assertNoPrivateFields, redactSensitiveText } from "./privacy-guards.ts";
import type { Bounty, BugClaim, TriageAction } from "./models.ts";

export type TriageCopilotPublicMetadata = {
  bugType: string;
  severity: BugClaim["severity"];
  proofStatus: BugClaim["proofStatus"];
  claimReceiptId: string;
  disclosureStatus: BugClaim["disclosureStatus"];
  payoutStatus: BugClaim["payoutStatus"];
  affectedModule: string;
  publicTriageNotes: string[];
};

export type TriageCopilotRecommendation = {
  riskSummary: string;
  recommendedNextStep: string;
  responsibleDisclosureReminder: string;
  scopeStatement: string;
};

export type TriageCopilotProvider = {
  name: string;
  recommend(metadata: TriageCopilotPublicMetadata): Promise<TriageCopilotRecommendation>;
};

export type TriageCopilotModelTransport = (
  metadata: TriageCopilotPublicMetadata,
) => Promise<
  Pick<
    TriageCopilotRecommendation,
    "riskSummary" | "recommendedNextStep" | "responsibleDisclosureReminder"
  >
>;

export const TRIAGE_COPILOT_SCOPE_STATEMENT =
  "本建议仅基于 Public Metadata。Exploit 细节始终隐藏。This recommendation is based only on public metadata. Exploit details remain hidden.";

export const AI_TRIAGE_CAPABILITY = {
  status: "ExternalProviderUnavailable",
  activeProvider: "MockRuleBased",
  modelCanMutateProtocolState: false,
  publicMetadataOnly: true,
  privateInputAllowed: false,
} as const;

const metadataKeys = [
  "bugType",
  "severity",
  "proofStatus",
  "claimReceiptId",
  "disclosureStatus",
  "payoutStatus",
  "affectedModule",
  "publicTriageNotes",
] as const;

function boundedPublicText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || value.trim() === "" || value.length > maxLength) {
    throw new Error(`${label} is invalid`);
  }
  return redactSensitiveText(value.trim());
}

export function sanitizeTriageCopilotMetadata(value: unknown): TriageCopilotPublicMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI triage metadata must be an object");
  }
  const record = value as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter(
    (key) => !metadataKeys.includes(key as (typeof metadataKeys)[number]),
  );
  if (unknownKeys.length > 0) throw new Error("AI triage metadata contains unsupported fields");
  const severity = ["Low", "Medium", "High", "Critical"].includes(String(record.severity))
    ? (record.severity as BugClaim["severity"])
    : null;
  const proofStatus = ["Pending", "Verified", "Invalid"].includes(String(record.proofStatus))
    ? (record.proofStatus as BugClaim["proofStatus"])
    : null;
  const disclosureStatus = ["NotRequested", "Requested", "EncryptedDetailsShared", "Patched"].includes(
    String(record.disclosureStatus),
  )
    ? (record.disclosureStatus as BugClaim["disclosureStatus"])
    : null;
  const payoutStatus = ["Unfunded", "RewardLocked", "Paid", "Rejected"].includes(
    String(record.payoutStatus),
  )
    ? (record.payoutStatus as BugClaim["payoutStatus"])
    : null;
  if (!severity || !proofStatus || !disclosureStatus || !payoutStatus) {
    throw new Error("AI triage metadata contains an invalid public status");
  }
  if (!Array.isArray(record.publicTriageNotes) || record.publicTriageNotes.length > 20) {
    throw new Error("AI triage public notes are invalid");
  }
  const metadata: TriageCopilotPublicMetadata = {
    bugType: boundedPublicText(record.bugType, "bugType", 160),
    severity,
    proofStatus,
    claimReceiptId: boundedPublicText(record.claimReceiptId, "claimReceiptId", 160),
    disclosureStatus,
    payoutStatus,
    affectedModule: boundedPublicText(record.affectedModule, "affectedModule", 160),
    publicTriageNotes: record.publicTriageNotes.map((note) =>
      boundedPublicText(note, "publicTriageNote", 500),
    ),
  };
  assertNoPrivateFields(metadata);
  return metadata;
}

export function createModelTriageCopilotProvider(
  name: string,
  transport: TriageCopilotModelTransport,
): TriageCopilotProvider {
  return {
    name,
    async recommend(input) {
      const metadata = sanitizeTriageCopilotMetadata(input);
      const response = await transport(metadata);
      const recommendation: TriageCopilotRecommendation = {
        riskSummary: boundedPublicText(response.riskSummary, "riskSummary", 800),
        recommendedNextStep: boundedPublicText(
          response.recommendedNextStep,
          "recommendedNextStep",
          500,
        ),
        responsibleDisclosureReminder: boundedPublicText(
          response.responsibleDisclosureReminder,
          "responsibleDisclosureReminder",
          500,
        ),
        scopeStatement: TRIAGE_COPILOT_SCOPE_STATEMENT,
      };
      assertNoPrivateFields(recommendation);
      return recommendation;
    },
  };
}

export function buildTriageCopilotMetadata({
  claim,
  bounty,
  triageActions,
}: {
  claim: BugClaim;
  bounty: Bounty;
  triageActions: TriageAction[];
}): TriageCopilotPublicMetadata {
  const metadata: TriageCopilotPublicMetadata = {
    bugType: claim.bugType,
    severity: claim.severity,
    proofStatus: claim.proofStatus,
    claimReceiptId: claim.claimReceiptId,
    disclosureStatus: claim.disclosureStatus,
    payoutStatus: claim.payoutStatus,
    affectedModule: claim.affectedModule || bounty.scope,
    publicTriageNotes: triageActions
      .filter((action) => action.claimId === claim.id)
      .map((action) => redactSensitiveText(action.publicNote)),
  };

  return sanitizeTriageCopilotMetadata(metadata);
}

export function generateTriageCopilotRecommendation(
  metadata: TriageCopilotPublicMetadata,
): TriageCopilotRecommendation {
  const riskSummary = `${metadata.severity} ${metadata.bugType}，受影响模块为 ${metadata.affectedModule}。Proof Status：${metadata.proofStatus}；公开 Triage 备注：${metadata.publicTriageNotes.length} 条。`;

  let recommendedNextStep = "查看公开 Claim Receipt，并等待 Proof 完成验证。";
  if (metadata.proofStatus === "Verified" && metadata.payoutStatus === "Unfunded") {
    recommendedNextStep = "为 Verified Claim 锁定奖励（Lock Reward）。";
  } else if (
    metadata.proofStatus === "Verified" &&
    metadata.payoutStatus === "RewardLocked" &&
    metadata.disclosureStatus === "NotRequested"
  ) {
    recommendedNextStep = "向 Whitehat 请求 Encrypted Details。";
  } else if (metadata.disclosureStatus === "EncryptedDetailsShared") {
    recommendedNextStep = "Project Owner 验证加密报告后，标记已修复（Mark Patched）。";
  } else if (metadata.disclosureStatus === "Patched" && metadata.payoutStatus === "RewardLocked") {
    recommendedNextStep = "为已修复的 Verified Claim 释放 Bounty。";
  } else if (metadata.payoutStatus === "Paid") {
    recommendedNextStep = "保留 Claim 的公开 Paid Demo 状态；接入 Escrow 后再以链上交易确认支付。";
  }

  return {
    riskSummary,
    recommendedNextStep,
    responsibleDisclosureReminder:
      "请始终在加密的 Responsible Disclosure 流程中协作，公开侧只发布状态更新。",
    scopeStatement: TRIAGE_COPILOT_SCOPE_STATEMENT,
  };
}

export const localTriageCopilotProvider: TriageCopilotProvider = {
  name: "Mock · Public Metadata Policy Engine",
  async recommend(metadata) {
    assertNoPrivateFields(metadata);
    return generateTriageCopilotRecommendation(metadata);
  },
};
