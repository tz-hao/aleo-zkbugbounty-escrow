import type { OnChainNullifierState } from "./models.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";
import {
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "./aleo-bounty-registry.ts";

export const NULLIFIER_MAPPING_NAME = "nullifiers";

function parseMappingValue(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Aleo nullifier mapping returned an empty response");
  if (!trimmed.startsWith('"')) return trimmed;
  const parsed: unknown = JSON.parse(trimmed);
  if (typeof parsed !== "string") {
    throw new Error("Aleo nullifier mapping returned an invalid response");
  }
  return parsed.trim();
}

export function parseOnChainNullifierState(
  raw: string,
  nullifier: string,
  config: AleoBountyRegistryConfig,
): OnChainNullifierState {
  if (!isAleoFieldLiteral(nullifier)) throw new Error("Invalid Aleo nullifier");
  const bountyId = parseMappingValue(raw);
  if (!isAleoFieldLiteral(bountyId)) {
    throw new Error("Aleo nullifier mapping contains an invalid bounty ID");
  }

  const state: OnChainNullifierState = {
    nullifier,
    bountyId,
    used: true,
    source: "AleoTestnet",
    network: config.network,
    programId: config.programId,
    mapping: NULLIFIER_MAPPING_NAME,
  };
  assertNoPrivateFields(state);
  return state;
}

export async function fetchOnChainNullifierState(
  nullifier: string,
  config: AleoBountyRegistryConfig,
  fetcher: RegistryFetch = fetch,
) {
  if (!isAleoFieldLiteral(nullifier)) throw new Error("Invalid Aleo nullifier");
  const url = `${config.endpoint}/${config.network}/program/${encodeURIComponent(config.programId)}/mapping/${NULLIFIER_MAPPING_NAME}/${encodeURIComponent(nullifier)}`;
  const response = await fetcher(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Aleo nullifier registry request failed with HTTP ${response.status}`);
  }
  const raw = await response.text();
  if (raw.trim() === "null") return null;
  return parseOnChainNullifierState(raw, nullifier, config);
}
