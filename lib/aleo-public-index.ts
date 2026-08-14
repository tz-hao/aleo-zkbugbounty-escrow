import {
  ALEO_TRANSACTION_ID_PATTERN,
  parseCreateBountyTransitionInputs,
  type TransactionFetch,
} from "./aleo-create-bounty-acceptance.ts";
import {
  fetchOnChainBountyState,
  getAleoBountyRegistryConfig,
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
} from "./aleo-bounty-registry.ts";
import { fetchOnChainClaimReceipt } from "./aleo-claim-receipt-registry.ts";
import { fetchOnChainNullifierState } from "./aleo-nullifier-registry.ts";
import {
  fetchOnChainBountyV3Config,
  type OnChainBountyV3Config,
} from "./aleo-v3-registry.ts";
import {
  CANONICAL_ALEO_PROGRAM_ID,
} from "./aleo-program.ts";
import type {
  DemoVaultRuleId,
  OnChainBountyState,
  OnChainClaimReceipt,
  OnChainNullifierState,
} from "./models.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";

export const ALEO_PUBLIC_INDEX_RPC_ENDPOINT = "https://testnetbeta.aleorpc.com";
export const ALEO_PUBLIC_INDEX_EXPLORER_ENDPOINT = "https://api.provable.com/v2/testnet";
export const PUBLIC_INDEX_MAX_PAGE_SIZE = 50;

export type AleoPublicIndexConfig = {
  rpcEndpoint: string;
  explorerEndpoint: string;
  registry: AleoBountyRegistryConfig;
};

export type MappingVerificationStatus = "Verified" | "Missing" | "Mismatch" | "Unavailable";

export type IndexedBounty = {
  transactionId: string;
  transactionStatus: "Accepted";
  mappingStatus: MappingVerificationStatus;
  protocolVersion: 1 | 3;
  bountyId: string;
  bounty?: OnChainBountyState;
  v3Config?: OnChainBountyV3Config;
};

export type IndexedClaim = {
  transactionId: string;
  transactionStatus: "Accepted";
  mappingStatus: MappingVerificationStatus;
  claimHash: string;
  bountyId: string;
  nullifier: string;
  receipt?: OnChainClaimReceipt;
  nullifierState?: OnChainNullifierState;
};

export type AleoPublicIndexPage =
  | {
      kind: "bounties";
      page: number;
      limit: number;
      hasMore: boolean;
      source: "AleoRpcDiscovery" | "ProvableExplorerDiscovery";
      authority: "AleoMappings";
      items: IndexedBounty[];
    }
  | {
      kind: "claims";
      page: number;
      limit: number;
      hasMore: boolean;
      source: "AleoRpcDiscovery" | "ProvableExplorerDiscovery";
      authority: "AleoMappings";
      items: IndexedClaim[];
    };

type BountyDiscovery = {
  transactionId: string;
  publicInputs: ReturnType<typeof parseCreateBountyTransitionInputs>;
  protocolVersion: 1 | 3;
  v3Policy?: BountyV3PolicyDiscovery;
};

type BountyV3PolicyDiscovery = {
  disclosureKeyCommitment: string;
  targetSystemCommitment: string;
  targetCodeHash: string;
  panelId: string;
  arbiters: readonly [string, string, string];
  quorum: 2 | 3;
  reviewWindowBlocks: number;
  decisionWindowBlocks: number;
  arbitrationFeeMicrocredits: string;
  paymentCondition: "OnReproduction" | "OnPatchAcceptance";
};

type ClaimDiscovery = {
  transactionId: string;
  bountyId: string;
  scopeHash: string;
  ruleId: DemoVaultRuleId;
  claimHash: string;
  witnessCommitment: string;
  nullifier: string;
  reporterCommitment: string;
  severity: OnChainClaimReceipt["severity"];
};

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

type BountyProgramFunctionName = "create_bounty" | "create_bounty_v3";
type ClaimProgramFunctionName = "submit_claim" | "submit_claim_v2";
type IndexedProgramFunctionName = BountyProgramFunctionName | ClaimProgramFunctionName;

const BOUNTY_PROGRAM_FUNCTIONS: readonly BountyProgramFunctionName[] = [
  "create_bounty_v3",
  "create_bounty",
];

const CLAIM_PROGRAM_FUNCTIONS: readonly ClaimProgramFunctionName[] = [
  "submit_claim",
  "submit_claim_v2",
];

