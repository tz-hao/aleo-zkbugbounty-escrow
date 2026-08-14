import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { handleAleoPublicIndex } from "../app/api/aleo/registry/route.ts";
import {
  getAleoPublicIndexConfig,
  listIndexedBounties,
  listIndexedClaims,
  parseIndexedBountyTransaction,
  parseIndexedClaimTransaction,
  type AleoPublicIndexConfig,
} from "../lib/aleo-public-index.ts";
import type { TransactionFetch } from "../lib/aleo-create-bounty-acceptance.ts";

const createTransactionId = "at1wrneyusjwqe0wgca4pp20clw55e68ftsllgud9eemjrjllpy4qrsy5rrvp";
const claimTransactionId = "at1m392ux58vwqlclcrqklh0693n8pfktsegpkw69rtpfhgj0jxsyzs3xdtxv";
const bountyId = "257640041950318553814753415615134947371field";
const scopeHash = "165263616045655158386888829934414575403field";
const v3BountyId = "324520600032579539532461584551766874442field";
const v3ScopeHash = "213025675297070227183471899359684190473field";
const v3TransactionId = "at1nhjm30xah3jee2syzuj8npegh66fmqes4efdjvfgn6e2p087jsrszrg8my";
const claimHash = "15007field";
const nullifier = "10002field";

const config: AleoPublicIndexConfig = {
  rpcEndpoint: "https://rpc.example/testnetbeta",
  explorerEndpoint: "https://explorer.example/v2/testnet",
  registry: {
    endpoint: "https://registry.example/v1",
    network: "testnet",
    programId: "zkbugbounty_7f3c92.aleo",
  },
};

const createEntry = {
  status: "accepted",
  type: "execute",
  transaction: {
    type: "execute",
    id: createTransactionId,
    execution: {
      transitions: [
        {
          program: "zkbugbounty_7f3c92.aleo",
          function: "create_bounty",
          inputs: [
            { type: "public", value: bountyId },
            { type: "public", value: scopeHash },
            { type: "public", value: "1field" },
            { type: "public", value: "1000000u64" },
            { type: "public", value: "500000u64" },
            { type: "public", value: "200000u64" },
            { type: "public", value: "100000u64" },
            { type: "public", value: "18145243u32" },
          ],
        },
      ],
    },
  },
};

const v3Policy = `{
  disclosure_key_commitment: 101field,
  target_system_commitment: 102field,
  target_code_hash: 103field,
  panel_id: 66924874078773480696300156607143561056field,
  arbiter_one: aleo1hxrwn37uvt8jm5cks6wvxk44vx6vcgtmvwcsygqamuq6gr4ywuxs000q0w,
  arbiter_two: aleo1ycvh2tkt8xpsgkfx3flvtvr57hmujacrsextmjkux40u6xr0kgpsslgqun,
  arbiter_three: aleo1v2lg2pj44fy5xjd5d6ac7lcsts3j29aex5fx9ankpr34gsu2hsgqfh25gh,
  quorum: 2u8,
  review_window_blocks: 10000u32,
  decision_window_blocks: 20000u32,
  arbitration_fee_microcredits: 1000000u64,
  payment_condition: 1u8
}`;

const createV3Entry = {
  status: "accepted",
  type: "execute",
  transaction: {
    type: "execute",
    id: v3TransactionId,
    execution: {
      transitions: [
        {
          program: "zkbugbounty_7f3c92.aleo",
          function: "create_bounty_v3",
          inputs: [
            { type: "public", value: v3BountyId },
            { type: "public", value: v3ScopeHash },
            { type: "public", value: "1field" },
            { type: "public", value: "5000000u64" },
            { type: "public", value: "2000000u64" },
            { type: "public", value: "1000000u64" },
            { type: "public", value: "0u64" },
            { type: "public", value: "18815866u32" },
            { type: "public", value: v3Policy },
          ],
        },
      ],
    },
  },
};

