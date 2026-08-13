import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const harnessPath = resolve(root, "scripts/escrow-v2-devnode-e2e.sh");
const coveragePath = resolve(root, "scripts/protocol-v3-final-dynamic-coverage.sh");
const scenarioPath = resolve(root, "scripts/protocol-v3-dev-scenarios.sh");
const parallelPath = resolve(root, "scripts/protocol-v3-parallel-final.sh");
const harness = readFileSync(harnessPath, "utf8");
const coverage = readFileSync(coveragePath, "utf8");
const scenarios = readFileSync(scenarioPath, "utf8");
const parallel = readFileSync(parallelPath, "utf8");

function fail(message) {
  process.stderr.write(`protocol-v3-harness-static-check: ${message}\n`);
  process.exit(1);
}

if (!harness.includes('(($# == 3)) || die "generate_ephemeral_local_account requires key variable, address variable, and label"')) {
  fail("generate_ephemeral_local_account must reject an invalid arity before Devnode startup");
}

if (!harness.includes('local label="$1"\n  local started="${E2E_TIME_LABEL_STARTED_MS[${label}]:-}"')) {
  fail("timer labels must be initialized before their keyed timestamp lookup");
}

if (!harness.includes('materialize_v3_execution_workspaces()') ||
    !harness.includes('cleanup_v3_execution_workspaces()') ||
    !harness.includes('checked source files copied byte-for-byte: PASS')) {
  fail("Protocol V3 must materialize and clean a checked WSL execution workspace");
}
if (!harness.includes('assert_protocol_v3_source_integrity\n  if [[ "${ZKBB_RUN_PROTOCOL_V3:-0}" == "1" ]]') ||
    !harness.includes('event_log="$(mktemp "${REPORT_DIR}/devnode-events.XXXXXX")"\n  materialize_v3_execution_workspaces')) {
  fail("Protocol V3 source integrity must complete before its execution workspace is created");
}
if (!harness.includes('REPORT_DIR="${runtime}/reports"') ||
    !harness.includes('DIAGNOSTIC_DIR="${runtime}/logs"') ||
    !harness.includes('ALEO_E2E_DEVNODE_LOG="${runtime}/devnode.log"')) {
  fail("Protocol V3 runtime artifacts must use the WSL run directory");
}
if (!harness.includes('[[ "${root}" == "${cache}/runs/"*/*/*/workspaces ]]') ||
    !harness.includes('[[ "${runtime}" == "${cache}/runs/"*/*/*/runtime ]]')) {
  fail("Protocol V3 development paths must allow exactly cache-key, scenario, and run directories");
}
if (!harness.includes('execution_source_args=(--no-local)') ||
    !harness.includes('protocol-v3-redundant-sample" "skipped-final-matrix-is-superset')) {
  fail("Protocol V3 final coverage must reuse deployed bytecode and skip its redundant V3 sample");
}
const bootstrapAccountStart = harness.indexOf("bootstrap_account() {");
const bootstrapAccountEnd = harness.indexOf("bootstrap_test_accounts() {");
const bootstrapAccount = harness.slice(bootstrapAccountStart, bootstrapAccountEnd);
if (bootstrapAccountStart < 0 || bootstrapAccountEnd <= bootstrapAccountStart ||
    bootstrapAccount.includes("--no-local") || bootstrapAccount.includes("execution_source_args")) {
  fail("pre-deployment Credits bootstrap must not query an undeployed local package edition");
}
if (!harness.includes('const transaction = confirmed?.transaction;') ||
    !harness.includes('LAST_CONFIRMED_TRANSACTION_RESPONSE') ||
    !harness.includes('CONFIRMED_FEE_LOOKUP_ATTEMPTS')) {
  fail("Protocol V3 fee accounting must parse and reuse the confirmed transaction envelope");
}
const accountCalls = [
  ...harness.matchAll(/^\s*generate_ephemeral_local_account\s+(.+)$/gm),
  ...coverage.matchAll(/^\s*generate_ephemeral_local_account\s+(.+)$/gm),
  ...scenarios.matchAll(/^\s*generate_ephemeral_local_account\s+(.+)$/gm),
];

for (const match of accountCalls) {
  const argumentsText = match[1].trim();
  const quoted = [...argumentsText.matchAll(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+/g)];
  if (quoted.length !== 3) {
    fail(`generate_ephemeral_local_account requires exactly 3 arguments; found ${quoted.length} in: ${match[0].trim()}`);
  }
}

if (!scenarios.includes("v3_dev_read_bounty_context")) {
  fail("development scenarios must read generated bounty context before submitting a claim");
}
if (!scenarios.includes("${!bounty_name}")) {
  fail("development bounty context must dereference its generated result variables");
}
if (scenarios.includes('local bounty="${prefix}_BOUNTY"')) {
  fail("development scenarios must not pass an unresolved bounty result variable name to Leo");
}
for (const text of [harness, coverage, scenarios, parallel]) {
  if (/https?:\/\/(?!127\.0\.0\.1|localhost)/.test(text)) {
    fail("development harness may only reference localhost endpoints");
  }
}

if (!harness.includes('readonly ALEO_E2E_SOCKET_ADDR="127.0.0.1:${ALEO_E2E_PORT}"') ||
    !harness.includes('--socket-addr "${ALEO_E2E_SOCKET_ADDR}"')) {
  fail("parallel final workers must use their isolated localhost Devnode socket");
}
if (!harness.includes("readonly DEVNODE_HEIGHT_READ_ATTEMPTS=5") ||
    !harness.includes("attempt <= DEVNODE_HEIGHT_READ_ATTEMPTS") ||
    !harness.includes("local Devnode block height remained unavailable after")) {
  fail("Devnode height reads must retry bounded transient RPC timeouts");
}
if (!parallel.includes("printf '%s\\n%s\\n%s\\n'") ||
    parallel.includes("export PARALLEL_OWNER_KEY") ||
    parallel.includes("export PARALLEL_WHITEHAT_KEY") ||
    parallel.includes("export PARALLEL_ARBITER_KEY")) {
  fail("parallel final role keys must use an anonymous pipe and must not be exported");
}
if (!parallel.includes("ZKBB_PARALLEL_RESUME_ROOT") ||
    !parallel.includes("REUSE PASS") ||
    !parallel.includes("resolve_resume_root") ||
    !parallel.includes("final aggregation rejected")) {
  fail("parallel final must resume only verified shard logs and revalidate aggregation");
}
for (const shard of ["legacy", "two-core", "duplicate-scope", "severity", "reproduction-remediation", "three-of-three"]) {
  if (!parallel.includes(shard) || !harness.includes(shard)) {
    fail(`parallel final shard is missing: ${shard}`);
  }
}

process.stdout.write("protocol-v3-harness-static-check: PASS\n");