const MAPPING_VERIFICATION_CONCURRENCY = 3;
const PUBLIC_INDEX_RPC_ATTEMPTS = 2;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Aleo public index ${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`Aleo public index ${label} is invalid`);
  return value;
}

function publicValue(entry: unknown, label: string) {
  const value = asRecord(entry, label);
  if (value.type !== "public" || typeof value.value !== "string") {
    throw new Error(`Aleo public index ${label} must be public`);
  }
  return value.value;
}

function canonicalTransition(entry: unknown, functionName: IndexedProgramFunctionName) {
  const confirmed = asRecord(entry, "transaction entry");
  if (confirmed.status !== "accepted" || confirmed.type !== "execute") {
    throw new Error("Aleo public index transaction is not accepted");
  }
  const transaction = asRecord(confirmed.transaction, "transaction");
  if (transaction.type !== "execute" || typeof transaction.id !== "string") {
    throw new Error("Aleo public index transaction payload is invalid");
  }
  if (!ALEO_TRANSACTION_ID_PATTERN.test(transaction.id)) {
    throw new Error("Aleo public index transaction ID is invalid");
  }
  const execution = asRecord(transaction.execution, "execution");
  const matches = asArray(execution.transitions, "transitions")
    .map((transition) => asRecord(transition, "transition"))
    .filter(
      (transition) =>
        transition.program === CANONICAL_ALEO_PROGRAM_ID &&
        transition.function === functionName,
    );
  if (matches.length !== 1) {
    throw new Error(`Aleo public index requires one canonical ${functionName} transition`);
  }
  return { transactionId: transaction.id, transition: matches[0] };
}

function parseFlatStruct(raw: string, expectedFields: readonly string[]) {
  const normalized = raw.trim();
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) {
    throw new Error("Aleo public output is not a struct");
  }
  const fields = new Map<string, string>();
  for (const entry of normalized.slice(1, -1).split(",")) {
    const separator = entry.indexOf(":");
    if (separator <= 0) throw new Error("Aleo public output contains an invalid field");
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (!expectedFields.includes(key) || fields.has(key) || !value) {
      throw new Error("Aleo public output contains an unexpected field");
    }
    fields.set(key, value);
  }
  if (fields.size !== expectedFields.length || expectedFields.some((field) => !fields.has(field))) {
    throw new Error("Aleo public output is missing fields");
  }
  return fields;
}

const ALEO_ADDRESS_PATTERN = /^aleo1[0-9a-z]{58}$/;
const MAX_U8 = (1n << 8n) - 1n;
const MAX_U32 = (1n << 32n) - 1n;
const MAX_U64 = (1n << 64n) - 1n;
const BOUNTY_V3_POLICY_FIELDS = [
  "disclosure_key_commitment",
  "target_system_commitment",
  "target_code_hash",
  "panel_id",
  "arbiter_one",
  "arbiter_two",
  "arbiter_three",
  "quorum",
  "review_window_blocks",
  "decision_window_blocks",
  "arbitration_fee_microcredits",
  "payment_condition",
] as const;

function parseUnsignedPublicLiteral(value: string, suffix: "u8" | "u32" | "u64", label: string) {
  const match = value.match(new RegExp(`^([0-9]+)${suffix}$`));
  if (!match) throw new Error(`Aleo ${label} is invalid`);
  const parsed = BigInt(match[1]);
  const maximum = suffix === "u8" ? MAX_U8 : suffix === "u32" ? MAX_U32 : MAX_U64;
  if (parsed > maximum) throw new Error(`Aleo ${label} is out of range`);
  return parsed;
}

