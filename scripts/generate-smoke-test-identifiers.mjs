import { randomBytes } from "node:crypto";

import { verifyPublicEditionOneMapping } from "../lib/testnet-edition-one.ts";

const MARKER_NAMES = ["fundMarker", "lockMarker", "releaseMarker", "refundMarker", "patchMarker"];

export function randomField(random = randomBytes) {
  for (;;) {
    const value = BigInt(`0x${random(31).toString("hex")}`);
    if (value !== 0n) return `${value}field`;
  }
}

export function generateSmokeTestIdentifiers(random = randomBytes) {
  const values = new Set();
  const next = () => {
    let field = randomField(random);
    while (values.has(field)) field = randomField(random);
    values.add(field);
    return field;
  };
  return {
    bountyId: next(),
    fundMarker: next(),
    lockMarker: next(),
    releaseMarker: next(),
    refundMarker: next(),
    claimReference: next(),
    packageHashPlaceholder: next(),
    patchMarker: next(),
  };
}

export async function verifyGeneratedMarkersUnused(identifiers, verify = verifyPublicEditionOneMapping) {
  const results = {};
  for (const name of MARKER_NAMES) {
    results[name] = await verify("escrow_operation_markers", identifiers[name]);
  }
  return results;
}

function hasFlag(argv, name) {
  return argv.includes(name);
}

async function main() {
  const identifiers = generateSmokeTestIdentifiers();
  const offline = hasFlag(process.argv.slice(2), "--offline");
  const markerChecks = offline ? null : await verifyGeneratedMarkersUnused(identifiers);
  const reusable = markerChecks
    ? Object.values(markerChecks).every((result) => result.status === "NOT_SET")
    : false;
  console.log(JSON.stringify({
    identifiers,
    operationMarkerHistory: offline ? "NOT_CHECKED_OFFLINE" : reusable ? "NO_MATCH_FOUND" : "CHECK_FAILED",
    markerCheckStatuses: markerChecks
      ? Object.fromEntries(Object.entries(markerChecks).map(([name, result]) => [name, result.status]))
      : null,
    note: offline
      ? "Offline mode does not prove that operation markers are unused on Testnet."
      : "Only public mapping lookups were performed; no transaction was generated or broadcast.",
  }, null, 2));
  if (!offline && !reusable) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}