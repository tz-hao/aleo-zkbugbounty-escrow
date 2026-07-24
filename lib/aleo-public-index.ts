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
export const PUBLIC_INDEX_MAX_PAGE_SIZE = 50;

export type AleoPublicIndexConfig = {
  rpcEndpoint: string;
  registry: AleoBountyRegistryConfig;
};

export type IndexedBounty = {
  transactionId: string;
  transactionStatus: "Accepted";
  mappingStatus: "Verified" | "Missing" | "Mismatch";
  bountyId: string;
  bounty?: OnChainBountyState;
};

export type IndexedClaim = {
  transactionId: string;
  transactionStatus: "Accepted";
  mappingStatus: "Verified" | "Missing" | "Mismatch";
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
      source: "AleoRpcDiscovery";
      authority: "AleoMappings";
      items: IndexedBounty[];
    }
  | {
      kind: "claims";
      page: number;
      limit: number;
      hasMore: boolean;
      source: "AleoRpcDiscovery";
      authority: "AleoMappings";
      items: IndexedClaim[];
    };

type BountyDiscovery = {
  transactionId: string;
  publicInputs: ReturnType<typeof parseCreateBountyTransitionInputs>;
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

function canonicalTransition(entry: unknown, functionName: "create_bounty" | "submit_claim") {
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

export function parseIndexedBountyTransaction(entry: unknown): BountyDiscovery {
  const { transactionId, transition } = canonicalTransition(entry, "create_bounty");
  const result = {
    transactionId,
    publicInputs: parseCreateBountyTransitionInputs(transition),
  };
  assertNoPrivateFields(result);
  return result;
}

export function parseIndexedClaimTransaction(entry: unknown): ClaimDiscovery {
  const { transactionId, transition } = canonicalTransition(entry, "submit_claim");
  const inputs = asArray(transition.inputs, "submit_claim inputs");
  if (inputs.length !== 16) throw new Error("Aleo submit_claim input count mismatch");
  const bountyId = publicValue(inputs[0], "bounty ID");
  const scopeHash = publicValue(inputs[1], "scope hash");
  const ruleField = publicValue(inputs[2], "rule ID");
  if (!isAleoFieldLiteral(bountyId) || !isAleoFieldLiteral(scopeHash)) {
    throw new Error("Aleo submit_claim public identifiers are invalid");
  }
  for (const input of inputs.slice(3)) {
    if (asRecord(input, "private submit_claim input").type !== "private") {
      throw new Error("Aleo submit_claim witness inputs must remain private");
    }
  }

  const outputs = asArray(transition.outputs, "submit_claim outputs");
  const publicOutputs = outputs.filter((output) => asRecord(output, "submit_claim output").type === "public");
  if (publicOutputs.length !== 1) throw new Error("Aleo submit_claim must have one public proof output");
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
    throw new Error("Aleo submit_claim proof output is unsupported");
  }
  for (const key of ["claim_hash", "witness_commitment", "nullifier", "reporter_commitment"] as const) {
    if (!isAleoFieldLiteral(proof.get(key)!)) {
      throw new Error(`Aleo submit_claim ${key} is invalid`);
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
  if (new URL(rpcEndpoint).protocol !== "https:") {
    throw new Error("ALEO_RPC_ENDPOINT must use HTTPS");
  }
  return { rpcEndpoint, registry };
}

function validatePagination(page: number, limit: number) {
  if (!Number.isSafeInteger(page) || page < 0) throw new Error("Invalid public index page");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > PUBLIC_INDEX_MAX_PAGE_SIZE) {
    throw new Error("Invalid public index page size");
  }
}

export async function fetchProgramTransactionPage(
  functionName: "create_bounty" | "submit_claim",
  page: number,
  limit: number,
  config: AleoPublicIndexConfig,
  fetcher: TransactionFetch = fetch,
) {
  validatePagination(page, limit);
  const response = await fetcher(config.rpcEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
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
  if (!response.ok) throw new Error(`Aleo public index failed with HTTP ${response.status}`);
  const payload = asRecord(await response.json(), "RPC response");
  if (payload.error !== undefined) throw new Error("Aleo public index RPC returned an error");
  return asArray(payload.result, "RPC result");
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

export async function listIndexedBounties(
  page: number,
  limit: number,
  config: AleoPublicIndexConfig,
  fetcher: TransactionFetch = fetch,
): Promise<AleoPublicIndexPage> {
  const entries = await fetchProgramTransactionPage("create_bounty", page, limit, config, fetcher);
  const discoveries = entries.map(parseIndexedBountyTransaction);
  const items = await Promise.all(
    discoveries.map(async (discovery): Promise<IndexedBounty> => {
      const bounty = await fetchOnChainBountyState(
        discovery.publicInputs.bountyId,
        config.registry,
        fetcher,
      );
      const mappingStatus = !bounty
        ? "Missing"
        : bountyMatchesDiscovery(bounty, discovery)
          ? "Verified"
          : "Mismatch";
      const item: IndexedBounty = {
        transactionId: discovery.transactionId,
        transactionStatus: "Accepted",
        mappingStatus,
        bountyId: discovery.publicInputs.bountyId,
        ...(mappingStatus === "Verified" && bounty ? { bounty } : {}),
      };
      assertNoPrivateFields(item);
      return item;
    }),
  );
  return {
    kind: "bounties",
    page,
    limit,
    hasMore: entries.length === limit,
    source: "AleoRpcDiscovery",
    authority: "AleoMappings",
    items,
  };
}

export async function listIndexedClaims(
  page: number,
  limit: number,
  config: AleoPublicIndexConfig,
  fetcher: TransactionFetch = fetch,
): Promise<AleoPublicIndexPage> {
  const entries = await fetchProgramTransactionPage("submit_claim", page, limit, config, fetcher);
  const discoveries = entries.map(parseIndexedClaimTransaction);
  const items = await Promise.all(
    discoveries.map(async (discovery): Promise<IndexedClaim> => {
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
    }),
  );
  return {
    kind: "claims",
    page,
    limit,
    hasMore: entries.length === limit,
    source: "AleoRpcDiscovery",
    authority: "AleoMappings",
    items,
  };
}
