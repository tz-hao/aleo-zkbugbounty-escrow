import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const PRODUCTION_ADMIN = "aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6";

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

function assertLocalAddress(value, label, file) {
  if (!/^aleo1[0-9a-z]+$/.test(value)) {
    throw new Error(`${label} is not an Aleo address: ${file}`);
  }
}

function fixedAleoAddresses(source) {
  return [...source.matchAll(/\baleo1[0-9a-z]+\b/g)].map((match) => match[0]);
}

export function assertLocalDevnodeLeoSource(source, { file, localAdmin, localArbiter }) {
  if (source.includes(PRODUCTION_ADMIN)) {
    throw new Error(`local admin patch incomplete: ${file}`);
  }
  if (!source.includes(localAdmin)) {
    throw new Error(`local admin patch missing: ${file}`);
  }

  const unexpectedAddresses = fixedAleoAddresses(source).filter(
    (address) => address !== localAdmin && address !== localArbiter,
  );
  if (unexpectedAddresses.length > 0) {
    throw new Error(`unexpected fixed Aleo address after local patch: ${file}`);
  }
}

export function patchDevnodeLeoSource(source, { file, localAdmin, localArbiter }) {
  assertLocalAddress(localAdmin, "local admin", file);
  assertLocalAddress(localArbiter, "local arbiter", file);

  const productionOccurrences = countOccurrences(source, PRODUCTION_ADMIN);
  if (productionOccurrences === 0) {
    throw new Error(`production admin not found: ${file}`);
  }

  const productionAdminAnnotation = `@admin(address = "${PRODUCTION_ADMIN}")`;
  const adminOccurrences = countOccurrences(source, productionAdminAnnotation);
  if (adminOccurrences === 0) {
    throw new Error(`production admin annotation not found: ${file}`);
  }

  // Keep the constructor admin bound to the local owner, then replace every
  // remaining production address used by on-chain role guards with the local arbiter.
  let patched = source.replaceAll(
    productionAdminAnnotation,
    `@admin(address = "${localAdmin}")`,
  );
  patched = patched.replaceAll(PRODUCTION_ADMIN, localArbiter);

  assertLocalDevnodeLeoSource(patched, { file, localAdmin, localArbiter });
  return patched;
}

export function patchDevnodeLeoFiles(files, { localAdmin, localArbiter }) {
  const patchedFiles = files.map((file) => ({
    file,
    source: patchDevnodeLeoSource(readFileSync(file, "utf8"), {
      file,
      localAdmin,
      localArbiter,
    }),
  }));

  for (const { file, source } of patchedFiles) {
    writeFileSync(file, source, "utf8");
  }
}

function runCli() {
  const [baselineFile, candidateFile, localAdmin, localArbiter] = process.argv.slice(2);
  if (!baselineFile || !candidateFile || !localAdmin || !localArbiter) {
    throw new Error("usage: patch-devnode-admins.mjs <baseline> <candidate> <owner-address> <arbiter-address>");
  }
  patchDevnodeLeoFiles([baselineFile, candidateFile], { localAdmin, localArbiter });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
