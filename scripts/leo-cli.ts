import {
  detectLeoCli,
  runLeoBuild,
  runLeoCommand,
} from "../lib/leo-cli.ts";

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

async function main() {
  const action = process.argv[2] ?? "version";

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

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trim());
  }
  if (!result.ok) {
    process.exit(result.exitCode ?? 1);
  }
}

await main();
