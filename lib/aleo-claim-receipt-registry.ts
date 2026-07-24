import type { DemoVaultRuleId, OnChainClaimReceipt } from "./models.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";
import {
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "./aleo-bounty-registry.ts";

export const CLAIM_RECEIPT_MAPPING_NAME = "claim_receipts";

const requiredFields = [
  "claim_hash",
  "bounty_id",
  "rule_id",
  "scope_hash",
  "severity",
  "witness_commitment",
  "nullifier",
  "reporter_commitment",
  "proof_status",
  "created_height",
  "protocol_version",
] as const;

const ruleByField: Record<string, DemoVaultRuleId> = {
  "1field": "vault-accounting-safety",
  "2field": "claims-vs-deposits",
  "3field": "reward-reserve-safety",
  "4field": "withdraw-limit-safety",
};

const severityByLiteral: Record<string, OnChainClaimReceipt["severity"]> = {
  "1u8": "Medium",
  "2u8": "High",
  "3u8": "Critical",
};

function normalizeMappingResponse(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Aleo claim receipt mapping returned an empty response");
  if (!trimmed.startsWith('"')) return trimmed;
  const parsed: unknown = JSON.parse(trimmed);
  if (typeof parsed !== "string") {
    throw new Error("Aleo claim receipt mapping returned an invalid response");
  }
  return parsed.trim();
}

function parseStructFields(raw: string) {
  const normalized = normalizeMappingResponse(raw);
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) {
    throw new Error("Aleo claim receipt mapping returned an invalid struct");
  }

  const values = new Map<string, string>();
  const body = normalized.slice(1, -1).trim();
  for (const entry of body.split(",")) {
    const separator = entry.indexOf(":");
    if (separator <= 0) throw new Error("Aleo claim receipt contains an invalid field");
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (
      !requiredFields.includes(key as (typeof requiredFields)[number]) ||
      values.has(key) ||
      !value
    ) {
      throw new Error("Aleo claim receipt contains an unexpected field");
    }
    values.set(key, value);
  }

  if (values.size !== requiredFields.length || requiredFields.some((key) => !values.has(key))) {
    throw new Error("Aleo claim receipt is missing required fields");
  }
  return values;
}

function parseUnsignedLiteral(value: string, suffix: "u8" | "u32") {
  const match = value.match(new RegExp(`^([0-9]+)${suffix}$`));
  if (!match) throw new Error(`Invalid Aleo ${suffix} literal`);
  const parsed = Number(match[1]);
  const max = suffix === "u8" ? 255 : 4_294_967_295;
  if (!Number.isSafeInteger(parsed) || parsed > max) {
    throw new Error(`Aleo ${suffix} literal is out of range`);
  }
  return parsed;
}

export function parseOnChainClaimReceipt(
  raw: string,
  claimHash: string,
  config: AleoBountyRegistryConfig,
): OnChainClaimReceipt {
  if (!isAleoFieldLiteral(claimHash)) throw new Error("Invalid Aleo claim hash");
  const fields = parseStructFields(raw);
  const mappedClaimHash = fields.get("claim_hash")!;
  if (mappedClaimHash !== claimHash) {
    throw new Error("Aleo claim receipt key does not match its claim hash");
  }

  for (const key of [
    "claim_hash",
    "bounty_id",
    "scope_hash",
    "witness_commitment",
    "nullifier",
    "reporter_commitment",
  ] as const) {
    if (!isAleoFieldLiteral(fields.get(key)!)) {
      throw new Error(`Aleo claim receipt contains an invalid ${key}`);
    }
  }

  const ruleId = ruleByField[fields.get("rule_id")!];
  const severity = severityByLiteral[fields.get("severity")!];
  if (!ruleId || !severity || fields.get("proof_status") !== "1u8") {
    throw new Error("Aleo claim receipt contains an unsupported protocol value");
  }

  const receipt: OnChainClaimReceipt = {
    claimHash,
    bountyId: fields.get("bounty_id")!,
    ruleId,
    scopeHash: fields.get("scope_hash")!,
    severity,
    witnessCommitment: fields.get("witness_commitment")!,
    nullifier: fields.get("nullifier")!,
    reporterCommitment: fields.get("reporter_commitment")!,
    proofStatus: "Verified",
    createdHeight: parseUnsignedLiteral(fields.get("created_height")!, "u32"),
    protocolVersion: parseUnsignedLiteral(fields.get("protocol_version")!, "u8"),
    source: "AleoTestnet",
    network: config.network,
    programId: config.programId,
    mapping: CLAIM_RECEIPT_MAPPING_NAME,
  };
  assertNoPrivateFields(receipt);
  return receipt;
}

export async function fetchOnChainClaimReceipt(
  claimHash: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  if (!isAleoFieldLiteral(claimHash)) throw new Error("Invalid Aleo claim hash");
  const url = `${config.endpoint}/${config.network}/program/${encodeURIComponent(config.programId)}/mapping/${CLAIM_RECEIPT_MAPPING_NAME}/${encodeURIComponent(claimHash)}`;
  const response = await fetcher(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Aleo claim receipt request failed with HTTP ${response.status}`);
  }
  const raw = await response.text();
  if (raw.trim() === "null") return null;
  return parseOnChainClaimReceipt(raw, claimHash, config);
}
