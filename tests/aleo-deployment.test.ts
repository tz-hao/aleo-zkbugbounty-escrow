import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { handleAleoDeploymentStatus } from "../app/api/aleo/deployment/route.ts";
import { fetchAleoDeploymentStatus } from "../lib/aleo-deployment.ts";
import {
  ALEO_TESTNET_DEPLOYMENT,
  ALEO_TESTNET_PROGRAM_OWNER,
} from "../lib/aleo-program.ts";
import { assertNoPrivateFields } from "../lib/privacy-guards.ts";

const deployedProgram = `program ${ALEO_TESTNET_DEPLOYMENT.programId};
constructor:
    assert.eq program_owner ${ALEO_TESTNET_PROGRAM_OWNER};`;

const mismatchedProgram = `program mismatched_program_id.aleo;
constructor:
    assert.eq program_owner ${ALEO_TESTNET_PROGRAM_OWNER};`;

type EndpointMode = "ok" | "404" | "429" | "502" | "503" | "504" | "timeout" | "mismatch";

function statusForMode(mode: EndpointMode) {
  if (mode === "404") return 404;
  if (mode === "429") return 429;
  if (mode === "502") return 502;
  if (mode === "503") return 503;
  if (mode === "504") return 504;
  return 200;
}

function createDeploymentFetcher({
  owner = ALEO_TESTNET_PROGRAM_OWNER,
  programMode = "ok",
  transactionMode = "ok",
  verifyingKeys = [{ name: "create_bounty" }, { name: "submit_claim" }],
}: {
  owner?: string;
  programMode?: EndpointMode;
  transactionMode?: EndpointMode;
  verifyingKeys?: unknown;
} = {}) {
  return async (input: string | URL | Request) => {
    const url = String(input);
    if (url === ALEO_TESTNET_DEPLOYMENT.programApiUrl) {
      if (programMode === "timeout") throw new DOMException("request timed out", "AbortError");
      if (programMode !== "ok" && programMode !== "mismatch") {
        return new Response(null, { status: statusForMode(programMode) });
      }
      return Response.json(programMode === "mismatch" ? mismatchedProgram : deployedProgram);
    }
    if (url === ALEO_TESTNET_DEPLOYMENT.transactionApiUrl) {
      if (transactionMode === "timeout") throw new DOMException("request timed out", "AbortError");
      if (transactionMode !== "ok" && transactionMode !== "mismatch") {
        return new Response(null, { status: statusForMode(transactionMode) });
      }
      return Response.json({
        type: "deploy",
        id: ALEO_TESTNET_DEPLOYMENT.transactionId,
        owner: { address: owner, signature: "public-signature-not-returned" },
        deployment: {
          edition: 0,
          program: transactionMode === "mismatch" ? mismatchedProgram : deployedProgram,
          verifying_keys: verifyingKeys,
          program_checksum: [1, 2, 3],
          program_owner: owner,
        },
        fee: { transition: "public-fee-not-returned" },
      });
    }
    return new Response(null, { status: 404 });
  };
}

test("public Testnet deployment metadata is canonical and explorer-linked", () => {
  assert.equal(ALEO_TESTNET_DEPLOYMENT.network, "testnet");
  assert.equal(ALEO_TESTNET_DEPLOYMENT.programId, "zkbugbounty_7f3c92.aleo");
  assert.equal(
    ALEO_TESTNET_DEPLOYMENT.transactionId,
    "at1m392ux58vwqlclcrqklh0693n8pfktsegpkw69rtpfhgj0jxsyzs3xdtxv",
  );
  assert.match(ALEO_TESTNET_DEPLOYMENT.programExplorerUrl, /^https:\/\/testnet\.explorer\.provable\.com/);
});

test("deployment verifier returns selected public fields only", async () => {
  const deployment = await fetchAleoDeploymentStatus(createDeploymentFetcher());
  const serialized = JSON.stringify(deployment);

  assert.equal(deployment.status, "Confirmed");
  assert.equal(deployment.verification, "NetworkConfirmed");
  assert.equal(deployment.verificationStatus, "verified");
  assert.equal(deployment.programFound, true);
  assert.equal(deployment.transactionFound, true);
  assert.equal(deployment.edition, 0);
  assert.equal(deployment.currentEdition, 0);
  assert.equal(deployment.verifyingKeyCount, 2);
  assert.equal(serialized.includes("public-signature-not-returned"), false);
  assert.equal(serialized.includes("public-fee-not-returned"), false);
  assertNoPrivateFields(deployment);
});

test("deployment verifier accepts object-shaped verifying keys from alternate endpoints", async () => {
  const deployment = await fetchAleoDeploymentStatus(
    createDeploymentFetcher({ verifyingKeys: { create_bounty: {}, submit_claim: {}, fund_bounty: {} } }),
  );
  assert.equal(deployment.verificationStatus, "verified");
  assert.equal(deployment.verifyingKeyCount, 3);
});

