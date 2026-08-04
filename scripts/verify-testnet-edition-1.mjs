import {
  DEFAULT_EDITION_ONE_VERIFIER_CONFIG,
  verifyTestnetEditionOne,
} from "../lib/testnet-edition-one.ts";

export function parseVerifierArguments(argv) {
  const config = { ...DEFAULT_EDITION_ONE_VERIFIER_CONFIG };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--endpoint" && value) config.endpoint = value;
    if (flag === "--program-id" && value) config.programId = value;
    if (flag === "--upgrade-transaction-id" && value) config.upgradeTransactionId = value;
    if (flag === "--fee-transaction-id" && value) config.feeTransactionId = value;
    if (flag === "--admin-address" && value) config.adminAddress = value;
    if (flag === "--expected-edition" && value) config.expectedEdition = Number(value);
  }
  return config;
}

export function formatEditionOneVerification(result) {
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
    `Public balance microcredits: ${result.publicBalanceMicrocredits ?? "UNAVAILABLE"}`,
    `Fee index status: ${result.feeIndexStatus}`,
    `Upgrade status: ${result.upgradeStatus}`,
    `Overall verification: ${result.overallVerification}`,
  ].join("\n");
}

async function main() {
  const result = await verifyTestnetEditionOne(parseVerifierArguments(process.argv.slice(2)));
  console.log(formatEditionOneVerification(result));
  if (result.overallVerification !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}