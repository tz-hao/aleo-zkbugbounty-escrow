import { isAleoFieldKey, isEditionOneMappingName, verifyPublicEditionOneMapping } from "../lib/testnet-edition-one.ts";

export const SMOKE_STEPS = {
  create_bounty: { transition: "Bounty Registry created with protocol version 2.", required: ["bounty-id", "scope-hash", "rule-id", "deadline"] },
  fund_bounty_v2: { transition: "bounty_escrows available balance increases once and funding marker is set.", required: ["bounty-id", "amount", "marker"] },
  submit_claim_v2: { transition: "Claim receipt, reporter, triage, and claim-count mappings are created.", required: ["bounty-id", "claim-hash"] },
  lock_reward_v2: { transition: "RewardLocked state and escrow locked balance are recorded once.", required: ["bounty-id", "claim-hash", "reporter", "marker"] },
  request_disclosure: { transition: "Claim triage advances to DetailsRequested.", required: ["bounty-id", "claim-hash", "marker"] },
  attest_encrypted_details: { transition: "Only the public package hash and shared status are recorded.", required: ["bounty-id", "claim-hash", "package-hash", "marker"] },
  mark_patched: { transition: "Claim triage advances to Patched.", required: ["bounty-id", "claim-hash", "marker"] },
  release_reward_v2: { transition: "Claim payout becomes Paid and public balance deltas are verified once.", required: ["bounty-id", "claim-hash", "reporter", "marker"] },
  "legacy-fund_bounty": { transition: "Legacy function must fail closed with no mapping or balance change.", required: ["bounty-id"] },
  "legacy-lock_reward": { transition: "Legacy function must fail closed with no mapping or balance change.", required: ["bounty-id", "claim-hash"] },
  "legacy-refund_bounty": { transition: "Legacy function must fail closed with no mapping or balance change.", required: ["bounty-id"] },
  "fund-replay": { transition: "Existing funding marker rejects with no escrow change.", required: ["bounty-id", "marker"] },
  "lock-replay": { transition: "Existing lock marker rejects with no payout or triage change.", required: ["bounty-id", "claim-hash", "marker"] },
  "release-replay": { transition: "Existing release marker rejects with no recipient balance change.", required: ["bounty-id", "claim-hash", "marker"] },
  "refund-replay": { transition: "Existing refund marker rejects with no escrow or owner balance change.", required: ["bounty-id", "marker"] },
  "unauthorized-reject": { transition: "Unauthorized reject_claim must fail with no triage or payout change.", required: ["bounty-id", "claim-hash"] },
};

const ADDRESS_PATTERN = /^aleo1[0-9a-z]{58}$/;
const TX_PATTERN = /^at1[0-9a-z]{50,80}$/;

export function parseAssistantArguments(argv) {
  const values = { command: "template", step: "", mappings: [] };
  if (argv[0] && !argv[0].startsWith("--")) values.command = argv[0];
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--step" && value) values.step = value;
    if (flag === "--mapping" && value) values.mappings.push(value);
    if (flag.startsWith("--") && value && !value.startsWith("--")) values[flag.slice(2)] = value;
  }
  return values;
}

function isPositiveInteger(value) {
  return typeof value === "string" && /^[0-9]+$/.test(value) && BigInt(value) > 0n;
}

function validValue(name, value) {
  if (name === "reporter") return ADDRESS_PATTERN.test(value ?? "");
  if (name === "amount" || name === "deadline") return isPositiveInteger(value);
  return isAleoFieldKey(value ?? "");
}

export function validateSmokeStep(values) {
  const step = SMOKE_STEPS[values.step];
  if (!step) return { valid: false, errors: ["Unsupported Smoke Test step."] };
  const errors = step.required
    .filter((name) => !validValue(name, values[name]))
    .map((name) => `Invalid public ${name}.`);
  if (values["transaction-id"] && !TX_PATTERN.test(values["transaction-id"])) {
    errors.push("Invalid public transaction-id.");
  }
  return { valid: errors.length === 0, errors };
}

export async function verifySmokeMappings(mappingArguments, indexDelay = false) {
  const entries = await Promise.all(mappingArguments.map(async (entry) => {
    const separator = entry.indexOf(":");
    const mapping = entry.slice(0, separator);
    const key = entry.slice(separator + 1);
    if (separator <= 0 || !isEditionOneMappingName(mapping)) {
      return { mapping, key, status: "PARSE_ERROR", httpStatus: null, valuePreview: null };
    }
    return verifyPublicEditionOneMapping(mapping, key, { indexDelay });
  }));
  return entries;
}

async function publicTransactionStatus(transactionId) {
  if (!TX_PATTERN.test(transactionId ?? "")) return "NOT_PROVIDED";
  try {
    const response = await fetch(`https://api.explorer.provable.com/v1/testnet/transaction/confirmed/${encodeURIComponent(transactionId)}`, {
      headers: { accept: "application/json", "cache-control": "no-cache", pragma: "no-cache" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 404) return "NOT_INDEXED_YET";
    if (!response.ok) return `HTTP_${response.status}`;
    const body = await response.json().catch(() => null);
    const status = String(body?.status ?? body?.transaction?.status ?? "").toUpperCase();
    return status === "ACCEPTED" ? "CONFIRMED" : status === "REJECTED" ? "REJECTED" : "INDEXED";
  } catch {
    return "ENDPOINT_UNAVAILABLE";
  }
}

async function main() {
  const values = parseAssistantArguments(process.argv.slice(2));
  if (values.command === "template") {
    if (values.step && SMOKE_STEPS[values.step]) {
      console.log(JSON.stringify({ step: values.step, expectedTransition: SMOKE_STEPS[values.step].transition, requiredPublicParameters: SMOKE_STEPS[values.step].required }, null, 2));
      return;
    }
    console.log(JSON.stringify(Object.entries(SMOKE_STEPS).map(([name, metadata]) => ({ step: name, expectedTransition: metadata.transition, requiredPublicParameters: metadata.required })), null, 2));
    return;
  }
  const validation = validateSmokeStep(values);
  if (values.command === "validate") {
    console.log(JSON.stringify({ step: values.step, ...validation }, null, 2));
    if (!validation.valid) process.exitCode = 2;
    return;
  }
  if (values.command !== "verify" || !validation.valid) {
    console.error("Use template, validate, or verify with a valid --step and public parameters.");
    process.exitCode = 2;
    return;
  }
  const mappings = await verifySmokeMappings(values.mappings, values["index-delay"] === "true");
  console.log(JSON.stringify({
    step: values.step,
    expectedTransition: SMOKE_STEPS[values.step].transition,
    submittedTransactionId: values["transaction-id"] ?? null,
    observedStatus: await publicTransactionStatus(values["transaction-id"]),
    mappings,
    result: "MANUAL_REVIEW_REQUIRED",
    note: "This assistant does not create, sign, or broadcast transactions. Compare the public Mapping and balance changes before continuing.",
  }, null, 2));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}