test("deployment verifier reports Program found when transaction endpoint is unavailable", async () => {
  const deployment = await fetchAleoDeploymentStatus(
    createDeploymentFetcher({ transactionMode: "503" }),
  );
  assert.equal(deployment.verificationStatus, "program_found_transaction_unavailable");
  assert.equal(deployment.status, "Partial");
  assert.equal(deployment.programFound, true);
  assert.equal(deployment.transactionFound, false);
  assert.equal(deployment.errors?.transaction?.status, 503);
});

test("deployment verifier reports transaction found when Program endpoint is unavailable", async () => {
  const deployment = await fetchAleoDeploymentStatus(createDeploymentFetcher({ programMode: "502" }));
  assert.equal(deployment.verificationStatus, "transaction_found_program_unavailable");
  assert.equal(deployment.status, "Partial");
  assert.equal(deployment.programFound, false);
  assert.equal(deployment.transactionFound, true);
  assert.equal(deployment.errors?.program?.status, 502);
});

test("deployment verifier normalizes 429 and gateway failures", async () => {
  const rateLimited = await fetchAleoDeploymentStatus(
    createDeploymentFetcher({ programMode: "429", transactionMode: "429" }),
  );
  const gatewayFailure = await fetchAleoDeploymentStatus(
    createDeploymentFetcher({ programMode: "504", transactionMode: "503" }),
  );
  assert.equal(rateLimited.verificationStatus, "endpoint_unavailable");
  assert.equal(rateLimited.errors?.program?.status, 429);
  assert.equal(gatewayFailure.verificationStatus, "endpoint_unavailable");
  assert.equal(gatewayFailure.errors?.program?.status, 504);
  assert.equal(gatewayFailure.errors?.transaction?.status, 503);
});

test("deployment verifier normalizes timeout without throwing", async () => {
  const deployment = await fetchAleoDeploymentStatus(
    createDeploymentFetcher({ programMode: "timeout", transactionMode: "timeout" }),
  );
  assert.equal(deployment.verificationStatus, "endpoint_unavailable");
  assert.equal(deployment.errors?.program?.status, "timeout");
  assert.equal(deployment.errors?.transaction?.status, "timeout");
});

test("deployment verifier distinguishes not deployed from endpoint unavailable", async () => {
  const deployment = await fetchAleoDeploymentStatus(
    createDeploymentFetcher({ programMode: "404", transactionMode: "404" }),
  );
  assert.equal(deployment.verificationStatus, "not_deployed");
  assert.equal(deployment.status, "NotDeployed");
});

test("deployment verifier reports configuration error for Program ID mismatch", async () => {
  const sourceMismatch = await fetchAleoDeploymentStatus(
    createDeploymentFetcher({ programMode: "mismatch" }),
  );
  const transactionMismatch = await fetchAleoDeploymentStatus(
    createDeploymentFetcher({ transactionMode: "mismatch" }),
  );

  assert.equal(sourceMismatch.verificationStatus, "configuration_error");
  assert.equal(transactionMismatch.verificationStatus, "configuration_error");
});

test("deployment verifier reports configuration error for owner mismatch", async () => {
  const deployment = await fetchAleoDeploymentStatus(
    createDeploymentFetcher({
      owner: "aleo1differentpublicowneraddress000000000000000000000000000000000",
    }),
  );
  assert.equal(deployment.verificationStatus, "configuration_error");
  assert.match(deployment.errors?.transaction?.message ?? "", /owner mismatch/);
});

test("deployment API returns status codes matching deployment verification state", async () => {
  const verified = await handleAleoDeploymentStatus({ fetcher: createDeploymentFetcher() });
  const partial = await handleAleoDeploymentStatus({
    fetcher: createDeploymentFetcher({ transactionMode: "503" }),
  });
  const unavailable = await handleAleoDeploymentStatus({
    fetcher: createDeploymentFetcher({ programMode: "503", transactionMode: "504" }),
  });
  const notDeployed = await handleAleoDeploymentStatus({
    fetcher: createDeploymentFetcher({ programMode: "404", transactionMode: "404" }),
  });
  const configurationError = await handleAleoDeploymentStatus({
    fetcher: createDeploymentFetcher({ programMode: "mismatch" }),
  });

  assert.equal(verified.status, 200);
  assert.equal(verified.body.deployment.verificationStatus, "verified");
  assert.equal(partial.status, 200);
  assert.equal(partial.body.deployment.verificationStatus, "program_found_transaction_unavailable");
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.deployment.verificationStatus, "endpoint_unavailable");
  assert.equal(notDeployed.status, 404);
  assert.equal(notDeployed.body.deployment.verificationStatus, "not_deployed");
  assert.equal(configurationError.status, 500);
  assert.equal(configurationError.body.deployment.verificationStatus, "configuration_error");
  assertNoPrivateFields(verified.body);
  assertNoPrivateFields(partial.body);
});

test("deployment UI exposes live public confirmation without persistence", async () => {
  const component = readFileSync("components/aleo-deployment-status.tsx", "utf8");
  const publicClaims = readFileSync("app/public-claims/page.tsx", "utf8");
  assert.match(component, /\/api\/aleo\/deployment/);
  assert.match(component, /verificationStatus/);
  assert.equal(component.includes("localStorage"), false);
  assert.match(publicClaims, /AleoDeploymentStatus/);
});
