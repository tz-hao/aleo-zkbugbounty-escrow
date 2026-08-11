import {
  ALEO_TESTNET_API_ENDPOINT,
  ALEO_TESTNET_EDITION_ONE_UPGRADE,
  ALEO_TESTNET_EXPECTED_EDITION,
  ALEO_TESTNET_NETWORK,
  ALEO_TESTNET_PROGRAM_OWNER,
  CANONICAL_ALEO_PROGRAM_ID,
} from "./aleo-program.ts";

export type PublicChainFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const EDITION_ONE_MAPPING_NAMES = [
  "bounties",
  "bounty_escrows",
  "claim_receipts",
  "claim_payouts",
  "bounty_claim_counts",
  "claim_reporters",
  "claim_triage_states",
  "bounty_protocol_versions",
  "escrow_operation_markers",
  "bounty_v3_configs",
  "claim_v3_evidence",
  "claim_v3_states",
  "claim_v3_payouts",
  "claim_v3_arbitration_tallies",
  "claim_v3_arbitration_votes",
  "v3_operation_markers",
  "claim_v3_acknowledgements",
  "claim_v3_dispute_bonds",
  "claim_v3_project_decisions",
  "claim_v3_dispute_metadata",
] as const;

export type EditionOneMappingName = (typeof EDITION_ONE_MAPPING_NAMES)[number];
export type MappingReadStatus = "FOUND" | "NOT_SET" | "INDEX_DELAY" | "HTTP_ERROR" | "PARSE_ERROR";

export type EditionOneVerifierConfig = {
  endpoint: string;
  programId: string;
  upgradeTransactionId: string;
  feeTransactionId: string;
  adminAddress: string;
  expectedEdition: number;
};

export const DEFAULT_EDITION_ONE_VERIFIER_CONFIG: EditionOneVerifierConfig = {
  endpoint: ALEO_TESTNET_API_ENDPOINT,
  programId: CANONICAL_ALEO_PROGRAM_ID,
  upgradeTransactionId: ALEO_TESTNET_EDITION_ONE_UPGRADE.transactionId,
  feeTransactionId: ALEO_TESTNET_EDITION_ONE_UPGRADE.feeTransactionId,
  adminAddress: ALEO_TESTNET_PROGRAM_OWNER,
  expectedEdition: ALEO_TESTNET_EXPECTED_EDITION,
};

export type EditionOneVerification = {
  programId: string;
  network: "testnet";
  expectedEdition: number;
  observedEdition: number | null;
  programSourceFound: boolean;
  upgradeTransactionFound: boolean;
  upgradeTransactionType: string | null;
  deploymentEdition: number | null;
  ownerAddressMatch: boolean;
  publicBalanceMicrocredits: string | null;
  feeIndexStatus: "FOUND" | "INDEX_UNAVAILABLE" | "HTTP_ERROR";
  upgradeStatus: "confirmed" | "unavailable" | "invalid";
  overallVerification: "PASS" | "FAIL";
};

export type PublicMappingVerification = {
  mapping: EditionOneMappingName;
  key: string;
  status: MappingReadStatus;
  httpStatus: number | null;
  valuePreview: string | null;
};

