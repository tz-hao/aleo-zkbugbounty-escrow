import { readFileSync } from "node:fs";

import {
  compareAleoUpgradeInterfaces,
  parseAleoProgramInterface,
} from "../lib/aleo-upgrade-interface.ts";

const [baselinePath, candidatePath] = process.argv.slice(2);

if (!baselinePath || !candidatePath) {
  console.error(
    "Usage: node --experimental-strip-types scripts/check-aleo-upgrade-interface.mjs <baseline.aleo> <candidate.aleo>",
  );
  process.exit(2);
}

const baseline = parseAleoProgramInterface(readFileSync(baselinePath, "utf8"));
const candidate = parseAleoProgramInterface(readFileSync(candidatePath, "utf8"));
const result = compareAleoUpgradeInterfaces(baseline, candidate);

if (!result.compatible) {
  console.error("Aleo upgrade interface compatibility: FAIL");
  for (const mismatch of result.mismatches) {
    const name = mismatch.name ? ` ${mismatch.name}` : "";
    console.error(`- ${mismatch.component}${name}: ${mismatch.reason}`);
  }
  process.exit(1);
}

console.log(
  `Aleo upgrade interface compatibility: PASS (${result.checked.functions} functions, ${result.checked.finalizes} finalizers preserved)`,
);