function parseBountyV3Policy(raw: string): BountyV3PolicyDiscovery {
  const fields = parseFlatStruct(raw, BOUNTY_V3_POLICY_FIELDS);
  const fieldLiteral = (name: (typeof BOUNTY_V3_POLICY_FIELDS)[number]) => {
    const value = fields.get(name)!;
    if (!isAleoFieldLiteral(value)) throw new Error(`Aleo Bounty V3 ${name} is invalid`);
    return value;
  };
  const arbiters = [
    fields.get("arbiter_one")!,
    fields.get("arbiter_two")!,
    fields.get("arbiter_three")!,
  ] as const;
  if (arbiters.some((arbiter) => !ALEO_ADDRESS_PATTERN.test(arbiter)) || new Set(arbiters).size !== 3) {
    throw new Error("Aleo Bounty V3 arbiters are invalid");
  }
  const quorum = Number(parseUnsignedPublicLiteral(fields.get("quorum")!, "u8", "Bounty V3 quorum"));
  const reviewWindowBlocks = Number(
    parseUnsignedPublicLiteral(fields.get("review_window_blocks")!, "u32", "Bounty V3 review window"),
  );
  const decisionWindowBlocks = Number(
    parseUnsignedPublicLiteral(fields.get("decision_window_blocks")!, "u32", "Bounty V3 decision window"),
  );
  const arbitrationFeeMicrocredits = parseUnsignedPublicLiteral(
    fields.get("arbitration_fee_microcredits")!,
    "u64",
    "Bounty V3 arbitration fee",
  );
  const paymentCondition = Number(
    parseUnsignedPublicLiteral(fields.get("payment_condition")!, "u8", "Bounty V3 payment condition"),
  );
  if (
    (quorum !== 2 && quorum !== 3) ||
    !Number.isSafeInteger(reviewWindowBlocks) ||
    !Number.isSafeInteger(decisionWindowBlocks) ||
    (paymentCondition !== 1 && paymentCondition !== 2)
  ) {
    throw new Error("Aleo Bounty V3 policy is unsupported");
  }
  return {
    disclosureKeyCommitment: fieldLiteral("disclosure_key_commitment"),
    targetSystemCommitment: fieldLiteral("target_system_commitment"),
    targetCodeHash: fieldLiteral("target_code_hash"),
    panelId: fieldLiteral("panel_id"),
    arbiters,
    quorum: quorum as 2 | 3,
    reviewWindowBlocks,
    decisionWindowBlocks,
    arbitrationFeeMicrocredits: arbitrationFeeMicrocredits.toString(),
    paymentCondition: paymentCondition === 1 ? "OnReproduction" : "OnPatchAcceptance",
  };
}

export function parseIndexedBountyTransaction(
  entry: unknown,
  functionName: BountyProgramFunctionName = "create_bounty",
): BountyDiscovery {
  const { transactionId, transition } = canonicalTransition(entry, functionName);
  if (functionName === "create_bounty") {
    const result: BountyDiscovery = {
      transactionId,
      publicInputs: parseCreateBountyTransitionInputs(transition),
      protocolVersion: 1,
    };
    assertNoPrivateFields(result);
    return result;
  }
  const inputs = asArray(transition.inputs, "create_bounty_v3 inputs");
  if (inputs.length !== 9) throw new Error("Aleo create_bounty_v3 input count mismatch");
  const result: BountyDiscovery = {
    transactionId,
    publicInputs: parseCreateBountyTransitionInputs({ ...transition, inputs: inputs.slice(0, 8) }),
    protocolVersion: 3,
    v3Policy: parseBountyV3Policy(publicValue(inputs[8], "create_bounty_v3 policy")),
  };
  assertNoPrivateFields(result);
  return result;
}

export function parseIndexedClaimTransaction(
  entry: unknown,
  functionName: ClaimProgramFunctionName = "submit_claim",
): ClaimDiscovery {
  const { transactionId, transition } = canonicalTransition(entry, functionName);
  const inputs = asArray(transition.inputs, functionName + " inputs");
  if (inputs.length !== 16) throw new Error("Aleo " + functionName + " input count mismatch");
  const bountyId = publicValue(inputs[0], "bounty ID");
  const scopeHash = publicValue(inputs[1], "scope hash");
  const ruleField = publicValue(inputs[2], "rule ID");
  if (!isAleoFieldLiteral(bountyId) || !isAleoFieldLiteral(scopeHash)) {
    throw new Error("Aleo " + functionName + " public identifiers are invalid");
  }
  for (const input of inputs.slice(3)) {
    if (asRecord(input, "private " + functionName + " input").type !== "private") {
      throw new Error("Aleo " + functionName + " witness inputs must remain private");
    }
  }

  const outputs = asArray(transition.outputs, functionName + " outputs");
  const publicOutputs = outputs.filter(
    (output) => asRecord(output, functionName + " output").type === "public",
  );
  if (publicOutputs.length !== 1) {
    throw new Error("Aleo " + functionName + " must have one public proof output");
  }
  const proof = parseFlatStruct(publicValue(publicOutputs[0], "proof output"), [
    "verified",
    "severity",
    "claim_hash",
    "witness_commitment",
    "nullifier",
    "reporter_commitment",
    "bug_type_id",
    "rule_id",
  ]);
  const ruleId = ruleByField[ruleField];
  const severity = severityByLiteral[proof.get("severity")!];
  if (
    !ruleId ||
    !severity ||
    proof.get("verified") !== "true" ||
    proof.get("rule_id") !== ruleField ||
    proof.get("bug_type_id") !== ruleField
  ) {
    throw new Error("Aleo " + functionName + " proof output is unsupported");
  }
  for (const key of ["claim_hash", "witness_commitment", "nullifier", "reporter_commitment"] as const) {
    if (!isAleoFieldLiteral(proof.get(key)!)) {
      throw new Error("Aleo " + functionName + " " + key + " is invalid");
    }
  }
  const result: ClaimDiscovery = {
    transactionId,
    bountyId,
    scopeHash,
    ruleId,
    claimHash: proof.get("claim_hash")!,
    witnessCommitment: proof.get("witness_commitment")!,
    nullifier: proof.get("nullifier")!,
    reporterCommitment: proof.get("reporter_commitment")!,
    severity,
  };
  assertNoPrivateFields(result);
  return result;
}

