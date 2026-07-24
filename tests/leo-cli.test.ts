import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  detectLeoCli,
  getLeoCommand,
  runLeoCommand,
  sanitizeLeoCliOutput,
  windowsPathToWslPath,
  type LeoCommandRunner,
} from "../lib/leo-cli.ts";

test("windowsPathToWslPath converts Windows project paths to /mnt paths", () => {
  assert.equal(
    windowsPathToWslPath("C:\\Users\\71546\\Desktop\\aleo"),
    "/mnt/c/Users/71546/Desktop/aleo",
  );
});

test("detectLeoCli does not crash when native and WSL Leo are unavailable", async () => {
  const calls: string[] = [];
  const runner: LeoCommandRunner = async (command, args) => {
    calls.push([command, ...args].join(" "));
    return { exitCode: 1, stdout: "", stderr: "not found" };
  };
  const detection = await detectLeoCli(runner);

  assert.equal(detection.available, false);
  assert.equal(detection.mode, "unavailable");
  assert.match(detection.reason, /Leo CLI is not available/);
  assert.deepEqual(calls, [
    "leo --version",
    "wsl bash -lc which leo && leo --version",
  ]);
});

test("detectLeoCli selects WSL when native Leo is unavailable but WSL Leo works", async () => {
  const runner: LeoCommandRunner = async (command) => {
    if (command === "leo") {
      return { exitCode: 1, stdout: "", stderr: "not found" };
    }
    return { exitCode: 0, stdout: "/home/demo/.leo/bin/leo\nLeo 2.0.0", stderr: "" };
  };
  const detection = await detectLeoCli(runner);
  const command = getLeoCommand(detection);

  assert.equal(detection.available, true);
  assert.equal(detection.mode, "wsl");
  assert.equal(command.mode, "wsl");
});

test("package Leo scripts use dynamic helper and do not affect core scripts", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.equal(pkg.scripts.test, "node --experimental-strip-types --test tests/*.test.ts");
  assert.equal(pkg.scripts.lint, "eslint .");
  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.scripts["leo:version"], "node --experimental-strip-types scripts/leo-cli.ts version");
  assert.equal(pkg.scripts["leo:build"], "node --experimental-strip-types scripts/leo-cli.ts build");
  assert.equal(pkg.scripts["leo:run:valid"], "node --experimental-strip-types scripts/leo-cli.ts run-valid");
  assert.equal(pkg.scripts["leo:run:invalid"], "node --experimental-strip-types scripts/leo-cli.ts run-invalid");
  assert.equal(pkg.scripts["leo:run:low-impact"], "node --experimental-strip-types scripts/leo-cli.ts run-low-impact");
});

test("runLeoCommand treats Leo error output as a failed command", async () => {
  const runner: LeoCommandRunner = async () => ({
    exitCode: 0,
    stdout: "Error [EPAK0375040]: missing field `license`",
    stderr: "",
  });
  const result = await runLeoCommand("leo build", {
    detection: { available: true, mode: "wsl", version: "leo 4.0.2" },
    projectPath: "C:\\Users\\71546\\Desktop\\aleo\\leo\\bug_proof",
    runner,
  });

  assert.equal(result.ok, false);
});

test("Leo CLI output never exposes a private key warning or literal", () => {
  const keyLikeValue = `A${"PrivateKey1"}exampleSecret123`;
  const output = sanitizeLeoCliOutput(
    `No valid private key specified, defaulting to '${keyLikeValue}'.\nProof complete`,
  );

  assert.equal(output, "Proof complete");
  assert.equal(output.includes(keyLikeValue), false);
});
