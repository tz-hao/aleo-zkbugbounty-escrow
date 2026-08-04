import {
  CREATE_BOUNTY_FUNCTION,
  getRuleFieldLiteral,
  type CreateBountyPublicInputs,
} from "./aleo-create-bounty.ts";
import {
  ALEO_TESTNET_API_ENDPOINT,
  ALEO_TESTNET_EXPLORER_ENDPOINT,
  CANONICAL_ALEO_PROGRAM_ID,
} from "./aleo-program.ts";
import type { DemoVaultRuleId } from "./models.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";

export const ALEO_TRANSACTION_ID_PATTERN = /^at1[0-9a-z]{50,80}$/;
const ALEO_BLOCK_HASH_PATTERN = /^ab1[0-9a-z]{50,80}$/;

export type TransactionFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type ConfirmedCreateBountyTransaction = {
  status: "Confirmed";
  source: "AleoTestnet";
  network: "testnet";
  programId: typeof CANONICAL_ALEO_PROGRAM_ID;
  functionName: typeof CREATE_BOUNTY_FUNCTION;
  transactionId: string;
  blockHash: string;
  blockHeight: number;
  explorerUrl: string;
  publicInputs: CreateBountyPublicInputs;
};

const ruleIds: DemoVaultRuleId[] = [
  "vault-accounting-safety",
  "claims-vs-deposits",
  "reward-reserve-safety",
  "withdraw-limit-safety",
];

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Aleo ${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`Aleo ${label} is invalid`);
  return value;
}

function parseLiteral(value: unknown, suffix: "field" | "u64" | "u32", label: string) {
  if (typeof value !== "string") throw new Error(`Aleo ${label} is invalid`);
  const match = value.match(new RegExp(`^([0-9]+)${suffix}$`));
  if (!match) throw new Error(`Aleo ${label} is invalid`);
  return match[1];
}

export function parseCreateBountyTransitionInputs(
  transition: Record<string, unknown>,
): CreateBountyPublicInputs {
  const inputs = asArray(transition.inputs, "create_bounty inputs");
  if (inputs.length !== 8) throw new Error("Aleo create_bounty input count mismatch");
  const values = inputs.map((entry, index) => {
    const input = asRecord(entry, `create_bounty input ${index}`);
    if (input.type !== "public") throw new Error("Aleo create_bounty inputs must be public");
    return input.value;
  });
  const bountyId = `${parseLiteral(values[0], "field", "bounty ID")}field`;
  const scopeHash = `${parseLiteral(values[1], "field", "scope hash")}field`;
  const ruleField = `${parseLiteral(values[2], "field", "rule ID")}field`;
  const ruleId = ruleIds.find((candidate) => getRuleFieldLiteral(candidate) === ruleField);
  if (!ruleId) throw new Error("Aleo create_bounty rule is unsupported");
  const deadline = Number(parseLiteral(values[7], "u32", "disclosure deadline"));
  if (!Number.isSafeInteger(deadline)) throw new Error("Aleo disclosure deadline is invalid");
  return {
    bountyId,
    scopeHash,
    ruleId,
    ruleField,
    criticalReward: parseLiteral(values[3], "u64", "Critical reward"),
    highReward: parseLiteral(values[4], "u64", "High reward"),
    mediumReward: parseLiteral(values[5], "u64", "Medium reward"),
    lowReward: parseLiteral(values[6], "u64", "Low reward"),
    disclosureDeadline: deadline,
  };
}

function transactionIdFromConfirmedEntry(value: unknown) {
  const entry = asRecord(value, "confirmed transaction entry");
  const transaction = asRecord(entry.transaction, "confirmed transaction payload");
  return transaction.id;
}

