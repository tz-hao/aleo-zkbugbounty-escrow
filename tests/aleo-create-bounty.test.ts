import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  handleCreateBountyTransactionLookup,
  handleTransactionLookupRequest,
} from "../app/api/aleo/transactions/[transactionId]/route.ts";
import {
  assertCreateBountyAbi,
  buildCreateBountyTransaction,
  createScopeFieldHash,
  generateBountyFieldId,
  type CreateBountyDraft,
} from "../lib/aleo-create-bounty.ts";
import {
  fetchConfirmedCreateBountyTransaction,
  parseConfirmedCreateBountyTransaction,
} from "../lib/aleo-create-bounty-acceptance.ts";
import { verifyCreateBountyMapping } from "../lib/aleo-create-bounty-verification.ts";
import { fetchAleoTestnetStatus, parseAleoBlockHeight } from "../lib/aleo-network.ts";
import type { OnChainBountyState } from "../lib/models.ts";
import { assertNoPrivateFields } from "../lib/privacy-guards.ts";
import { readCanonicalLeoSourceAbi } from "./helpers/leo-source-abi.ts";

const transactionId = `at1${"a".repeat(58)}`;
const blockHash = `ab1${"b".repeat(58)}`;
const owner = `aleo1${"c".repeat(58)}`;

const draft: CreateBountyDraft = {
  bountyId: "5001field",
  scopeHash: "6001field",
  ruleId: "vault-accounting-safety",
  criticalReward: "1000",
  highReward: "500",
  mediumReward: "100",
  lowReward: "0",
  disclosureDeadline: 20_000_000,
  feeMicrocredits: 1_000_000,
};

function transition(overrides: Record<string, unknown> = {}) {
  return {
    program: "zkbugbounty_7f3c92.aleo",
    function: "create_bounty",
    inputs: [
      { type: "public", value: "5001field" },
      { type: "public", value: "6001field" },
      { type: "public", value: "1field" },
      { type: "public", value: "1000u64" },
      { type: "public", value: "500u64" },
      { type: "public", value: "100u64" },
      { type: "public", value: "0u64" },
      { type: "public", value: "20000000u32" },
    ],
    ...overrides,
  };
}

function confirmedValue(transitionValue = transition()) {
  return {
    type: "execute",
    status: "accepted",
    transaction: {
      id: transactionId,
      type: "execute",
      execution: { transitions: [transitionValue] },
    },
  };
}

function blockValue(overrides: Record<string, unknown> = {}) {
  return {
    block_hash: blockHash,
    header: { metadata: { height: 19_000_000 } },
    aborted_transaction_ids: [],
    transactions: [{ transaction: { id: transactionId } }],
    ...overrides,
  };
}

const mapping: OnChainBountyState = {
  bountyId: "5001field",
  owner,
  scopeHash: "6001field",
  ruleId: "vault-accounting-safety",
  rewards: { critical: "1000", high: "500", medium: "100", low: "0" },
  disclosureDeadline: 20_000_000,
  status: "Active",
  source: "AleoTestnet",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
  mapping: "bounties",
};

test("create_bounty builder follows the deployed ABI exactly", () => {
  assert.equal(assertCreateBountyAbi(readCanonicalLeoSourceAbi()), true);

  const preview = buildCreateBountyTransaction(draft, 19_000_000);
  assert.deepEqual(preview.inputs, [
    "5001field",
    "6001field",
    "1field",
    "1000u64",
    "500u64",
    "100u64",
    "0u64",
    "20000000u32",
  ]);
  assert.equal(preview.programId, "zkbugbounty_7f3c92.aleo");
  assert.equal(preview.functionName, "create_bounty");
  assert.equal(preview.walletChainId, "testnetbeta");
  assert.equal(preview.ownerSource, "std::ctx::signer()");
  assert.equal(preview.feeMode, "Public");
  assert.equal(preview.fundingStatus, "NotEscrowed");
  assert.equal(Object.hasOwn(preview, "ownerId"), false);
  assertNoPrivateFields(preview);
});

