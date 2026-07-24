import type { DemoVaultRuleId, OnChainBountyState } from "./models.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";
import {
  ALEO_TESTNET_API_ENDPOINT,
  CANONICAL_ALEO_PROGRAM_ID,
} from "./aleo-program.ts";

export const DEFAULT_ALEO_API_ENDPOINT = ALEO_TESTNET_API_ENDPOINT;
export const BOUNTY_MAPPING_NAME = "bounties";

export type AleoBountyRegistryConfig = {
  endpoint: string;
  network: "testnet";
  programId: string;
};

export type RegistryFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const ALEO_PROGRAM_ID_PATTERN = /^[a-z][a-z0-9_]{0,30}\.aleo$/;
const ALEO_ADDRESS_PATTERN = /^aleo1[0-9a-z]{20,80}$/;
const FIELD_LITERAL_PATTERN = /^[0-9]+field$/;

const ruleByField: Record<string, DemoVaultRuleId> = {
  "1field": "vault-accounting-safety",
  "2field": "claims-vs-deposits",
  "3field": "reward-reserve-safety",
  "4field": "withdraw-limit-safety",
};

const statusByLiteral: Record<string, OnChainBountyState["status"]> = {
  "1u8": "Active",
  "2u8": "Paused",
  "3u8": "Closed",
};

const requiredFields = [
  "owner_address",
  "scope_hash",
  "rule_id",
  "critical_reward",
  "high_reward",
  "medium_reward",
  "low_reward",
  "disclosure_deadline",
  "status",
] as const;

function parseStructFields(raw: string) {
  const normalized = raw.trim();
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) {
    throw new Error("Aleo bounty mapping returned an invalid struct");
  }

  const values = new Map<string, string>();
  const body = normalized.slice(1, -1).trim();
  for (const entry of body.split(",")) {
    const separator = entry.indexOf(":");
    if (separator <= 0) {
      throw new Error("Aleo bounty mapping contains an invalid field");
    }
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (!requiredFields.includes(key as (typeof requiredFields)[number]) || values.has(key) || !value) {
      throw new Error("Aleo bounty mapping contains an unexpected field");
    }
    values.set(key, value);
  }

  if (values.size !== requiredFields.length || requiredFields.some((key) => !values.has(key))) {
    throw new Error("Aleo bounty mapping is missing required fields");
  }
  return values;
}

function parseUnsignedLiteral(value: string, suffix: "u64" | "u32") {
  const match = value.match(new RegExp(`^([0-9]+)${suffix}$`));
  if (!match) throw new Error(`Invalid Aleo ${suffix} literal`);
  return match[1];
}

function normalizeMappingResponse(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Aleo bounty mapping returned an empty response");
  if (!trimmed.startsWith('"')) return trimmed;
  const parsed: unknown = JSON.parse(trimmed);
  if (typeof parsed !== "string") throw new Error("Aleo bounty mapping returned an invalid response");
  return parsed;
}

export function isAleoFieldLiteral(value: string) {
  return FIELD_LITERAL_PATTERN.test(value);
}

export function getAleoBountyRegistryConfig(
  env: Record<string, string | undefined> = process.env,
): AleoBountyRegistryConfig {
  const programId = env.ALEO_PROGRAM_ID?.trim() || CANONICAL_ALEO_PROGRAM_ID;
  if (!ALEO_PROGRAM_ID_PATTERN.test(programId)) {
    throw new Error("ALEO_PROGRAM_ID is invalid");
  }
  if (programId !== CANONICAL_ALEO_PROGRAM_ID) {
    throw new Error("ALEO_PROGRAM_ID does not match the canonical Leo Program ID");
  }
  if ((env.ALEO_NETWORK ?? "testnet") !== "testnet") {
    throw new Error("Only Aleo testnet is supported by this registry client");
  }

  const endpoint = (env.ALEO_API_ENDPOINT ?? DEFAULT_ALEO_API_ENDPOINT).replace(/\/$/, "");
  const parsedEndpoint = new URL(endpoint);
  if (parsedEndpoint.protocol !== "https:") {
    throw new Error("ALEO_API_ENDPOINT must use HTTPS");
  }
  return { endpoint, network: "testnet", programId };
}

export function parseOnChainBountyState(
  raw: string,
  bountyId: string,
  config: AleoBountyRegistryConfig,
): OnChainBountyState {
  if (!isAleoFieldLiteral(bountyId)) throw new Error("Invalid Aleo bounty ID");
  const fields = parseStructFields(normalizeMappingResponse(raw));
  const owner = fields.get("owner_address")!;
  const scopeHash = fields.get("scope_hash")!;
  const ruleLiteral = fields.get("rule_id")!;
  const deadlineLiteral = parseUnsignedLiteral(fields.get("disclosure_deadline")!, "u32");
  const statusLiteral = fields.get("status")!;

  if (!ALEO_ADDRESS_PATTERN.test(owner) || !FIELD_LITERAL_PATTERN.test(scopeHash)) {
    throw new Error("Aleo bounty mapping contains invalid public identifiers");
  }
  const ruleId = ruleByField[ruleLiteral];
  const status = statusByLiteral[statusLiteral];
  if (!ruleId || !status) throw new Error("Aleo bounty mapping contains an unsupported enum value");

  const bounty: OnChainBountyState = {
    bountyId,
    owner,
    scopeHash,
    ruleId,
    rewards: {
      critical: parseUnsignedLiteral(fields.get("critical_reward")!, "u64"),
      high: parseUnsignedLiteral(fields.get("high_reward")!, "u64"),
      medium: parseUnsignedLiteral(fields.get("medium_reward")!, "u64"),
      low: parseUnsignedLiteral(fields.get("low_reward")!, "u64"),
    },
    disclosureDeadline: Number(deadlineLiteral),
    status,
    source: "AleoTestnet",
    network: config.network,
    programId: config.programId,
    mapping: BOUNTY_MAPPING_NAME,
  };
  assertNoPrivateFields(bounty);
  return bounty;
}

export async function fetchOnChainBountyState(
  bountyId: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  if (!isAleoFieldLiteral(bountyId)) throw new Error("Invalid Aleo bounty ID");
  const url = `${config.endpoint}/${config.network}/program/${encodeURIComponent(config.programId)}/mapping/${BOUNTY_MAPPING_NAME}/${encodeURIComponent(bountyId)}`;
  const response = await fetcher(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Aleo registry request failed with HTTP ${response.status}`);
  return parseOnChainBountyState(await response.text(), bountyId, config);
}