const claimEntry = {
  status: "accepted",
  type: "execute",
  transaction: {
    type: "execute",
    id: claimTransactionId,
    execution: {
      transitions: [
        {
          program: "zkbugbounty_7f3c92.aleo",
          function: "submit_claim",
          inputs: [
            { type: "public", value: bountyId },
            { type: "public", value: scopeHash },
            { type: "public", value: "1field" },
            ...Array.from({ length: 13 }, (_, index) => ({
              type: "private",
              value: `ciphertext-test-${index}`,
            })),
          ],
          outputs: [
            {
              type: "public",
              value: `{
                verified: true,
                severity: 3u8,
                claim_hash: ${claimHash},
                witness_commitment: 9018field,
                nullifier: ${nullifier},
                reporter_commitment: 7007field,
                bug_type_id: 1field,
                rule_id: 1field
              }`,
            },
            { type: "future", value: "public-finalize-reference" },
          ],
        },
      ],
    },
  },
};

const bountyMapping = `{
  owner_address: aleo1hxrwn37uvt8jm5cks6wvxk44vx6vcgtmvwcsygqamuq6gr4ywuxs000q0w,
  scope_hash: ${scopeHash},
  rule_id: 1field,
  critical_reward: 1000000u64,
  high_reward: 500000u64,
  medium_reward: 200000u64,
  low_reward: 100000u64,
  disclosure_deadline: 18145243u32,
  status: 1u8
}`;

const bountyV3Mapping = `{
  owner_address: aleo1hxrwn37uvt8jm5cks6wvxk44vx6vcgtmvwcsygqamuq6gr4ywuxs000q0w,
  scope_hash: ${v3ScopeHash},
  rule_id: 1field,
  critical_reward: 5000000u64,
  high_reward: 2000000u64,
  medium_reward: 1000000u64,
  low_reward: 0u64,
  disclosure_deadline: 18815866u32,
  status: 1u8
}`;

const bountyV3ConfigMapping = `{
  bounty_id: ${v3BountyId},
  disclosure_key_commitment: 101field,
  target_system_commitment: 102field,
  target_code_hash: 103field,
  panel_id: 66924874078773480696300156607143561056field,
  arbiter_one: aleo1hxrwn37uvt8jm5cks6wvxk44vx6vcgtmvwcsygqamuq6gr4ywuxs000q0w,
  arbiter_two: aleo1ycvh2tkt8xpsgkfx3flvtvr57hmujacrsextmjkux40u6xr0kgpsslgqun,
  arbiter_three: aleo1v2lg2pj44fy5xjd5d6ac7lcsts3j29aex5fx9ankpr34gsu2hsgqfh25gh,
  quorum: 2u8,
  review_window_blocks: 10000u32,
  decision_window_blocks: 20000u32,
  arbitration_fee_microcredits: 1000000u64,
  payment_condition: 1u8,
  configured_height: 18715886u32
}`;

function bountyRpcResult(init: RequestInit | undefined, v3Entries: readonly unknown[] = []) {
  const request = JSON.parse(String(init?.body)) as {
    params?: { functionName?: string };
  };
  return Response.json({
    jsonrpc: "2.0",
    id: "zkbb-public-index",
    result: request.params?.functionName === "create_bounty_v3" ? v3Entries : [createEntry],
  });
}

const receiptMapping = `{
  claim_hash: ${claimHash},
  bounty_id: ${bountyId},
  rule_id: 1field,
  scope_hash: ${scopeHash},
  severity: 3u8,
  witness_commitment: 9018field,
  nullifier: ${nullifier},
  reporter_commitment: 7007field,
  proof_status: 1u8,
  created_height: 18050000u32,
  protocol_version: 1u8
}`;

test("public index configuration is canonical and HTTPS-only", () => {
  const actual = getAleoPublicIndexConfig({});
  assert.equal(actual.rpcEndpoint, "https://testnetbeta.aleorpc.com");
  assert.equal(actual.explorerEndpoint, "https://api.provable.com/v2/testnet");
  assert.equal(actual.registry.programId, "zkbugbounty_7f3c92.aleo");
  assert.throws(
    () => getAleoPublicIndexConfig({ ALEO_RPC_ENDPOINT: "http://rpc.invalid" }),
    /HTTPS/,
  );
});