export function getAleoPublicIndexConfig(
  env: Record<string, string | undefined> = process.env,
): AleoPublicIndexConfig {
  const registry = getAleoBountyRegistryConfig(env);
  const rpcEndpoint = (env.ALEO_RPC_ENDPOINT ?? ALEO_PUBLIC_INDEX_RPC_ENDPOINT).replace(/\/$/, "");
  const explorerEndpoint = (
    env.ALEO_PUBLIC_INDEX_EXPLORER_ENDPOINT ?? ALEO_PUBLIC_INDEX_EXPLORER_ENDPOINT
  ).replace(/\/$/, "");
  if (new URL(rpcEndpoint).protocol !== "https:") {
    throw new Error("ALEO_RPC_ENDPOINT must use HTTPS");
  }
  if (new URL(explorerEndpoint).protocol !== "https:") {
    throw new Error("ALEO_PUBLIC_INDEX_EXPLORER_ENDPOINT must use HTTPS");
  }
  return { rpcEndpoint, explorerEndpoint, registry };
}

function validatePagination(page: number, limit: number) {
  if (!Number.isSafeInteger(page) || page < 0) throw new Error("Invalid public index page");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > PUBLIC_INDEX_MAX_PAGE_SIZE) {
    throw new Error("Invalid public index page size");
  }
}

export async function fetchProgramTransactionPage(
  functionName: IndexedProgramFunctionName,
  page: number,
  limit: number,
  config: AleoPublicIndexConfig,
  fetcher: TransactionFetch = fetch,
) {
  validatePagination(page, limit);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= PUBLIC_INDEX_RPC_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetcher(config.rpcEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(4_000),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "zkbb-public-index",
          method: "aleoTransactionsForProgram",
          params: {
            programId: CANONICAL_ALEO_PROGRAM_ID,
            functionName,
            page,
            maxTransactions: limit,
          },
        }),
      });
      if (!response.ok) {
        if (response.status !== 429 && response.status < 500) {
          throw new Error(`Aleo public index failed with HTTP ${response.status}`);
        }
        lastError = new Error(`Aleo public index failed with HTTP ${response.status}`);
      } else {
        const payload = asRecord(await response.json(), "RPC response");
        if (payload.error !== undefined) throw new Error("Aleo public index RPC returned an error");
        return asArray(payload.result, "RPC result");
      }
    } catch (error) {
      if (error instanceof Error) lastError = error;
      else lastError = new Error("Aleo public index request failed");
    }

    if (attempt < PUBLIC_INDEX_RPC_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw lastError ?? new Error("Aleo public index request failed");
}
type ProgramTransactionDiscovery = {
  entries: unknown[];
  hasMore: boolean;
  source: "AleoRpcDiscovery" | "ProvableExplorerDiscovery";
};

