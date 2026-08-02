import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compareAleoUpgradeInterfaces,
  parseAleoProgramInterface,
} from "../lib/aleo-upgrade-interface.ts";

const TESTNET_EDITION_ZERO_FIXTURE = path.join(
  process.cwd(),
  "audit",
  "testnet-edition-0",
  "zkbugbounty_7f3c92.edition-0.aleo",
);
const CANDIDATE_BUILD = path.join(process.cwd(), "leo", "bug_proof", "build", "zkbugbounty_7f3c92", "zkbugbounty_7f3c92.aleo");

type VerificationOptions = {
  ignoreConstructor?: boolean;
};

export async function verifyCompiledAleoUpgradeCompatibility(
  baselinePath = TESTNET_EDITION_ZERO_FIXTURE,
  candidatePath = CANDIDATE_BUILD,
  options: VerificationOptions = {},
) {
  const [baselineSource, candidateSource] = await Promise.all([
    readFile(baselinePath, "utf8"),
    readFile(candidatePath, "utf8"),
  ]);
  const comparison = compareAleoUpgradeInterfaces(
    parseAleoProgramInterface(baselineSource),
    parseAleoProgramInterface(candidateSource),
  );
  const mismatches = options.ignoreConstructor
    ? comparison.mismatches.filter((mismatch) => mismatch.component !== "constructor")
    : comparison.mismatches;

  return {
    ...comparison,
    compatible: mismatches.length === 0,
    mismatches,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const ignoreConstructor = args.includes("--ignore-constructor");
  const paths = args.filter((argument) => argument !== "--ignore-constructor");
  const result = await verifyCompiledAleoUpgradeCompatibility(
    paths[0] ?? TESTNET_EDITION_ZERO_FIXTURE,
    paths[1] ?? CANDIDATE_BUILD,
    { ignoreConstructor },
  );

  if (!result.compatible) {
    console.error("Aleo upgrade interface compatibility: FAILED");
    for (const mismatch of result.mismatches) {
      console.error(
        `- ${mismatch.component}${mismatch.name ? ` ${mismatch.name}` : ""}: ${mismatch.reason}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  const checked = Object.entries(result.checked)
    .map(([component, count]) => `${component}=${count}`)
    .join(", ");
  const constructorScope = ignoreConstructor ? ", constructor=local-devnode-address-ignored" : "";
  console.log(`Aleo upgrade interface compatibility: PASS (${checked}${constructorScope})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}