test("bounty index discovers transactions then verifies the authoritative mapping", async () => {
  const rpcBodies: Record<string, unknown>[] = [];
  const fetcher: TransactionFetch = async (input, init) => {
    const url = String(input);
    if (url === config.rpcEndpoint) {
      rpcBodies.push(JSON.parse(String(init?.body)));
      return bountyRpcResult(init);
    }
    assert.match(url, /\/mapping\/bounties\//);
    return new Response(bountyMapping, { status: 200 });
  };

  const registry = await listIndexedBounties(0, 10, config, fetcher);
  assert.equal(registry.kind, "bounties");
  assert.equal(registry.items[0].mappingStatus, "Verified");
  assert.equal(registry.items[0].bounty?.owner.startsWith("aleo1"), true);
  assert.deepEqual(
    rpcBodies.map((body) => body.params),
    [
      {
        programId: "zkbugbounty_7f3c92.aleo",
        functionName: "create_bounty_v3",
        page: 0,
        maxTransactions: 10,
      },
      {
    programId: "zkbugbounty_7f3c92.aleo",
    functionName: "create_bounty",
    page: 0,
    maxTransactions: 10,
      },
    ],
  );
  assert.equal(JSON.stringify(registry).includes("DemoLocal"), false);
});

test("V3 bounty discovery verifies both the public Bounty and immutable V3 config mappings", async () => {
  const v3Discovery = parseIndexedBountyTransaction(createV3Entry, "create_bounty_v3");
  assert.equal(v3Discovery.protocolVersion, 3);
  assert.equal(v3Discovery.publicInputs.bountyId, v3BountyId);
  assert.equal(v3Discovery.v3Policy?.paymentCondition, "OnReproduction");

  const fetcher: TransactionFetch = async (input, init) => {
    const url = String(input);
    if (url === config.rpcEndpoint) return bountyRpcResult(init, [createV3Entry]);
    if (url.includes(`/mapping/bounties/${v3BountyId}`)) return new Response(bountyV3Mapping);
    if (url.includes(`/mapping/bounty_v3_configs/${v3BountyId}`)) {
      return new Response(bountyV3ConfigMapping);
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const registry = await listIndexedBounties(0, 10, config, fetcher);
  const indexed = registry.items.find((item) => item.transactionId === v3TransactionId);
  assert.equal(indexed?.transactionStatus, "Accepted");
  assert.equal(indexed?.protocolVersion, 3);
  assert.equal(indexed?.mappingStatus, "Verified");
  assert.equal(indexed?.bounty?.bountyId, v3BountyId);
  assert.equal(indexed?.v3Config?.configuredHeight, 18_715_886);
});

test("V3 Bounty never becomes Mapping Verified when its immutable config differs", async () => {
  const fetcher: TransactionFetch = async (input, init) => {
    const url = String(input);
    if (url === config.rpcEndpoint) return bountyRpcResult(init, [createV3Entry]);
    if (url.includes(`/mapping/bounties/${v3BountyId}`)) return new Response(bountyV3Mapping);
    if (url.includes(`/mapping/bounty_v3_configs/${v3BountyId}`)) {
      return new Response(bountyV3ConfigMapping.replace("payment_condition: 1u8", "payment_condition: 2u8"));
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const registry = await listIndexedBounties(0, 10, config, fetcher);
  const indexed = registry.items.find((item) => item.transactionId === v3TransactionId);
  assert.equal(indexed?.transactionStatus, "Accepted");
  assert.equal(indexed?.mappingStatus, "Mismatch");
  assert.equal(indexed?.bounty, undefined);
});

test("confirmed discovery never becomes Mapping Verified when mapping is absent", async () => {
  const fetcher: TransactionFetch = async (input, init) =>
    String(input) === config.rpcEndpoint
      ? bountyRpcResult(init)
      : new Response("not found", { status: 404 });

  const registry = await listIndexedBounties(0, 10, config, fetcher);
  assert.equal(registry.items[0].transactionStatus, "Accepted");
  assert.equal(registry.items[0].mappingStatus, "Missing");
  assert.equal(registry.items[0].bounty, undefined);
});

test("temporary mapping failures do not hide accepted public transaction discovery", async () =>
{
  const fetcher: TransactionFetch = async (input, init) =>
    String(input) === config.rpcEndpoint
      ? bountyRpcResult(init)
      : new Response("temporarily unavailable", { status: 503 });

  const registry = await listIndexedBounties(0, 10, config, fetcher);
  assert.equal(registry.items[0].transactionStatus, "Accepted");
  assert.equal(registry.items[0].mappingStatus, "Unavailable");
  assert.equal(registry.items[0].bounty, undefined);

  const response = await handleAleoPublicIndex("bounties", "0", "10", { config, fetcher });
  assert.equal(response.status, 200);
  const payload = response.body as { registry: Awaited<ReturnType<typeof listIndexedBounties>> };
  assert.equal(payload.registry.items[0].mappingStatus, "Unavailable");
});
test("claim index ignores encrypted inputs and verifies receipt plus nullifier mappings", async () => {
  const discovery = parseIndexedClaimTransaction(claimEntry);
  assert.deepEqual(discovery, {
    transactionId: claimTransactionId,
    bountyId,
    scopeHash,
    ruleId: "vault-accounting-safety",
    claimHash,
    witnessCommitment: "9018field",
    nullifier,
    reporterCommitment: "7007field",
    severity: "Critical",
  });
  assert.equal(JSON.stringify(discovery).includes("ciphertext-test"), false);

  const fetcher: TransactionFetch = async (input, init) => {
    const url = String(input);
    if (url === config.rpcEndpoint) {
      const request = JSON.parse(String(init?.body)) as {
        params?: { functionName?: string };
      };
      return Response.json({
        jsonrpc: "2.0",
        result: request.params?.functionName === "submit_claim" ? [claimEntry] : [],
      });
    }
    if (url.includes("/mapping/claim_receipts/")) return new Response(receiptMapping);
    if (url.includes("/mapping/nullifiers/")) return new Response(JSON.stringify(bountyId));
    throw new Error(`Unexpected URL ${url}`);
  };
  const registry = await listIndexedClaims(0, 10, config, fetcher);
  assert.equal(registry.kind, "claims");
  assert.equal(registry.items[0].mappingStatus, "Verified");
  assert.equal(registry.items[0].receipt?.proofStatus, "Verified");
  assert.equal(registry.items[0].nullifierState?.used, true);
});

test("claim index parses submit_claim_v2 public output without reading witness ciphertext", async () => {
  const v2Entry = structuredClone(claimEntry);
  v2Entry.transaction.id = "at1vxd9wgf5w4akvvryryc64x0gk52te2dc5h69p3f4500ky0sj95qqgh70a2";
  v2Entry.transaction.execution.transitions[0].function = "submit_claim_v2";

  const discovery = parseIndexedClaimTransaction(v2Entry, "submit_claim_v2");

  assert.equal(discovery.transactionId, v2Entry.transaction.id);
  assert.equal(discovery.claimHash, claimHash);
  assert.equal(discovery.nullifier, nullifier);
  assert.equal(JSON.stringify(discovery).includes("ciphertext-test"), false);

  const fetcher: TransactionFetch = async (input, init) => {
    const url = String(input);
    if (url === config.rpcEndpoint) {
      const request = JSON.parse(String(init?.body)) as {
        params?: { functionName?: string };
      };
      return Response.json({
        jsonrpc: "2.0",
        result: request.params?.functionName === "submit_claim_v2" ? [v2Entry] : [],
      });
    }
    if (url.includes("/mapping/claim_receipts/")) {
      return new Response(receiptMapping.replace("protocol_version: 1u8", "protocol_version: 2u8"));
    }
    if (url.includes("/mapping/nullifiers/")) return new Response(JSON.stringify(bountyId));
    throw new Error("Unexpected URL " + url);
  };
  const registry = await listIndexedClaims(0, 10, config, fetcher);
  assert.equal(registry.items.length, 1);
  assert.equal(registry.items[0]?.transactionId, v2Entry.transaction.id);
  assert.equal(registry.items[0]?.receipt?.protocolVersion, 2);
  assert.equal(registry.items[0]?.mappingStatus, "Verified");
});
test("public index falls back to Provable Explorer discovery when RPC is unavailable", async () => {
  const fetcher: TransactionFetch = async (input) => {
    const url = String(input);
    if (url === config.rpcEndpoint) return new Response("RPC unavailable", { status: 503 });
    if (url === `${config.explorerEndpoint}/programs/zkbugbounty_7f3c92.aleo/latest-calls`) {
      return Response.json([
        {
          function_id: "create_bounty",
          status: "Accepted",
          transaction_id: createTransactionId,
        },
      ]);
    }
    if (url === `${config.explorerEndpoint}/transactions/${createTransactionId}`) {
      return Response.json({ ...createEntry.transaction, status: "Accepted" });
    }
    if (url.includes("/mapping/bounties/")) return new Response(bountyMapping);
    throw new Error(`Unexpected URL ${url}`);
  };

  const registry = await listIndexedBounties(0, 10, config, fetcher);
  assert.equal(registry.source, "ProvableExplorerDiscovery");
  assert.equal(registry.items[0].mappingStatus, "Verified");
  assert.equal(registry.items[0].bounty?.bountyId, bountyId);
});
test("public index API reports unavailable and never falls back to local demo data", async () => {
  const unavailable = await handleAleoPublicIndex("bounties", "0", "10", {
    config,
    fetcher: async () => new Response("upstream unavailable", { status: 522 }),
  });
  assert.equal(unavailable.status, 502);
  assert.deepEqual(unavailable.body, {
    error: "Aleo public transaction index is temporarily unavailable",
    source: "Unavailable",
    fallback: "None",
  });
  assert.equal((await handleAleoPublicIndex("unknown", "0", "10")).status, 400);
  assert.equal((await handleAleoPublicIndex("bounties", "-1", "10")).status, 400);

  const route = readFileSync("app/api/aleo/registry/route.ts", "utf8");
  const panel = readFileSync("components/aleo-public-index.tsx", "utf8");
  assert.equal(route.includes("mock-data"), false);
  assert.equal(route.includes("localStorage"), false);
  assert.match(panel, /交易已确认不等于映射已验证/);
  assert.match(panel, /未使用模拟数据或本地存储回退/);
});

test("claim index globally orders verified receipts before pagination", async () => {
  const newerClaimHash = "15008field";
  const newerNullifier = "10003field";
  const v2Entry = structuredClone(claimEntry);
  v2Entry.transaction.id = "at1vxd9wgf5w4akvvryryc64x0gk52te2dc5h69p3f4500ky0sj95qqgh70a2";
  v2Entry.transaction.execution.transitions[0].function = "submit_claim_v2";
  v2Entry.transaction.execution.transitions[0].outputs[0].value =
    v2Entry.transaction.execution.transitions[0].outputs[0].value
      .replace(claimHash, newerClaimHash)
      .replace(nullifier, newerNullifier);
  const newerReceiptMapping = receiptMapping
    .replace(`claim_hash: ${claimHash}`, `claim_hash: ${newerClaimHash}`)
    .replace(`nullifier: ${nullifier}`, `nullifier: ${newerNullifier}`)
    .replace("created_height: 18050000u32", "created_height: 18050001u32")
    .replace("protocol_version: 1u8", "protocol_version: 2u8");

  const fetcher: TransactionFetch = async (input, init) => {
    const url = String(input);
    if (url === config.rpcEndpoint) {
      const request = JSON.parse(String(init?.body)) as {
        params?: { functionName?: string };
      };
      return Response.json({
        jsonrpc: "2.0",
        result: request.params?.functionName === "submit_claim_v2" ? [v2Entry] : [claimEntry],
      });
    }
    if (url.includes(`/mapping/claim_receipts/${newerClaimHash}`)) {
      return new Response(newerReceiptMapping);
    }
    if (url.includes(`/mapping/claim_receipts/${claimHash}`)) return new Response(receiptMapping);
    if (url.includes("/mapping/nullifiers/")) return new Response(JSON.stringify(bountyId));
    throw new Error(`Unexpected URL ${url}`);
  };

  const firstPage = await listIndexedClaims(0, 1, config, fetcher);
  const secondPage = await listIndexedClaims(1, 1, config, fetcher);

  assert.equal(firstPage.items[0]?.claimHash, newerClaimHash);
  assert.equal(firstPage.items[0]?.receipt?.protocolVersion, 2);
  assert.equal(firstPage.hasMore, true);
  assert.equal(secondPage.items[0]?.claimHash, claimHash);
  assert.equal(secondPage.hasMore, false);
});
