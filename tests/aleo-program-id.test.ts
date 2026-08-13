import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import { CANONICAL_ALEO_PROGRAM_ID } from "../lib/aleo-program.ts";

const sourceRoots = ["app", "components", "lib", "scripts", "tests", "leo", "aleo"];

function collectSourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "build" ? [] : collectSourceFiles(path);
    }
    return entry.isFile() ? [path] : [];
  });
}

test("canonical Aleo Program ID is consistent and no legacy ID remains", () => {
  const legacyProgramId = ["bug", "proof.aleo"].join("_");
  const sourceFiles = sourceRoots.flatMap(collectSourceFiles);
  const legacyReferences = sourceFiles.filter((file) =>
    readFileSync(file, "utf8").includes(legacyProgramId),
  );

  assert.equal(CANONICAL_ALEO_PROGRAM_ID, "zkbugbounty_7f3c92.aleo");
  assert.deepEqual(legacyReferences, []);

  const manifestPaths = collectSourceFiles("leo")
    .filter((file) => file.endsWith("program.json"))
    .map((file) => relative(process.cwd(), file).replaceAll("\\", "/"));
  assert.deepEqual(manifestPaths, ["leo/bug_proof/program.json"]);

  const manifest = JSON.parse(readFileSync(manifestPaths[0], "utf8")) as { program?: string };
  const leoSource = readFileSync("leo/bug_proof/src/main.leo", "utf8");
  assert.equal(manifest.program, CANONICAL_ALEO_PROGRAM_ID);
  assert.match(leoSource, new RegExp(`program ${CANONICAL_ALEO_PROGRAM_ID.replace(".", "\\.")} \\{`));
});

test("npm Leo scripts resolve through the one canonical project helper", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const leoScripts = Object.entries(packageJson.scripts).filter(([name]) => name.startsWith("leo:"));

  assert.equal(leoScripts.length > 0, true);
  for (const [, command] of leoScripts) {
    assert.match(command, /scripts\/leo-cli\.ts/);
  }
});
