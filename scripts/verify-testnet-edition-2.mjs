import {
  ALEO_TESTNET_API_ENDPOINT,
  ALEO_TESTNET_PROGRAM_OWNER,
  ALEO_TESTNET_V3_EXPECTED_EDITION,
  ALEO_TESTNET_V3_UPGRADE_EVIDENCE,
  CANONICAL_ALEO_PROGRAM_ID,
} from "../lib/aleo-program.ts";
import { verifyTestnetEditionOne } from "../lib/testnet-edition-one.ts";

export function parseEditionTwoVerifierArguments(argv) {
  const config = {
    endpoint: ALEO_TESTNET_API_ENDPOINT,
    programId: CANONICAL_ALEO_PROGRAM_ID,
    upgradeTransactionId: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId ?? "",
    feeTransactionId: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.feeTransactionId ?? "",
    adminAddress: ALEO_TESTNET_PROGRAM_OWNER,
    expectedEdition: ALEO_TESTNET_V3_EXPECTED_EDITION,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--endpoint" && value) config.endpoint = value;
    if (flag === "--program-id" && value) config.programId = value;
    if (flag === "--upgrade-transaction-id" && value) {
      config.upgradeTransactionId = value;
    }
    if (flag === "--fee-transaction-id" && value) {
      config.feeTransactionId = value;
    }
    if (flag === "--admin-address" && value) config.adminAddress = value;
  }
  return config;
}

export function formatEditionTwoVerification(result) {
  return [
    `Program ID: ${result.programId}`,
    `Network: ${result.network}`,
    `Expected edition: ${result.expectedEdition}`,
    `Observed edition: ${result.observedEdition ?? "UNAVAILABLE"}`,
    `Program source found: ${result.programSourceFound ? "PASS" : "FAIL"}`,
    `Upgrade transaction found: ${result.upgradeTransactionFound ? "PASS" : "FAIL"}`,
    `Transaction type: ${result.upgradeTransactionType ?? "UNAVAILABLE"}`,
    `Deployment edition: ${result.deploymentEdition ?? "UNAVAILABLE"}`,
    `Owner address match: ${result.ownerAddressMatch ? "PASS" : "FAIL"}`,
    `Fee index status: ${result.feeIndexStatus}`,
    `Upgrade status: ${result.upgradeStatus}`,
    `Overall verification: ${result.overallVerification}`,
  ].join("\n");
}

async function main() {
  const config = parseEditionTwoVerifierArguments(process.argv.slice(2));
  if (!config.upgradeTransactionId || !config.feeTransactionId) {
    console.error(
      "Edition 2 evidence is incomplete. Supply both --upgrade-transaction-id and --fee-transaction-id; no wallet capability will be enabled.",
    );
    process.exitCode = 2;
    return;
  }
  const result = await verifyTestnetEditionOne(config);
  console.log(formatEditionTwoVerification(result));
  if (result.overallVerification !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