test("create_bounty builder rejects malformed fields, reward order, deadline, and fee", () => {
  assert.throws(
    () => buildCreateBountyTransaction({ ...draft, bountyId: "not-a-field" }, 19_000_000),
    /Bounty ID/,
  );
  assert.throws(
    () => buildCreateBountyTransaction({ ...draft, highReward: "1001" }, 19_000_000),
    /Rewards must satisfy/,
  );
  assert.throws(
    () => buildCreateBountyTransaction({ ...draft, lowReward: "1" }, 19_000_000),
    /Low must be 0/,
  );
  assert.throws(
    () => buildCreateBountyTransaction({ ...draft, disclosureDeadline: 19_000_000 }, 19_000_000),
    /future u32/,
  );
  assert.throws(
    () => buildCreateBountyTransaction({ ...draft, feeMicrocredits: 0 }, 19_000_000),
    /positive integer/,
  );
});

test("public Bounty identifiers are deterministic at their explicit boundaries", async () => {
  const id = generateBountyFieldId((bytes) => {
    bytes.fill(1);
    return bytes;
  });
  assert.equal(id, "1334440654591915542993625911497130241field");
  const first = await createScopeFieldHash(" Vault  accounting ", "vault-accounting-safety", crypto.subtle.digest.bind(crypto.subtle));
  const second = await createScopeFieldHash("Vault accounting", "vault-accounting-safety", crypto.subtle.digest.bind(crypto.subtle));
  assert.equal(first, second);
  assert.match(first, /^[0-9]+field$/);
});

test("confirmed create_bounty parser returns public transaction inputs", () => {
  const transaction = parseConfirmedCreateBountyTransaction(
    confirmedValue(),
    blockValue(),
    transactionId,
    blockHash,
  );
  assert.equal(transaction.status, "Confirmed");
  assert.equal(transaction.blockHeight, 19_000_000);
  assert.equal(transaction.publicInputs.ruleId, "vault-accounting-safety");
  assert.equal(transaction.publicInputs.criticalReward, "1000");
  assertNoPrivateFields(transaction);
});

test("confirmed parser rejects wrong program, non-public input, and aborted transaction", () => {
  assert.throws(
    () => parseConfirmedCreateBountyTransaction(
      confirmedValue(transition({ program: "different.aleo" })),
      blockValue(),
      transactionId,
      blockHash,
    ),
    /canonical create_bounty transition/,
  );
  const privateInputs = transition().inputs.map((input) => ({ ...input }));
  privateInputs[3].type = "private";
  assert.throws(
    () => parseConfirmedCreateBountyTransaction(
      confirmedValue(transition({ inputs: privateInputs })),
      blockValue(),
      transactionId,
      blockHash,
    ),
    /inputs must be public/,
  );
  assert.throws(
    () => parseConfirmedCreateBountyTransaction(
      confirmedValue(),
      blockValue({ aborted_transaction_ids: [transactionId] }),
      transactionId,
      blockHash,
    ),
    /was aborted/,
  );
});

