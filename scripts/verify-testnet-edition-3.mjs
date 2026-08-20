import { createHash } from "node:crypto";

import {
  ALEO_TESTNET_API_ENDPOINT,
  ALEO_TESTNET_PROGRAM_OWNER,
  ALEO_TESTNET_V3_UPGRADE_EVIDENCE,
  CANONICAL_ALEO_PROGRAM_ID,
} from "../lib/aleo-program.ts";
import { verifyTestnetEditionOne } from "../lib/testnet-edition-one.ts";

const SHA256_HEX = /^[0-9a-f]{64}$/;

function readProgramSource(text) {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "string" ? parsed : text;
  } catch {
    return text;
  }
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function parseEditionThreeVerifierArguments(argv) {
  const config = {
    endpoint: ALEO_TESTNET_API_ENDPOINT,
    programId: CANONICAL_ALEO_PROGRAM_ID,
    upgradeTransactionId: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId,
    feeTransactionId: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.feeTransactionId,
    compiledProgramSha256: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.compiledProgramSha256,
    onChainProgramSourceSha256: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.onChainProgramSourceSha256,
    adminAddress: ALEO_TESTNET_PROGRAM_OWNER,
    expectedEdition: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.expectedEdition,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--endpoint" && value) config.endpoint = value;
    if (flag === "--program-id" && value) config.programId = value;
    if (flag === "--upgrade-transaction-id" && value) config.upgradeTransactionId = value;
    if (flag === "--fee-transaction-id" && value) config.feeTransactionId = value;
    if (flag === "--program-sha256" && value) config.compiledProgramSha256 = value;
    if (flag === "--on-chain-program-sha256" && value) config.onChainProgramSourceSha256 = value;
    if (flag === "--admin-address" && value) config.adminAddress = value;
  }
  return config;
}

export function formatEditionThreeVerification(result, programHash) {
  return [
    `Program ID: ${result.programId}`,
    `Network: ${result.network}`,
    `Expected edition: ${result.expectedEdition}`,
    `Observed edition: ${result.observedEdition ?? "UNAVAILABLE"}`,
    `Upgrade status: ${result.upgradeStatus}`,
    `On-chain Program source SHA-256: ${programHash.actual ?? "UNAVAILABLE"}`,
    `Expected on-chain Program source SHA-256: ${programHash.expected}`,
    `On-chain Program source SHA-256 match: ${programHash.matches ? "PASS" : "FAIL"}`,
    `Overall verification: ${result.overallVerification === "PASS" && programHash.matches ? "PASS" : "FAIL"}`,
  ].join("\n");
}

async function main() {
  const config = parseEditionThreeVerifierArguments(process.argv.slice(2));
  if (
    !config.upgradeTransactionId ||
    !config.feeTransactionId ||
    !config.compiledProgramSha256 ||
    !SHA256_HEX.test(config.compiledProgramSha256) ||
    !config.onChainProgramSourceSha256 ||
    !SHA256_HEX.test(config.onChainProgramSourceSha256)
  ) {
    console.error(
      "Edition 3 evidence is incomplete. Record public upgrade ID, fee ID, compiled Program SHA-256, and on-chain Program source SHA-256 before enabling wallets.",
    );
    process.exitCode = 2;
    return;
  }

  const programUrl = `${config.endpoint.replace(/\/$/, "")}/testnet/program/${encodeURIComponent(config.programId)}`;
  const [verification, programResponse] = await Promise.all([
    verifyTestnetEditionOne({
      ...config,
      expectedProgramSha256: config.onChainProgramSourceSha256,
    }),
    fetch(programUrl, {
      method: "GET",
      headers: { accept: "application/json", "cache-control": "no-cache" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null),
  ]);
  const source = programResponse?.ok
    ? readProgramSource(await programResponse.text())
    : null;
  const actualHash = source ? sha256Hex(source) : null;
  const programHash = {
    expected: config.onChainProgramSourceSha256,
    actual: actualHash,
    matches: actualHash === config.onChainProgramSourceSha256,
  };
  console.log(formatEditionThreeVerification(verification, programHash));
  if (verification.overallVerification !== "PASS" || !programHash.matches) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