async function fetchExplorerProgramTransactionPage(
  functionName: IndexedProgramFunctionName,
  page: number,
  limit: number,
  config: AleoPublicIndexConfig,
  fetcher: TransactionFetch,
): Promise<ProgramTransactionDiscovery> {
  const latestCallsResponse = await fetcher(
    `${config.explorerEndpoint}/programs/${encodeURIComponent(CANONICAL_ALEO_PROGRAM_ID)}/latest-calls`,
    {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!latestCallsResponse.ok) {
    throw new Error(`Provable Explorer latest calls failed with HTTP ${latestCallsResponse.status}`);
  }
  const calls = asArray(await latestCallsResponse.json(), "Provable Explorer latest calls");
  const matchingCalls = calls.filter((call) => {
    const value = asRecord(call, "Provable Explorer call");
    return (
      value.function_id === functionName &&
      typeof value.status === "string" &&
      value.status.toLowerCase() === "accepted" &&
      typeof value.transaction_id === "string" &&
      ALEO_TRANSACTION_ID_PATTERN.test(value.transaction_id)
    );
  });
  const start = page * limit;
  const selectedCalls = matchingCalls.slice(start, start + limit);
  const entries = await mapWithConcurrency(selectedCalls, async (call) => {
    const transactionId = asRecord(call, "Provable Explorer call").transaction_id as string;
    const response = await fetcher(
      `${config.explorerEndpoint}/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      throw new Error(`Provable Explorer transaction failed with HTTP ${response.status}`);
    }
    const transaction = asRecord(await response.json(), "Provable Explorer transaction");
    return { status: typeof transaction.status === "string" ? transaction.status.toLowerCase() : transaction.status, type: transaction.type, transaction };
  });
  return {
    entries,
    hasMore: start + selectedCalls.length < matchingCalls.length,
    source: "ProvableExplorerDiscovery",
  };
}

async function fetchPublicProgramTransactionPage(
  functionName: IndexedProgramFunctionName,
  page: number,
  limit: number,
  config: AleoPublicIndexConfig,
  fetcher: TransactionFetch,
): Promise<ProgramTransactionDiscovery> {
  try {
    return {
      entries: await fetchProgramTransactionPage(functionName, page, limit, config, fetcher),
      hasMore: false,
      source: "AleoRpcDiscovery",
    };
  } catch {
    return fetchExplorerProgramTransactionPage(functionName, page, limit, config, fetcher);
  }
}
async function fetchPublicProgramTransactionsThroughPage(
  functionName: IndexedProgramFunctionName,
  page: number,
  limit: number,
  config: AleoPublicIndexConfig,
  fetcher: TransactionFetch,
): Promise<ProgramTransactionDiscovery> {
  const discoveries = await Promise.all(
    Array.from({ length: page + 1 }, (_, currentPage) =>
      fetchPublicProgramTransactionPage(functionName, currentPage, limit, config, fetcher),
    ),
  );
  const transactionIds = new Set<string>();
  const entries = discoveries.flatMap((discovery) =>
    discovery.entries.filter((entry) => {
      const transactionId = asRecord(asRecord(entry, "transaction entry").transaction, "transaction").id;
      if (typeof transactionId !== "string" || transactionIds.has(transactionId)) return false;
      transactionIds.add(transactionId);
      return true;
    }),
  );
  const latestPage = discoveries.at(-1)!;
  return {
    entries,
    hasMore: latestPage.hasMore,
    source: discoveries.every((discovery) => discovery.source === "AleoRpcDiscovery")
      ? "AleoRpcDiscovery"
      : "ProvableExplorerDiscovery",
  };
}
function bountyMatchesDiscovery(bounty: OnChainBountyState, discovery: BountyDiscovery) {
  const expected = discovery.publicInputs;
  return Boolean(
    bounty.bountyId === expected.bountyId &&
      bounty.scopeHash === expected.scopeHash &&
      bounty.ruleId === expected.ruleId &&
      bounty.rewards.critical === expected.criticalReward &&
      bounty.rewards.high === expected.highReward &&
      bounty.rewards.medium === expected.mediumReward &&
      bounty.rewards.low === expected.lowReward &&
      bounty.disclosureDeadline === expected.disclosureDeadline,
  );
}

function bountyV3ConfigMatchesDiscovery(
  config: OnChainBountyV3Config,
  discovery: BountyDiscovery,
) {
  const policy = discovery.v3Policy;
  return Boolean(
    policy &&
      config.bountyId === discovery.publicInputs.bountyId &&
      config.disclosureKeyCommitment === policy.disclosureKeyCommitment &&
      config.targetSystemCommitment === policy.targetSystemCommitment &&
      config.targetCodeHash === policy.targetCodeHash &&
      config.panelId === policy.panelId &&
      config.arbiters[0] === policy.arbiters[0] &&
      config.arbiters[1] === policy.arbiters[1] &&
      config.arbiters[2] === policy.arbiters[2] &&
      config.quorum === policy.quorum &&
      config.reviewWindowBlocks === policy.reviewWindowBlocks &&
      config.decisionWindowBlocks === policy.decisionWindowBlocks &&
      config.arbitrationFeeMicrocredits === policy.arbitrationFeeMicrocredits &&
      config.paymentCondition === policy.paymentCondition,
  );
}

function claimMatchesDiscovery(
  receipt: OnChainClaimReceipt,
  nullifierState: OnChainNullifierState,
  discovery: ClaimDiscovery,
) {
  return Boolean(
    receipt.claimHash === discovery.claimHash &&
      receipt.bountyId === discovery.bountyId &&
      receipt.scopeHash === discovery.scopeHash &&
      receipt.ruleId === discovery.ruleId &&
      receipt.severity === discovery.severity &&
      receipt.witnessCommitment === discovery.witnessCommitment &&
      receipt.nullifier === discovery.nullifier &&
      receipt.reporterCommitment === discovery.reporterCommitment &&
      nullifierState.nullifier === discovery.nullifier &&
      nullifierState.bountyId === discovery.bountyId,
  );
}

async function mapWithConcurrency<Input, Output>(
  values: readonly Input[],
  mapper: (value: Input) => Promise<Output>,
  concurrency = MAPPING_VERIFICATION_CONCURRENCY,
) {
  const results = new Array<Output>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(values[currentIndex]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
export async function listIndexedBounties(
  page: number,
  limit: number,
  config: AleoPublicIndexConfig,
  fetcher: TransactionFetch = fetch,
): Promise<AleoPublicIndexPage> {
  const settled = await Promise.allSettled(
    BOUNTY_PROGRAM_FUNCTIONS.map(async (functionName) => ({
      functionName,
      discovery: await fetchPublicProgramTransactionsThroughPage(
        functionName,
        page,
        limit,
        config,
        fetcher,
      ),
    })),
  );
  const sources = settled
    .filter(
      (result): result is PromiseFulfilledResult<{
        functionName: BountyProgramFunctionName;
        discovery: ProgramTransactionDiscovery;
      }> => result.status === "fulfilled",
    )
    .map((result) => result.value);
  if (sources.length === 0) {
    throw new Error("Aleo public Bounty index is temporarily unavailable");
  }
  const seenTransactionIds = new Set<string>();
  const discoveries = sources
    .flatMap(({ functionName, discovery }) =>
      discovery.entries.map((entry) => parseIndexedBountyTransaction(entry, functionName))
    )
    .filter((discovery) => {
      if (seenTransactionIds.has(discovery.transactionId)) return false;
      seenTransactionIds.add(discovery.transactionId);
      return true;
    });
  const items = await mapWithConcurrency(
    discoveries,
    async (discovery): Promise<IndexedBounty> => {
      try {
        const [bounty, v3Config] = await Promise.all([
          fetchOnChainBountyState(discovery.publicInputs.bountyId, config.registry, fetcher),
          discovery.protocolVersion === 3
            ? fetchOnChainBountyV3Config(discovery.publicInputs.bountyId, config.registry, fetcher)
            : Promise.resolve(null),
        ]);
        const baseMappingVerified = Boolean(bounty && bountyMatchesDiscovery(bounty, discovery));
        const v3MappingVerified = discovery.protocolVersion !== 3 ||
          Boolean(v3Config && bountyV3ConfigMatchesDiscovery(v3Config, discovery));
        const mappingStatus = !bounty || (discovery.protocolVersion === 3 && !v3Config)
          ? "Missing"
          : baseMappingVerified && v3MappingVerified
            ? "Verified"
            : "Mismatch";
        const item: IndexedBounty = {
          transactionId: discovery.transactionId,
          transactionStatus: "Accepted",
          mappingStatus,
          protocolVersion: discovery.protocolVersion,
          bountyId: discovery.publicInputs.bountyId,
          ...(mappingStatus === "Verified" && bounty ? { bounty } : {}),
          ...(mappingStatus === "Verified" && v3Config ? { v3Config } : {}),
        };
        assertNoPrivateFields(item);
        return item;
      } catch {
        const item: IndexedBounty = {
          transactionId: discovery.transactionId,
          transactionStatus: "Accepted",
          mappingStatus: "Unavailable",
          protocolVersion: discovery.protocolVersion,
          bountyId: discovery.publicInputs.bountyId,
        };
        assertNoPrivateFields(item);
        return item;
      }
    },
  );
  return {
    kind: "bounties",
    page,
    limit,
    hasMore: sources.some(({ discovery }) =>
      discovery.hasMore ||
      (discovery.source === "AleoRpcDiscovery" && discovery.entries.length === (page + 1) * limit),
    ),
    source: sources.every(({ discovery }) => discovery.source === "AleoRpcDiscovery")
      ? "AleoRpcDiscovery"
      : "ProvableExplorerDiscovery",
    authority: "AleoMappings",
    items: items.slice(page * limit, (page + 1) * limit),
  };
}
export async function listIndexedClaims(
  page: number,
  limit: number,
  config: AleoPublicIndexConfig,
  fetcher: TransactionFetch = fetch,
): Promise<AleoPublicIndexPage> {
  const settled = await Promise.allSettled(
    CLAIM_PROGRAM_FUNCTIONS.map(async (functionName) => ({
      functionName,
      discovery: await fetchPublicProgramTransactionsThroughPage(
        functionName,
        page,
        limit,
        config,
        fetcher,
      ),
    })),
  );
  const sources = settled
    .filter(
      (result): result is PromiseFulfilledResult<{
        functionName: ClaimProgramFunctionName;
        discovery: ProgramTransactionDiscovery;
      }> => result.status === "fulfilled",
    )
    .map((result) => result.value);
  if (sources.length === 0) {
    throw new Error("Aleo public Claim index is temporarily unavailable");
  }

  const seenTransactionIds = new Set<string>();
  const discoveries = sources
    .flatMap(({ functionName, discovery }) =>
      discovery.entries.map((entry) => parseIndexedClaimTransaction(entry, functionName))
    )
    .filter((discovery) => {
      if (seenTransactionIds.has(discovery.transactionId)) return false;
      seenTransactionIds.add(discovery.transactionId);
      return true;
    });
  const items = await mapWithConcurrency(
    discoveries,
    async (discovery): Promise<IndexedClaim> => {
      try {
        const [receipt, nullifierState] = await Promise.all([
          fetchOnChainClaimReceipt(discovery.claimHash, config.registry, fetcher),
          fetchOnChainNullifierState(discovery.nullifier, config.registry, fetcher),
        ]);
        const mappingStatus = !receipt || !nullifierState
          ? "Missing"
          : claimMatchesDiscovery(receipt, nullifierState, discovery)
            ? "Verified"
            : "Mismatch";
        const item: IndexedClaim = {
          transactionId: discovery.transactionId,
          transactionStatus: "Accepted",
          mappingStatus,
          claimHash: discovery.claimHash,
          bountyId: discovery.bountyId,
          nullifier: discovery.nullifier,
          ...(mappingStatus === "Verified" && receipt && nullifierState
            ? { receipt, nullifierState }
            : {}),
        };
        assertNoPrivateFields(item);
        return item;
      } catch {
        const item: IndexedClaim = {
          transactionId: discovery.transactionId,
          transactionStatus: "Accepted",
          mappingStatus: "Unavailable",
          claimHash: discovery.claimHash,
          bountyId: discovery.bountyId,
          nullifier: discovery.nullifier,
        };
        assertNoPrivateFields(item);
        return item;
      }
    },
  );
  const rankedItems = [...items].sort((left, right) => {
    const leftHeight = left.receipt?.createdHeight ?? -1;
    const rightHeight = right.receipt?.createdHeight ?? -1;
    return rightHeight - leftHeight;
  });
  const start = page * limit;
  const pageItems = rankedItems.slice(start, start + limit);
  const discoveredThroughPage = (page + 1) * limit;
  const source = sources.every(({ discovery }) => discovery.source === "AleoRpcDiscovery")
    ? "AleoRpcDiscovery" as const
    : "ProvableExplorerDiscovery" as const;
  const hasMore = rankedItems.length > start + limit ||
    sources.some(({ discovery }) =>
      discovery.hasMore ||
      (discovery.source === "AleoRpcDiscovery" && discovery.entries.length === discoveredThroughPage),
    );
  return {
    kind: "claims",
    page,
    limit,
    hasMore,
    source,
    authority: "AleoMappings",
    items: pageItems,
  };
}