export function parseConfirmedCreateBountyTransaction(
  confirmedValue: unknown,
  blockValue: unknown,
  expectedTransactionId: string,
  expectedBlockHash: string,
): ConfirmedCreateBountyTransaction {
  if (!ALEO_TRANSACTION_ID_PATTERN.test(expectedTransactionId)) {
    throw new Error("Invalid Aleo transaction ID");
  }
  if (!ALEO_BLOCK_HASH_PATTERN.test(expectedBlockHash)) {
    throw new Error("Invalid Aleo block hash");
  }
  const confirmed = asRecord(confirmedValue, "confirmed transaction");
  if (confirmed.type !== "execute" || confirmed.status !== "accepted") {
    throw new Error("Aleo transaction is not an accepted execution");
  }
  const transaction = asRecord(confirmed.transaction, "transaction");
  if (transaction.id !== expectedTransactionId || transaction.type !== "execute") {
    throw new Error("Aleo transaction identity mismatch");
  }
  const execution = asRecord(transaction.execution, "execution");
  const transitions = asArray(execution.transitions, "execution transitions");
  const matchingTransitions = transitions
    .map((entry) => asRecord(entry, "transition"))
    .filter(
      (transition) =>
        transition.program === CANONICAL_ALEO_PROGRAM_ID &&
        transition.function === CREATE_BOUNTY_FUNCTION,
    );
  if (matchingTransitions.length !== 1) {
    throw new Error("Aleo transaction does not contain one canonical create_bounty transition");
  }

  const block = asRecord(blockValue, "block");
  if (block.block_hash !== expectedBlockHash) throw new Error("Aleo block hash mismatch");
  const header = asRecord(block.header, "block header");
  const metadata = asRecord(header.metadata, "block metadata");
  if (!Number.isSafeInteger(metadata.height) || Number(metadata.height) < 0) {
    throw new Error("Aleo block height is invalid");
  }
  const abortedIds = asArray(block.aborted_transaction_ids, "aborted transaction IDs");
  if (abortedIds.includes(expectedTransactionId)) {
    throw new Error("Aleo transaction was aborted");
  }
  const included = asArray(block.transactions, "block transactions").some(
    (entry) => transactionIdFromConfirmedEntry(entry) === expectedTransactionId,
  );
  if (!included) throw new Error("Aleo transaction is not included in the resolved block");

  const result: ConfirmedCreateBountyTransaction = {
    status: "Confirmed",
    source: "AleoTestnet",
    network: "testnet",
    programId: CANONICAL_ALEO_PROGRAM_ID,
    functionName: CREATE_BOUNTY_FUNCTION,
    transactionId: expectedTransactionId,
    blockHash: expectedBlockHash,
    blockHeight: Number(metadata.height),
    explorerUrl: `${ALEO_TESTNET_EXPLORER_ENDPOINT}/transaction/${expectedTransactionId}`,
    publicInputs: parseCreateBountyTransitionInputs(matchingTransitions[0]),
  };
  assertNoPrivateFields(result);
  return result;
}

function requestInit(): RequestInit {
  return {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  };
}

export async function fetchConfirmedCreateBountyTransaction(
  transactionId: string,
  fetcher: TransactionFetch = fetch,
) {
  if (!ALEO_TRANSACTION_ID_PATTERN.test(transactionId)) {
    throw new Error("Invalid Aleo transaction ID");
  }
  const confirmedResponse = await fetcher(
    `${ALEO_TESTNET_API_ENDPOINT}/testnet/transaction/confirmed/${encodeURIComponent(transactionId)}`,
    requestInit(),
  );
  if (confirmedResponse.status === 404) return null;
  if (!confirmedResponse.ok) {
    throw new Error(`Aleo confirmed transaction lookup failed with HTTP ${confirmedResponse.status}`);
  }
  const hashResponse = await fetcher(
    `${ALEO_TESTNET_API_ENDPOINT}/testnet/find/blockHash/${encodeURIComponent(transactionId)}`,
    requestInit(),
  );
  if (!hashResponse.ok) {
    throw new Error(`Aleo block hash lookup failed with HTTP ${hashResponse.status}`);
  }
  const blockHashValue: unknown = await hashResponse.json();
  if (typeof blockHashValue !== "string" || !ALEO_BLOCK_HASH_PATTERN.test(blockHashValue)) {
    throw new Error("Aleo block hash lookup returned an invalid value");
  }
  const blockResponse = await fetcher(
    `${ALEO_TESTNET_API_ENDPOINT}/testnet/block/${encodeURIComponent(blockHashValue)}`,
    requestInit(),
  );
  if (!blockResponse.ok) {
    throw new Error(`Aleo block lookup failed with HTTP ${blockResponse.status}`);
  }
  return parseConfirmedCreateBountyTransaction(
    await confirmedResponse.json(),
    await blockResponse.json(),
    transactionId,
    blockHashValue,
  );
}