test("transaction fetch resolves confirmed transaction and block inclusion", async () => {
  const requestedUrls: string[] = [];
  const responses = [
    new Response(JSON.stringify(confirmedValue()), { status: 200 }),
    new Response(JSON.stringify(blockHash), { status: 200 }),
    new Response(JSON.stringify(blockValue()), { status: 200 }),
  ];
  const transaction = await fetchConfirmedCreateBountyTransaction(transactionId, async (input) => {
    requestedUrls.push(String(input));
    return responses.shift()!;
  });
  assert.equal(transaction?.transactionId, transactionId);
  assert.match(requestedUrls[0], /transaction\/confirmed/);
  assert.match(requestedUrls[1], /find\/blockHash/);
  assert.match(requestedUrls[2], /\/block\//);
});

test("unconfirmed transaction is not mislabeled as confirmed", async () => {
  const result = await handleCreateBountyTransactionLookup(
    transactionId,
    async () => new Response("not found", { status: 404 }),
  );
  assert.equal(result.status, 404);
  assert.deepEqual(result.body, {
    error: "Transaction is not confirmed on Aleo Testnet",
    transactionStatus: "PendingOrUnknown",
  });
});

test("create_bounty acceptance intent returns the complete public transaction", async () => {
  const responses = [
    new Response(JSON.stringify(confirmedValue()), { status: 200 }),
    new Response(JSON.stringify(blockHash), { status: 200 }),
    new Response(JSON.stringify(blockValue()), { status: 200 }),
  ];
  const result = await handleTransactionLookupRequest(
    transactionId,
    "create_bounty",
    async () => responses.shift()!,
  );
  assert.equal(result.status, 200);
  assert.equal("transaction" in result.body, true);
  if (!("transaction" in result.body)) assert.fail("create_bounty intent must return transaction details");
  assert.equal(result.body.transaction?.transactionId, transactionId);
  assert.equal(result.body.transaction?.publicInputs.bountyId, "5001field");
});
test("mapping verification compares every public create_bounty field", () => {
  const transaction = parseConfirmedCreateBountyTransaction(
    confirmedValue(),
    blockValue(),
    transactionId,
    blockHash,
  );
  const verified = verifyCreateBountyMapping(transaction, mapping, owner);
  assert.equal(verified.mappingVerified, true);
  assert.equal(verified.ownerVerified, true);
  assert.equal(verified.checks.every((item) => item.status === "Verified"), true);

  const mismatch = verifyCreateBountyMapping(
    transaction,
    { ...mapping, scopeHash: "999field", status: "Paused" },
    null,
  );
  assert.equal(mismatch.mappingVerified, false);
  assert.equal(mismatch.ownerCheck, "NotConnected");
  assert.equal(mismatch.checks.filter((item) => item.status === "Mismatch").length, 2);
  assertNoPrivateFields(mismatch);
});

test("Aleo Testnet network check parses and exposes the wallet chain ID", async () => {
  assert.equal(parseAleoBlockHeight("\"19000000\""), 19_000_000);
  assert.throws(() => parseAleoBlockHeight("unknown"), /invalid block height/);
  const status = await fetchAleoTestnetStatus(async () => new Response("19000000", { status: 200 }));
  assert.equal(status.network, "testnet");
  assert.equal(status.walletChainId, "testnetbeta");
  assert.equal(status.latestHeight, 19_000_000);
});

test("Real Mode wallet flow uses minimum permissions and restores only public pending transaction IDs", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const form = readFileSync("components/aleo-create-bounty-form.tsx", "utf8");
  const result = readFileSync("components/create-bounty-result.tsx", "utf8");
  const publicView = readFileSync("components/public-bounty-view.tsx", "utf8");
  const workspace = readFileSync("components/bounty-creation-workspace.tsx", "utf8");
  const transactionBuilder = readFileSync("lib/aleo-create-bounty.ts", "utf8");
  const combined = `${provider}\n${form}\n${result}\n${publicView}`;

  assert.match(provider, /DecryptPermission\.NoDecrypt/);
  assert.match(provider, /WalletAdapterNetwork\.TestnetBeta/);
  assert.match(provider, /requestTransaction/);
  assert.match(provider, /classifyWalletResponseId/);
  assert.match(provider, /preview\.feeMicrocredits,\s*false/);
  assert.match(transactionBuilder, /ownerSource: "std::ctx::signer\(\)"/);
  assert.match(result, /Submitted[\s\S]*Confirmed[\s\S]*Mapping Verified/);
  assert.match(publicView, /Data Source: Aleo Testnet/);
  assert.match(workspace, /Aleo Testnet/);
  assert.match(workspace, /Demo Local/);
  assert.equal(combined.includes("localStorage"), true);
  assert.equal(combined.includes("localStorage.setItem"), false);
  assert.match(provider, /PUBLIC_PENDING_TRANSACTION_STORAGE_KEY/);
  assert.match(provider, /PUBLIC_TRANSACTION_ID_PATTERN/);
  assert.equal(
    provider.includes("sessionStorage.setItem(PUBLIC_PENDING_TRANSACTION_STORAGE_KEY, response.publicTransactionId)"),
    true,
  );
});