function endpointUrl(config: EditionOneVerifierConfig, path: string) {
  return `${config.endpoint.replace(/\/$/, "")}/${ALEO_TESTNET_NETWORK}/${path}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readProgramIdFromSource(source: unknown, programId: string) {
  return typeof source === "string" && source.includes(`program ${programId}`);
}

function parseMicrocredits(value: string) {
  const match = value.trim().match(/^"?([0-9]+)u64"?$/);
  return match?.[1] ?? null;
}

function requestInit(): RequestInit {
  return {
    method: "GET",
    headers: { accept: "application/json", "cache-control": "no-cache", pragma: "no-cache" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  };
}

export async function verifyTestnetEditionOne(
  config: EditionOneVerifierConfig = DEFAULT_EDITION_ONE_VERIFIER_CONFIG,
  fetcher: PublicChainFetch = fetch,
): Promise<EditionOneVerification> {
  const programUrl = endpointUrl(config, `program/${encodeURIComponent(config.programId)}`);
  const editionUrl = endpointUrl(config, `program/${encodeURIComponent(config.programId)}/latest_edition`);
  const upgradeUrl = endpointUrl(config, `transaction/${encodeURIComponent(config.upgradeTransactionId)}`);
  const balanceUrl = endpointUrl(config, `program/credits.aleo/mapping/account/${encodeURIComponent(config.adminAddress)}`);
  const feeUrl = endpointUrl(config, `transaction/${encodeURIComponent(config.feeTransactionId)}`);
  const [programResult, editionResult, upgradeResult, balanceResult, feeResult] = await Promise.allSettled([
    fetcher(programUrl, requestInit()),
    fetcher(editionUrl, requestInit()),
    fetcher(upgradeUrl, requestInit()),
    fetcher(balanceUrl, requestInit()),
    fetcher(feeUrl, requestInit()),
  ]);

  const programSourceFound = programResult.status === "fulfilled" && programResult.value.ok
    ? readProgramIdFromSource(await programResult.value.text(), config.programId)
    : false;
  const rawEdition = editionResult.status === "fulfilled" && editionResult.value.ok
    ? Number(await editionResult.value.text())
    : null;
  const observedEdition = Number.isSafeInteger(rawEdition) && rawEdition !== null && rawEdition >= 0 ? rawEdition : null;

  let upgradeTransactionFound = false;
  let upgradeTransactionType: string | null = null;
  let deploymentEdition: number | null = null;
  let ownerAddressMatch = false;
  let upgradeProgramMatches = false;
  if (upgradeResult.status === "fulfilled" && upgradeResult.value.ok) {
    const transaction = asRecord(await upgradeResult.value.json().catch(() => null));
    const deployment = asRecord(transaction?.deployment);
    const owner = asRecord(transaction?.owner);
    upgradeTransactionFound = transaction?.id === config.upgradeTransactionId;
    upgradeTransactionType = typeof transaction?.type === "string" ? transaction.type : null;
    deploymentEdition = typeof deployment?.edition === "number" ? deployment.edition : null;
    ownerAddressMatch = owner?.address === config.adminAddress && deployment?.program_owner === config.adminAddress;
    upgradeProgramMatches = readProgramIdFromSource(deployment?.program, config.programId);
  }
  const upgradeConfirmed = upgradeTransactionFound && upgradeTransactionType === "deploy" && deploymentEdition === config.expectedEdition && ownerAddressMatch && upgradeProgramMatches;
  const publicBalanceMicrocredits = balanceResult.status === "fulfilled" && balanceResult.value.ok
    ? parseMicrocredits(await balanceResult.value.text())
    : null;
  const feeIndexStatus = feeResult.status === "fulfilled"
    ? feeResult.value.ok ? "FOUND" : feeResult.value.status === 404 ? "INDEX_UNAVAILABLE" : "HTTP_ERROR"
    : "HTTP_ERROR";
  const overallVerification = programSourceFound && observedEdition === config.expectedEdition && upgradeConfirmed ? "PASS" : "FAIL";

  return {
    programId: config.programId,
    network: ALEO_TESTNET_NETWORK,
    expectedEdition: config.expectedEdition,
    observedEdition,
    programSourceFound,
    upgradeTransactionFound,
    upgradeTransactionType,
    deploymentEdition,
    ownerAddressMatch,
    publicBalanceMicrocredits,
    feeIndexStatus,
    upgradeStatus: upgradeConfirmed ? "confirmed" : upgradeTransactionFound ? "invalid" : "unavailable",
    overallVerification,
  };
}

export function isEditionOneMappingName(value: string): value is EditionOneMappingName {
  return (EDITION_ONE_MAPPING_NAMES as readonly string[]).includes(value);
}

export function isAleoFieldKey(value: string) {
  return /^[0-9]+field$/.test(value);
}

export function redactPublicMappingValue(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length <= 96 ? normalized : `${normalized.slice(0, 64)}...${normalized.slice(-24)}`;
}

export async function verifyPublicEditionOneMapping(
  mapping: EditionOneMappingName,
  key: string,
  options: {
    config?: Pick<EditionOneVerifierConfig, "endpoint" | "programId">;
    fetcher?: PublicChainFetch;
    indexDelay?: boolean;
  } = {},
): Promise<PublicMappingVerification> {
  if (!isAleoFieldKey(key)) return { mapping, key, status: "PARSE_ERROR", httpStatus: null, valuePreview: null };
  const endpoint = options.config?.endpoint ?? ALEO_TESTNET_API_ENDPOINT;
  const programId = options.config?.programId ?? CANONICAL_ALEO_PROGRAM_ID;
  try {
    const response = await (options.fetcher ?? fetch)(
      `${endpoint.replace(/\/$/, "")}/${ALEO_TESTNET_NETWORK}/program/${encodeURIComponent(programId)}/mapping/${mapping}/${encodeURIComponent(key)}`,
      requestInit(),
    );
    if (response.status === 404) return { mapping, key, status: options.indexDelay ? "INDEX_DELAY" : "NOT_SET", httpStatus: 404, valuePreview: null };
    if (!response.ok) return { mapping, key, status: "HTTP_ERROR", httpStatus: response.status, valuePreview: null };
    const rawValue = await response.text();
    if (rawValue.trim() === "null" || rawValue.trim() === "\"null\"") {
      return { mapping, key, status: options.indexDelay ? "INDEX_DELAY" : "NOT_SET", httpStatus: response.status, valuePreview: null };
    }
    const valuePreview = redactPublicMappingValue(rawValue);
    return valuePreview
      ? { mapping, key, status: "FOUND", httpStatus: response.status, valuePreview }
      : { mapping, key, status: "PARSE_ERROR", httpStatus: response.status, valuePreview: null };
  } catch {
    return { mapping, key, status: "HTTP_ERROR", httpStatus: null, valuePreview: null };
  }
}