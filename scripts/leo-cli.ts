import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  detectLeoCli,
  EXPECTED_LEO_VERSION,
  runLeoBuild,
  runLeoCommand,
} from "../lib/leo-cli.ts";
import { verifyCompiledAleoUpgradeCompatibility } from "./verify-aleo-upgrade-compatibility.ts";

const EXPECTED_PROGRAM_ID = "zkbugbounty_7f3c92.aleo";
const EDITION_ZERO_FIXTURE_SHA256 = "5f60a222cc989a55285258d1fa89ae46a6aa9e4487a396898e28cf94aa7afdf2";

const actions: Record<string, string> = {
  "run-valid": "bash ./scripts/run-valid.sh",
  "run-invalid": "bash ./scripts/run-invalid.sh",
  "run-low-impact": "bash ./scripts/run-low-impact.sh",
  "run-claims-valid": "bash ./scripts/run-claims-valid.sh",
  "run-reserve-valid": "bash ./scripts/run-reserve-valid.sh",
  "run-withdraw-valid": "bash ./scripts/run-withdraw-valid.sh",
  "run-rule-matrix": "bash ./scripts/run-rule-matrix.sh",
  "run-create-bounty": "bash ./scripts/run-create-bounty.sh",
  "run-submit-claim": "bash ./scripts/run-submit-claim.sh",
};

function hasExpectedVersion(version: string) {
  return version.toLowerCase().includes(`leo ${EXPECTED_LEO_VERSION}`);
}

async function runDoctor() {
  const detection = await detectLeoCli();
  if (!detection.available) {
    console.error(detection.reason);
    return false;
  }

  const [manifestText, fixture] = await Promise.all([
    readFile(path.join(process.cwd(), "leo", "bug_proof", "program.json"), "utf8"),
    readFile(path.join(process.cwd(), "audit", "testnet-edition-0", "zkbugbounty_7f3c92.edition-0.aleo")),
  ]);
  const manifest = JSON.parse(manifestText) as { program?: unknown; leo?: unknown };
  const fixtureSha256 = createHash("sha256").update(fixture).digest("hex");
  const versionMatches = hasExpectedVersion(detection.version);
  const programMatches = manifest.program === EXPECTED_PROGRAM_ID;
  const manifestMatches = manifest.leo === EXPECTED_LEO_VERSION;
  const fixtureMatches = fixtureSha256 === EDITION_ZERO_FIXTURE_SHA256;

  console.log(`Leo executable: ${detection.executable ?? "leo"}`);
  console.log(`Leo version: ${detection.version}`);
  console.log(`Expected Leo version: ${EXPECTED_LEO_VERSION}`);
  console.log(`Program ID: ${String(manifest.program ?? "missing")}`);
  console.log(`Edition 0 fixture SHA256: ${fixtureSha256}`);

  if (!versionMatches || !programMatches || !manifestMatches || !fixtureMatches) {
    console.error("Leo doctor: FAILED");
    return false;
  }
  console.log("Leo doctor: PASS");
  return true;
}

async function main() {
  const action = process.argv[2] ?? "version";

  if (action === "doctor") {
    if (!await runDoctor()) process.exit(1);
    return;
  }

  if (action === "version") {
    const detection = await detectLeoCli();
    if (!detection.available) {
      console.error(detection.reason);
      process.exit(1);
    }
    console.log(detection.version);
    return;
  }

  const result = action === "build"
    ? await runLeoBuild()
    : await runLeoCommand(actions[action] ?? "");

  if (result.stdout.trim()) console.log(result.stdout.trim());
  if (result.stderr.trim()) console.error(result.stderr.trim());
  if (!result.ok) process.exit(result.exitCode ?? 1);
  if (action === "build") {
    const compatibility = await verifyCompiledAleoUpgradeCompatibility();
    if (!compatibility.compatible) {
      console.error("Aleo upgrade interface compatibility: FAILED");
      for (const mismatch of compatibility.mismatches) {
        console.error(
          `- ${mismatch.component}${mismatch.name ? ` ${mismatch.name}` : ""}: ${mismatch.reason}`,
        );
      }
      process.exit(1);
    }
    const checked = Object.entries(compatibility.checked)
      .map(([component, count]) => `${component}=${count}`)
      .join(", ");
    console.log(`Aleo upgrade interface compatibility: PASS (${checked})`);
  }
}

await main();