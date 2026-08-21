import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const harness = readFileSync("scripts/escrow-v2-devnode-e2e.sh", "utf8");
const protocolV3Harness = readFileSync("scripts/protocol-v3-devnode-e2e.sh", "utf8");
const finalV3Coverage = readFileSync("scripts/protocol-v3-final-dynamic-coverage.sh", "utf8");
const developmentRunner = readFileSync("scripts/protocol-v3-dev-runner.sh", "utf8");
const developmentScenarios = readFileSync("scripts/protocol-v3-dev-scenarios.sh", "utf8");
const parallelFinal = readFileSync("scripts/protocol-v3-parallel-final.sh", "utf8");
const staticHarnessCheck = readFileSync("scripts/check-protocol-v3-harness-static.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };

const executionTransactionLine = /^[ \t]*-[ \t]*transaction ID:[ \t]*'([^']+)'[ \t]*.*$/;
const feeIdLine = /^[ \t]*-[ \t]*fee ID:[ \t]*'([^']+)'[ \t]*.*$/;
const feeTransactionLine = /^[ \t]*-[ \t]*fee transaction ID:[ \t]*'([^']+)'[ \t]*.*$/;

function extractUniquePublicId(output: string, pattern: RegExp, prefix: "at1" | "au1") {
  const ids = output
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(pattern);
      return match ? [match[1]] : [];
    });

  return ids.length === 1 && new RegExp(`^${prefix}[0-9a-z]+$`).test(ids[0]) ? ids[0] : undefined;
}

function isExpectedLocalExecutionFailure(output: string, exitCode: number) {
  const required = ["Stack evaluation failed", "assert.eq", "failed"];
  const emittedTransaction = /Broadcasted transaction|transaction submitted|^[ \t]*-[ \t]*(fee )?transaction ID:/m;

  return exitCode !== 0 && required.every((pattern) => output.includes(pattern)) && !emittedTransaction.test(output);
}

function parseAleoU64Literal(raw: string): bigint | undefined {
  let value = raw.trim();
  const quoted = value.match(/^"(.*)"$/);
  if (quoted) {
    value = quoted[1].trim();
  }
  const match = value.match(/^([0-9]+)u64$/);
  return match ? BigInt(match[1]) : undefined;
}

function parseConfirmedPublicFeeMicrocredits(
  raw: string,
  expectedTransactionId: string,
  expectedTransactionType: "execute" | "fee",
): bigint | undefined {
  try {
    const confirmed = JSON.parse(raw) as {
      type?: unknown;
      transaction?: {
        type?: unknown;
        id?: unknown;
        fee?: { transition?: { inputs?: Array<{ type?: unknown; value?: unknown }> } };
      };
    };
    const transaction = confirmed.transaction;
    if (
      confirmed.type !== "execute" ||
      transaction?.type !== expectedTransactionType ||
      transaction.id !== expectedTransactionId ||
      transaction.fee?.transition?.inputs?.[0]?.type !== "public"
    ) {
      return undefined;
    }
    const value = transaction.fee?.transition?.inputs?.[0]?.value;
    return typeof value === "string" ? parseAleoU64Literal(value) : undefined;
  } catch {
    return undefined;
  }
}

function readMappingU64ForTest(httpStatus: number, raw: string) {
  if (httpStatus === 404) {
    return { status: "ABSENT" as const };
  }
  if (httpStatus !== 200) {
    return { status: "ERROR" as const };
  }
  if (raw.trim() === "null") {
    return { status: "ABSENT" as const };
  }
  const value = parseAleoU64Literal(raw);
  return value === undefined ? { status: "ERROR" as const } : { status: "FOUND" as const, value };
}

function formatMicrocreditsForTest(value: bigint) {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}

test("Escrow Devnode harness is localhost-only and starts from an isolated ledger", () => {
  assert.match(harness, /"http:\/\/127\.0\.0\.1:\$\{ALEO_E2E_PORT\}"\|"http:\/\/localhost:\$\{ALEO_E2E_PORT\}"/);
  assert.match(harness, /refusing non-local endpoint/);
  assert.match(harness, /local-devnode\/baseline-pre-escrow/);
  assert.match(harness, /local-devnode\/candidate-escrow-v2/);
  assert.match(harness, /local-devnode\/ledger/);
  assert.match(harness, /"\$\{LEO_BIN\}" devnode start --socket-addr "\$\{ALEO_E2E_SOCKET_ADDR\}"/);
  assert.match(harness, /--storage "\$\{ALEO_E2E_LEDGER\}"/);
  assert.doesNotMatch(harness, /api\.explorer\.provable\.com/);
  assert.match(harness, /--clear-storage/);
});

test("Escrow Devnode harness never embeds or persists private credentials", () => {
  assert.match(harness, /set \+x/);
  assert.match(harness, /read -r -s -p/);
  assert.match(harness, /trap final_e2e_exit_guard EXIT/);
  assert.match(harness, /final_e2e_exit_guard[\s\S]*cleanup_all/);
  assert.match(harness, /trap 'handle_signal 130' INT/);
  assert.match(harness, /trap 'handle_signal 143' TERM/);
  assert.match(harness, /DEVNODE_PRIVATE_KEY=""/);
  assert.match(harness, /privateInputsPersisted: false/);
  assert.match(harness, /localKeysPersisted: false/);
  assert.doesNotMatch(harness, new RegExp(["APrivate", "Key"].join("")));
  assert.doesNotMatch(harness, /\.env/);
  assert.doesNotMatch(harness, /account import[^\n]*--write/);
  assert.doesNotMatch(harness, /Local-only Devnode bootstrap private key/);
  assert.match(harness, /assert_owner_has_deployment_balance/);
  assert.match(harness, /Do not use a Wallet or Testnet account/);
  assert.match(harness, /write_sanitized_diagnostic "leo-command-failure" "\$\{LAST_OUTPUT\}"/);
});

test("Escrow Devnode harness uses explicit transaction IDs for independent local steps", () => {
  assert.match(harness, /deploy --broadcast --yes --skip-deploy-certificate/);
  assert.match(harness, /upgrade --broadcast --yes --skip-deploy-certificate/);
  assert.match(harness, /execute .*--skip-execute-proof --broadcast --yes/);
  assert.match(harness, /extract_execution_transaction_id/);
  assert.match(harness, /extract_fee_id/);
  assert.match(harness, /extract_fee_transaction_id/);
  assert.match(harness, /\*transaction ID:/);
  assert.match(harness, /\*fee transaction ID:/);
  assert.match(harness, /\[\[ "\$\{count\}" == "1" \]\]/);
  assert.match(harness, /\^at1\[0-9a-z\]\+\$/);
  assert.match(harness, /\^au1\[0-9a-z\]\+\$/);
  assert.match(harness, /expected exactly one explicit execution transaction ID/);
  assert.match(harness, /BOOTSTRAP_WHITEHAT_TX_ID/);
  assert.match(harness, /BOOTSTRAP_WHITEHAT_FEE_ID/);
  assert.match(harness, /BOOTSTRAP_WHITEHAT_FEE_TX_ID/);
  assert.match(harness, /BOOTSTRAP_ARBITER_TX_ID/);
  assert.match(harness, /BOOTSTRAP_ARBITER_FEE_ID/);
  assert.match(harness, /BOOTSTRAP_ARBITER_FEE_TX_ID/);
  assert.match(harness, /BASELINE_DEPLOY_TX_ID/);
  assert.match(harness, /UPGRADE_TX_ID/);
  assert.doesNotMatch(harness, /LAST_TX=/);
  assert.doesNotMatch(harness, /query transaction/);
  assert.match(harness, /v1_bounty_before_upgrade/);
  assert.match(harness, /v1_bounty_after_upgrade/);
  assert.match(harness, /fund_bounty/);
  assert.match(harness, /lock_reward/);
  assert.match(harness, /refund_bounty/);
  assert.match(harness, /fund_bounty_v2/);
  assert.match(harness, /lock_reward_v2/);
  assert.match(harness, /release_reward_v2/);
  assert.match(harness, /refund_bounty_v2/);
  assert.match(harness, /record_event "status" "COMPLETED"/);
  assert.doesNotMatch(harness, /BLOCKED_LOCAL_KEY_EXECUTION_REQUIRED/);
});

test("full Escrow E2E reaches every v2 state and Credits conservation in order", () => {
  const steps = [
    "v2-create-bounty",
    "fund-v2-bounty",
    "v2-fund-replay",
    "v2-submit-paid-claim",
    "v2-lock-paid-claim",
    "v2-request-details",
    "v2-share-details",
    "v2-mark-patched",
    "v2-release-reward",
    "v2-release-replay",
    "v2-submit-rejected-claim",
    "v2-lock-rejected-claim",
    "v2-owner-cannot-reject",
    "v2-arbiter-reject",
    "v2-close-bounty",
    "v2-refund-bounty",
    "v2-refund-replay",
    "v2-program-conservation",
  ];

  let previous = -1;
  for (const step of steps) {
    const current = harness.indexOf(step);
    assert.ok(current > previous, `${step} must follow the previous E2E stage`);
    previous = current;
  }
  assert.match(harness, /assert_balance_delta "v2-release-whitehat-credits"/);
  const captureMapping = harness.slice(
    harness.indexOf("capture_mapping()"),
    harness.indexOf("assert_mapping_matches()"),
  );
  assert.match(captureMapping, /local mapping_result=""/);
  assert.doesNotMatch(captureMapping, /local value=""/);
  assert.match(harness, /assert_mapping_unchanged "v2-paid-receipt-preserved"/);
  assert.match(harness, /assert_mapping_unchanged "v2-rejected-receipt-preserved"/);
  assert.match(harness, /record_event "credits-conservation" "passed"/);
});

test("execution transaction parser accepts exactly one explicit main transaction", () => {
  const output = "Broadcasted transaction with:\n  - transaction ID: 'at1main123'";
  assert.equal(extractUniquePublicId(output, executionTransactionLine, "at1"), "at1main123");
});

test("execution transaction parser ignores fee transaction IDs", () => {
  const output = [
    "Broadcasted transaction with:",
    "  - transaction ID: 'at1main123'",
    "  - fee ID: 'au1fee123'",
    "  - fee transaction ID: 'at1fee123'",
  ].join("\n");

  assert.equal(extractUniquePublicId(output, executionTransactionLine, "at1"), "at1main123");
  assert.equal(extractUniquePublicId(output, feeIdLine, "au1"), "au1fee123");
  assert.equal(extractUniquePublicId(output, feeTransactionLine, "at1"), "at1fee123");
});

test("execution transaction parser rejects missing or duplicate explicit main IDs", () => {
  assert.equal(extractUniquePublicId("Broadcasted transaction with no receipt", executionTransactionLine, "at1"), undefined);
  assert.equal(
    extractUniquePublicId("- transaction ID: 'at1first'\n- transaction ID: 'at1second'", executionTransactionLine, "at1"),
    undefined,
  );
});

test("execution transaction parser ignores URL and prior-log transaction-like text", () => {
  const output = [
    "https://localhost/testnet/transaction/confirmed/at1fromurl",
    "old log transaction: at1frompreviousrun",
    "- fee transaction ID: 'at1feeonly'",
  ].join("\n");
  assert.equal(extractUniquePublicId(output, executionTransactionLine, "at1"), undefined);
});

test("Aleo u64 balance parser preserves the literal value without its type suffix", () => {
  const valid: Array<[string, bigint]> = [
    ['"10000000u64"', 10_000_000n],
    ["10000000u64", 10_000_000n],
    ['  "0u64"  ', 0n],
    ['"64u64"', 64n],
    ['"500000000u64"', 500_000_000n],
    ['"9374999894112u64"', 9_374_999_894_112n],
  ];

  for (const [raw, expected] of valid) {
    assert.equal(parseAleoU64Literal(raw), expected, raw);
  }
  assert.notEqual(parseAleoU64Literal("10000000u64"), 10_000_000_064n);
  assert.notEqual(parseAleoU64Literal("500000000u64"), 500_000_000_064n);
  assert.match(harness, /parse_aleo_u64\(\)/);
  assert.doesNotMatch(harness, /tr -cd '0-9'|sed 's\/\[\^0-9\]\/\/g'/);
});

test("Aleo u64 balance parser rejects invalid literals and does not turn missing mappings into numbers", () => {
  for (const raw of [
    "10000000u32",
    "10000000field",
    "abc10000000u64",
    "10000000u64abc",
    "10000000u64 64",
    "null",
    '""',
    "HTTP 404 not found",
  ]) {
    assert.equal(parseAleoU64Literal(raw), undefined, raw);
  }

  assert.deepEqual(readMappingU64ForTest(200, "null"), { status: "ABSENT" });
  assert.deepEqual(readMappingU64ForTest(404, "not found"), { status: "ABSENT" });
  assert.deepEqual(readMappingU64ForTest(503, "503 service unavailable"), { status: "ERROR" });
  assert.deepEqual(readMappingU64ForTest(200, "10000000u32"), { status: "ERROR" });
  assert.deepEqual(readMappingU64ForTest(200, '"10000000u64"'), {
    status: "FOUND",
    value: 10_000_000n,
  });
  assert.match(harness, /READ_MAPPING_U64_STATUS="ABSENT"/);
  assert.match(harness, /read_mapping_u64 "credits\.aleo\/account"/);
});

test("confirmed fee parsing handles accepted executions and rejected fee wrappers", () => {
  const executionId = "at1confirmedexecute";
  const feeId = "at1confirmedfee";
  const confirmedExecution = JSON.stringify({
    status: "accepted",
    type: "execute",
    transaction: {
      type: "execute",
      id: executionId,
      fee: {
        transition: {
          inputs: [{ type: "public", value: "13028u64" }, { type: "public", value: "0u64" }],
        },
      },
    },
  });
  const rejectedFee = JSON.stringify({
    status: "rejected",
    type: "execute",
    transaction: {
      type: "fee",
      id: feeId,
      fee: {
        transition: {
          inputs: [{ type: "public", value: "19391u64" }, { type: "public", value: "0u64" }],
        },
      },
    },
  });

  assert.equal(parseConfirmedPublicFeeMicrocredits(confirmedExecution, executionId, "execute"), 13_028n);
  assert.equal(parseConfirmedPublicFeeMicrocredits(rejectedFee, feeId, "fee"), 19_391n);
  assert.equal(parseConfirmedPublicFeeMicrocredits(confirmedExecution, "at1other", "execute"), undefined);
  assert.equal(parseConfirmedPublicFeeMicrocredits(confirmedExecution, executionId, "fee"), undefined);
  assert.equal(parseConfirmedPublicFeeMicrocredits(rejectedFee, feeId, "execute"), undefined);
  assert.equal(parseConfirmedPublicFeeMicrocredits('{"type":"fee","id":"at1confirmedfee"}', feeId, "fee"), undefined);
  assert.equal(parseConfirmedPublicFeeMicrocredits("not json", feeId, "fee"), undefined);
  assert.match(harness, /confirmed_public_fee_microcredits\(\)/);
  assert.match(harness, /const transaction = confirmed\?\.transaction/);
  assert.match(harness, /transaction\?\.type !== expectedType/);
  assert.match(harness, /transaction\?\.id !== expectedId/);
  assert.match(harness, /LAST_CONFIRMED_TRANSACTION_RESPONSE/);
  assert.match(harness, /CONFIRMED_FEE_LOOKUP_ATTEMPTS/);
  assert.match(harness, /node --input-type=module -e/);
});

test("Credits arithmetic uses parsed integer microcredits without Number precision loss", () => {
  const before = parseAleoU64Literal("9374999894112u64");
  const funding = parseAleoU64Literal("10000000u64");
  assert.ok(before !== undefined);
  assert.ok(funding !== undefined);
  const after = before + funding;

  assert.equal(after - before, 10_000_000n);
  assert.equal(formatMicrocreditsForTest(before), "9374999.894112");
  assert.equal(formatMicrocreditsForTest(500_000_000n), "500.000000");
  assert.match(harness, /actual_delta=\$\(\(10#\$\{after\} - 10#\$\{before\}\)\)/);
  assert.match(harness, /expected balance delta:/);
  assert.match(harness, /actual balance delta:/);
});

test("legacy guard failures are classified as local Leo execution failures", () => {
  const output = [
    "Stack evaluation failed:",
    "Instruction (assert.eq r1 0u64;)",
    "failed: '100u64' is not equal to '0u64'",
  ].join("\n");

  assert.equal(isExpectedLocalExecutionFailure(output, 1), true);
  assert.equal(isExpectedLocalExecutionFailure(output, 0), false);
  assert.equal(isExpectedLocalExecutionFailure("Stack evaluation stopped\nassert.eq\nfailed", 1), false);
  assert.equal(isExpectedLocalExecutionFailure(`${output}\n- transaction ID: 'at1unexpected'`, 1), false);
});

test("local execution failures never enter transaction parsing, block advancement, or chain polling", () => {
  const localStart = harness.indexOf("expect_leo_execution_failure() {");
  const localEnd = harness.indexOf("expect_chain_rejected() {");
  const localExecutor = harness.slice(localStart, localEnd);
  const chainStart = harness.indexOf("expect_chain_rejected() {");
  const chainEnd = harness.indexOf("query_mapping() {");
  const chainExecutor = harness.slice(chainStart, chainEnd);

  assert.match(localExecutor, /run_leo/);
  assert.match(localExecutor, /\(\(exit_code != 0\)\)/);
  assert.match(harness, /expect_leo_execution_failure "fund-v1-bounty" "Stack evaluation failed" "assert\.eq" "failed"/);
  assert.match(localExecutor, /LAST_BROADCAST_OUTPUT=""/);
  assert.doesNotMatch(localExecutor, /store_step_transaction_ids|advance_broadcast_block|wait_for_rejected_transaction/);
  assert.match(chainExecutor, /store_step_transaction_ids/);
  assert.match(chainExecutor, /advance_broadcast_block/);
  assert.match(chainExecutor, /wait_for_rejected_transaction/);
});

test("legacy fund rejection asserts public balances and all relevant mappings are unchanged", () => {
  const start = harness.indexOf('expect_leo_execution_failure "fund-v1-bounty"');
  const end = harness.indexOf('expect_leo_execution_failure "lock-v1-claim"');
  const legacyFund = harness.slice(start, end);

  assert.match(harness, /capture_mapping_or_null\(\)/);
  assert.match(harness, /assert_mapping_absent\(\)/);
  assert.match(legacyFund, /assert_balance_delta "fund-v1-owner-balance"/);
  assert.match(legacyFund, /assert_balance_delta "fund-v1-program-balance"/);
  assert.match(legacyFund, /assert_mapping_unchanged "fund-v1-bounty-state"/);
  assert.match(legacyFund, /assert_mapping_unchanged "fund-v1-nullifier-state"/);
  assert.match(legacyFund, /assert_mapping_unchanged "fund-v1-receipt-state"/);
  assert.match(legacyFund, /fund-v1-no-v2-escrow/);
  assert.match(legacyFund, /fund-v1-no-v2-protocol-version/);
  assert.match(legacyFund, /fund-v1-no-v2-payout/);
  assert.match(legacyFund, /fund-v1-no-v2-triage/);
  assert.match(legacyFund, /fund-v1-no-operation-marker/);
  assert.match(harness, /\[%s\] transaction generated: no/);
  assert.match(harness, /\[%s\] transaction broadcast: no/);
  assert.match(legacyFund, /legacy funding disabled: passed/);
});

test("legacy guard checks complete before the first v2 funding transaction", () => {
  const legacyFund = harness.indexOf('expect_leo_execution_failure "fund-v1-bounty"');
  const legacyLock = harness.indexOf('expect_leo_execution_failure "lock-v1-claim"');
  const legacyRefund = harness.indexOf('expect_leo_execution_failure "refund-v1-bounty"');
  const v2Fund = harness.indexOf('execute_accepted "fund-v2-bounty"');

  assert.ok(legacyFund >= 0 && legacyLock > legacyFund && legacyRefund > legacyLock && v2Fund > legacyRefund);
  assert.match(harness, /expect_chain_rejected "v2-fund-replay"/);
  assert.doesNotMatch(harness, /expect_rejected\(\)/);
});

test("Bootstrap confirmation remains state-first and never re-broadcasts during polling", () => {
  const confirmationStart = harness.indexOf("wait_for_step_confirmation() {");
  const confirmationEnd = harness.indexOf("assert_accepted() {");
  const confirmation = harness.slice(confirmationStart, confirmationEnd);
  const bootstrapAccountStart = harness.indexOf("bootstrap_account() {");
  const bootstrapAccountEnd = harness.indexOf("bootstrap_test_accounts() {");
  const bootstrapAccount = harness.slice(bootstrapAccountStart, bootstrapAccountEnd);
  const bootstrapStart = harness.indexOf("bootstrap_test_accounts() {");
  const bootstrapEnd = harness.indexOf("run_leo() {");
  const bootstrap = harness.slice(bootstrapStart, bootstrapEnd);

  assert.ok(confirmation.indexOf('"${state_check}"') < confirmation.indexOf('lookup_confirmed_transaction "${tx_id}"'));
  assert.match(confirmation, /waiting for expected public state/);
  assert.match(confirmation, /i % 10 == 0/);
  assert.match(confirmation, /report_fee_transaction_lookup/);
  assert.doesNotMatch(confirmation, /run_leo/);
  assert.equal((bootstrapAccount.match(/run_leo /g) ?? []).length, 1);
  assert.doesNotMatch(bootstrapAccount, /--no-local|execution_source_args/);
  assert.equal((bootstrap.match(/bootstrap_account /g) ?? []).length, 2);
});

test("manual-block Devnode advances exactly once after each broadcast before waiting for state", () => {
  const acceptedStart = harness.indexOf("assert_accepted() {");
  const acceptedEnd = harness.indexOf("wait_for_rejected_transaction() {");
  const accepted = harness.slice(acceptedStart, acceptedEnd);
  const rejectedStart = harness.indexOf("expect_chain_rejected() {");
  const rejectedEnd = harness.indexOf("query_mapping() {");
  const rejected = harness.slice(rejectedStart, rejectedEnd);

  assert.match(harness, /--manual-block-creation/);
  assert.match(harness, /advance_broadcast_block\(\)/);
  assert.ok(accepted.indexOf("store_step_transaction_ids") < accepted.indexOf("advance_broadcast_block"));
  assert.ok(accepted.indexOf("advance_broadcast_block") < accepted.indexOf("wait_for_step_confirmation"));
  assert.ok(rejected.indexOf("advance_broadcast_block") < rejected.indexOf("wait_for_rejected_transaction"));
  assert.match(harness, /advancing one local Devnode block for the broadcast/);
  assert.doesNotMatch(accepted, /run_leo/);
});

test("Devnode block height reads tolerate bounded transient RPC timeouts", () => {
  const start = harness.indexOf("current_height() {");
  const end = harness.indexOf("advance_blocks() {", start);
  const currentHeight = harness.slice(start, end);
  assert.match(harness, /readonly DEVNODE_HEIGHT_READ_ATTEMPTS=5/);
  assert.match(currentHeight, /attempt <= DEVNODE_HEIGHT_READ_ATTEMPTS/);
  assert.match(currentHeight, /curl -fsS --max-time 3/);
  assert.match(currentHeight, /kill -0 "\$\{ALEO_E2E_DEVNODE_PID\}"/);
  assert.match(currentHeight, /sleep 1/);
  assert.match(currentHeight, /remained unavailable after/);
});

test("Bootstrap diagnostics do not mistake an undeployed program for a transfer failure", () => {
  assert.match(harness, /\[\[ "\$\{label\}" == bootstrap-\* \]\]/);
  assert.match(harness, /Bootstrap does not deploy a program/);
  assert.match(harness, /HTTP_RESPONSE_STATUS="\$\{HTTP_RESPONSE_STATUS\/\/\$'\\r'\/\}"/);
  assert.match(harness, /\[\[ "\$\{HTTP_RESPONSE_STATUS\}" =~ \^\[0-9\]\{3\}\$ \]\]/);
});

test("Escrow Devnode harness bounds confirmed-transaction polling and diagnoses HTTP 500 once", () => {
  assert.match(harness, /readonly TRANSACTION_WAIT_ATTEMPTS=60/);
  assert.match(harness, /readonly TRANSACTION_500_ATTEMPTS=3/);
  assert.match(harness, /for \(\(i = 1; i <= TRANSACTION_WAIT_ATTEMPTS; i\+\+\)\)/);
  assert.match(harness, /\/testnet\/transaction\/confirmed\/\$\{tx_id\}/);
  assert.match(harness, /--write-out '%\{http_code\}'/);
  assert.match(harness, /case "\$\{HTTP_RESPONSE_STATUS\}" in/);
  assert.match(harness, /404\)/);
  assert.match(harness, /500\)/);
  assert.match(harness, /consecutive_server_errors/);
  assert.match(harness, /\[\[ "\$\{printed_500\}" == "0" \]\]/);
  assert.match(harness, /print_sanitized_devnode_log/);
  assert.match(harness, /timed out waiting for transaction/);
  assert.doesNotMatch(harness, /while true/);
  assert.doesNotMatch(harness, /until command/);
});

test("Escrow Devnode harness treats public state as the primary confirmation signal", () => {
  const stateCheck = harness.indexOf('if [[ -n "${state_check}" ]] && "${state_check}"; then');
  const confirmedLookup = harness.indexOf('lookup_confirmed_transaction "${tx_id}"');
  assert.ok(stateCheck >= 0 && confirmedLookup > stateCheck);
  assert.match(harness, /public_credits_balance/);
  assert.match(harness, /check_bootstrap_whitehat_state/);
  assert.match(harness, /check_bootstrap_arbiter_state/);
  assert.match(harness, /check_baseline_program_state/);
  assert.match(harness, /state confirmation: passed/);
  assert.match(harness, /transaction lookup: unavailable_500/);
  assert.match(harness, /\/testnet\/program\/\$\{PROGRAM_ID\}\/mapping\/\$\{mapping\}\/\$\{key\}/);
});

test("Escrow Devnode harness uses the same Credits Bootstrap before both modes diverge", () => {
  const mainStart = harness.indexOf("main() {");
  const bootstrapBranch = harness.indexOf('if is_bootstrap_stage; then', mainStart);
  const developmentBranch = harness.indexOf('if is_development_stage; then', mainStart);
  const sourcePreparation = harness.indexOf('prepare_real_testnet_edition_zero_sources', mainStart);
  const bootstrapCredits = harness.indexOf('bootstrap_test_accounts', mainStart);
  const baselineDeploy = harness.indexOf('deploy_baseline', mainStart);
  const fullPatch = harness.indexOf('patch_local_only_admins', bootstrapBranch);
  assert.ok(mainStart >= 0 && sourcePreparation > mainStart && developmentBranch > sourcePreparation && bootstrapBranch > sourcePreparation);
  assert.ok(bootstrapCredits > mainStart && bootstrapCredits < bootstrapBranch);
  assert.ok(bootstrapCredits < baselineDeploy);
  assert.ok(fullPatch > bootstrapBranch && fullPatch < baselineDeploy);
  assert.match(harness, /ESCROW_DEVNODE_STAGE/);
  assert.match(harness, /credits\.aleo::transfer_public/);
  assert.match(harness, /bootstrap-whitehat/);
  assert.match(harness, /bootstrap-arbiter/);
  assert.match(harness, /No program deployment, upgrade, or Escrow transition was run/);
  assert.match(harness, /bootstrap-balances/);
  assert.match(harness, /ALEO_E2E_BOOTSTRAP_COMPLETE=0/);
  assert.match(harness, /ALEO_E2E_BOOTSTRAP_COMPLETE=1/);
  assert.doesNotMatch(harness, /bootstrap_local_credits/);
  assert.match(harness, /if is_bootstrap_stage; then\n    write_public_report/);
  const provisionStart = harness.indexOf("provision_local_accounts() {");
  const bootstrapStart = harness.indexOf("if is_bootstrap_stage; then", mainStart);
  const whitehatKeyPrompt = harness.indexOf('prompt_secret WHITEHAT_PRIVATE_KEY', provisionStart);
  const arbiterKeyPrompt = harness.indexOf('prompt_secret ARBITER_PRIVATE_KEY', provisionStart);
  assert.ok(provisionStart >= 0 && whitehatKeyPrompt > provisionStart && arbiterKeyPrompt > provisionStart);
  assert.ok(whitehatKeyPrompt < bootstrapStart && arbiterKeyPrompt < bootstrapStart);
});

test("full E2E cannot reach Whitehat submission before the shared Bootstrap completes", () => {
  const mainStart = harness.indexOf("main() {");
  const bootstrapCall = harness.indexOf("bootstrap_test_accounts", mainStart);
  const baselineDeploy = harness.indexOf("deploy_baseline", mainStart);
  const submitClaim = harness.indexOf('execute_accepted "v1-submit-claim"', mainStart);
  const fullBootstrap = harness.slice(mainStart, baselineDeploy);

  assert.ok(bootstrapCall > mainStart && bootstrapCall < baselineDeploy && baselineDeploy < submitClaim);
  assert.match(fullBootstrap, /assert_owner_has_deployment_balance/);
  assert.match(harness, /assert_bootstrap_complete_for_role/);
  assert.match(harness, /Whitehat\|Arbiter/);
  assert.match(harness, /account bootstrap has not completed before/);
});

test("role transactions require public Credits using integer microcredits", () => {
  const rolePreparationStart = harness.indexOf("prepare_role_transaction() {");
  const rolePreparationEnd = harness.indexOf("print_transaction_diagnostics() {");
  const rolePreparation = harness.slice(rolePreparationStart, rolePreparationEnd);
  const submitClaim = harness.slice(harness.indexOf('execute_accepted "v1-submit-claim"'), harness.indexOf("local v1_claim_hash"));

  assert.match(harness, /MICROCREDITS_PER_CREDIT=1000000/);
  assert.match(harness, /BOOTSTRAP_TRANSFER_MICROCREDITS=5000000000/);
  assert.match(harness, /MINIMUM_ROLE_TRANSACTION_MICROCREDITS=100000000/);
  assert.match(harness, /10#\$\{balance\}/);
  assert.match(harness, /insufficient local public Credits/);
  assert.match(harness, /address: %s/);
  assert.doesNotMatch(harness, /Private Key.*balance/);
  assert.match(rolePreparation, /require_public_balance/);
  assert.match(submitClaim, /"Whitehat" "\$\{WHITEHAT_ADDRESS\}" "\$\{MINIMUM_ROLE_TRANSACTION_MICROCREDITS\}"/);
});

test("Bootstrap cannot reuse ledger state or old transaction IDs", () => {
  const bootstrapStart = harness.indexOf("bootstrap_test_accounts() {");
  const bootstrapEnd = harness.indexOf("run_leo() {");
  const bootstrap = harness.slice(bootstrapStart, bootstrapEnd);

  assert.match(harness, /clean_local_ledger/);
  assert.match(bootstrap, /\[\[ "\$\{ALEO_E2E_BOOTSTRAP_COMPLETE\}" == "0" \]\]/);
  assert.match(bootstrap, /bootstrap may not reuse a prior local Devnode ledger/);
  assert.match(bootstrap, /ALEO_E2E_BOOTSTRAP_COMPLETE=1/);
  assert.doesNotMatch(bootstrap, /REPORT_FILE/);
  assert.doesNotMatch(bootstrap, /old transaction|previous transaction/i);
});

test("Bootstrap failure stops the full E2E before deployment and exposes public diagnostics only", () => {
  const bootstrapCall = harness.indexOf("bootstrap_test_accounts", harness.indexOf("main() {"));
  const baselineDeploy = harness.indexOf("deploy_baseline", harness.indexOf("main() {"));
  const bootstrapStart = harness.indexOf("bootstrap_test_accounts() {");
  const bootstrapEnd = harness.indexOf("run_leo() {");
  const bootstrap = harness.slice(bootstrapStart, bootstrapEnd);
  const bootstrapAccountStart = harness.indexOf("bootstrap_account() {");
  const bootstrapAccountEnd = harness.indexOf("bootstrap_test_accounts() {");
  const bootstrapAccount = harness.slice(bootstrapAccountStart, bootstrapAccountEnd);

  assert.ok(bootstrapCall < baselineDeploy);
  assert.match(bootstrapAccount, /assert_accepted/);
  assert.match(bootstrap, /public balance verification failed/);
  assert.match(bootstrap, /bootstrap-whitehat/);
  assert.match(bootstrap, /bootstrap-arbiter/);
  assert.match(harness, /state confirmation: passed/);
});

test("Escrow Devnode harness validates Windows-created worktrees from the root repository", () => {
  assert.match(harness, /git -C "\$\{ROOT_DIR\}" worktree list --porcelain/);
  assert.match(harness, /wslpath -w/);
  assert.match(harness, /assert_worktree_ref "\$\{CANDIDATE_WORKTREE_DIR\}" "\$\{CANDIDATE_REF\}"/);
  assert.match(harness, /materialize_real_testnet_edition_zero_baseline/);
  assert.match(harness, /candidate_worktree_status/);
  assert.match(harness, /-c core\.autocrlf=true --git-dir="\$\{candidate_gitdir\}" --work-tree="\$\{CANDIDATE_WORKTREE_DIR\}" status --porcelain=v1/);
  assert.doesNotMatch(harness, /assert_worktree_ref "\$\{BASELINE_DIR\}" "pre-escrow-upgrade"/);
  assert.doesNotMatch(harness, /git -C "\$\{BASELINE_DIR\}"/);
  assert.doesNotMatch(harness, /git -C "\$\{CANDIDATE_DIR\}"/);
});

test("Protocol V3 Devnode harness selects an explicit Candidate and keeps the SHA gate fail-closed", () => {
  assert.match(harness, /V3_CANDIDATE_WORKTREE/);
  assert.match(harness, /readonly CANDIDATE_REF="\$\{CANDIDATE_REF:-/);
  assert.match(harness, /candidate HEAD mismatch/);
  assert.match(harness, /candidate HEAD match/);
  assert.match(harness, /MATCH/);
  assert.match(harness, /explicit V3 Candidate worktree/);
});
test("Protocol V3 Devnode harness validates the frozen Git blob and permits checkout-only CRLF conversion", () => {
  assert.match(harness, /V3_R2_CANONICAL_COMMIT="15b3d860948623d66eb957c69336b45af582c398"/);
  assert.match(harness, /V3_R2_CANONICAL_MAIN_LEO_SHA256="75883ade8223f549db44c2d2ede0d0834bdafd3f34f5cb4d139f3a6168617247"/);
  assert.match(harness, /assert_protocol_v3_source_integrity/);
  assert.match(harness, /git -C "\$\{ROOT_DIR\}" show "\$\{expected_ref\}:\$\{MAIN_LEO_RELATIVE_PATH\}"/);
  assert.match(harness, /normalized = raw\.replace\(b"\\r\\n", b"\\n"\)/);
  assert.match(harness, /if b"\\r" in normalized/);
  assert.match(harness, /R2 source integrity: FAIL/);
  assert.match(harness, /checkout normalized SHA256/);
  assert.match(harness, /canonical source integrity: PASS/);
  assert.match(harness, /status --porcelain=v1/);
  assert.match(harness, /candidate worktree is dirty/);
});

test("Escrow Devnode harness restores locally patched source without relying on a worktree .git file", () => {
  assert.match(harness, /backup_test_sources/);
  assert.match(harness, /BASELINE_SOURCE_BACKUP/);
  assert.match(harness, /BASELINE_PROGRAM_BACKUP/);
  assert.match(harness, /CANDIDATE_SOURCE_BACKUP/);
  assert.match(harness, /cp -- "\$\{BASELINE_SOURCE_BACKUP\}"/);
  assert.match(harness, /cp -- "\$\{BASELINE_PROGRAM_BACKUP\}"/);
  assert.match(harness, /cp -- "\$\{CANDIDATE_SOURCE_BACKUP\}"/);
});

test("Protocol V3 materializes an isolated WSL Leo execution workspace after source integrity checks", () => {
  const mainStart = harness.indexOf("main() {");
  const mainBody = harness.slice(mainStart);
  const integrityGate = mainBody.indexOf("assert_protocol_v3_source_integrity");
  const executionMaterialization = mainBody.indexOf("materialize_v3_execution_workspaces");

  assert.match(harness, /readonly BASELINE_WORKTREE_DIR=/);
  assert.match(harness, /readonly CANDIDATE_WORKTREE_DIR=/);
  assert.match(harness, /v3_execution_root\(\)/);
  assert.match(harness, /development execution workspace must be below/);
  assert.match(harness, /final execution workspace must be below/);
  assert.match(harness, /materialize_v3_leo_package\(\)/);
  assert.match(harness, /cmp -s "\$\{source_main\}" "\$\{destination_main\}"/);
  assert.match(harness, /cmp -s "\$\{source_manifest\}" "\$\{destination_manifest\}"/);
  assert.match(harness, /BASELINE_DIR="\$\{execution_root\}\/baseline"/);
  assert.match(harness, /CANDIDATE_DIR="\$\{execution_root\}\/candidate"/);
  assert.match(harness, /cleanup_v3_execution_workspaces\(\)/);
  assert.ok(integrityGate >= 0 && executionMaterialization > integrityGate, "source integrity must precede execution-copy creation");
});

test("Protocol V3 writes runtime-heavy logs and reports to the WSL run directory", () => {
  assert.match(harness, /configure_v3_runtime_paths\(\)/);
  assert.match(harness, /REPORT_DIR="\$\{runtime\}\/reports"/);
  assert.match(harness, /DIAGNOSTIC_DIR="\$\{runtime\}\/logs"/);
  assert.match(harness, /ALEO_E2E_DEVNODE_LOG="\$\{runtime\}\/devnode\.log"/);
  assert.match(harness, /development runtime artifacts must be below/);
  assert.match(harness, /final runtime artifacts must be below/);
});

test("Escrow Devnode harness compiles its materialized Edition 0 baseline with the Leo 4.4 manifest", () => {
  assert.match(harness, /cp -- "\$\{ROOT_DIR\}\/leo\/bug_proof\/program\.json"/);
  assert.match(harness, /local Edition 0 baseline must use the Leo 4\.4 compiler manifest/);
});

test("Escrow Devnode harness snapshots the root Candidate", () => {
  assert.match(harness, /ROOT_CANDIDATE_SOURCE[\s\S]*materialize_root_candidate_snapshot[\s\S]*submit_claim_v2/);
});

test("Escrow Devnode harness delegates all production role replacements to the local-only patcher", () => {
  assert.match(harness, /scripts\/patch-devnode-admins\.mjs/);
  assert.match(harness, /local owner_address="\$\{OWNER_ADDRESS:-\}"/);
  assert.match(harness, /local arbiter_address="\$\{ARBITER_ADDRESS:-\}"/);
  assert.doesNotMatch(harness, /source\.replace\(/);
});

test("Escrow Devnode harness uses child-only network variables and a tracked Devnode PID", () => {
  assert.match(harness, /readonly ALEO_E2E_NETWORK="testnet"/);
  assert.match(harness, /readonly ALEO_E2E_PORT="\$\{ZKBB_DEVNODE_PORT:-3030\}"/);
  assert.match(harness, /readonly ALEO_E2E_ENDPOINT="\$\{ZKBB_DEVNODE_ENDPOINT:-http:\/\/127\.0\.0\.1:\$\{ALEO_E2E_PORT\}\}"/);
  assert.match(harness, /readonly ALEO_E2E_SOCKET_ADDR="127\.0\.0\.1:\$\{ALEO_E2E_PORT\}"/);
  assert.match(harness, /env \\\n\s+"NETWORK=\$\{ALEO_E2E_NETWORK\}"/);
  assert.match(harness, /ALEO_E2E_DEVNODE_PID=\$!/);
  assert.match(harness, /wait_for_http/);
  assert.match(harness, /cleanup_devnode/);
  assert.match(harness, /--manual-block-creation/);
  assert.match(harness, /MINIMUM_V9_BLOCK_ADVANCE=20/);
  assert.match(harness, /advance_blocks "\$\{MINIMUM_V9_BLOCK_ADVANCE\}"/);
  assert.match(harness, /read_devnode_consensus_version/);
  assert.match(harness, /wait_for_v9_consensus/);
  assert.match(harness, /local Devnode did not reach Leo V9 consensus/);
  assert.doesNotMatch(harness, /readonly NETWORK/);
  assert.doesNotMatch(harness, /unset NETWORK/);
});

test("Escrow Devnode harness reuses the funded owner for local Devnode startup and redacts CLI failures", () => {
  assert.match(harness, /DEVNODE_PRIVATE_KEY="\$\{OWNER_PRIVATE_KEY\}"/);
  assert.match(harness, /print_sanitized_leo_failure/);
  assert.match(harness, /sanitized CLI output follows/);
  assert.match(harness, /print_sanitized_devnode_log/);
  assert.doesNotMatch(harness, /tail -n 100 "\$\{ALEO_E2E_DEVNODE_LOG:-\/dev\/null\}" >&2/);
});

test("Escrow Devnode harness rejects malformed local key input before Devnode startup", () => {
  assert.match(harness, /readonly LOCAL_PRIVATE_KEY_LENGTH=59/);
  assert.match(harness, /validate_local_private_key/);
  assert.match(harness, /must be a single key token/);
  assert.match(harness, /received an Aleo address/);
  assert.match(harness, /received a View Key/);
  assert.match(harness, /local account key token/);
  assert.match(harness, /validate_local_private_key "\$\{prompt\}" "\$\{value\}"/);
  assert.match(harness, /Leo rejected the Devnode startup key before readiness/);
  assert.match(harness, /private_key_pattern="\^\$\{private_key_prefix\}1\[\[:alnum:\]_\]\+\$"/);
  assert.match(harness, /if ! preflight_key="\$\(generate_preflight_devnode_key\)"; then/);
});

test("Escrow Devnode harness cleanup is idempotent and cannot leave nounset variables", () => {
  assert.match(harness, /CLEANUP_DONE=0/);
  assert.match(harness, /if \[\[ "\$\{CLEANUP_DONE:-0\}" == "1" \]\]/);
  assert.match(harness, /handle_signal/);
  assert.match(harness, /OWNER_ADDRESS=""/);
  assert.match(harness, /unset OWNER_ADDRESS WHITEHAT_ADDRESS ARBITER_ADDRESS/);
  assert.match(harness, /assert_full_e2e_inputs/);
  assert.match(harness, /local owner address is unavailable before source patching/);
  assert.match(harness, /if \[\[ "\$\{BASH_SOURCE\[0\]\}" == "\$0" \]\]/);
});

test("Escrow Devnode harness reports interrupted interactive input instead of continuing", () => {
  assert.match(harness, /input was interrupted/);
  assert.match(harness, /if ! read -r -s -p/);
  assert.match(harness, /if ! read -r -s -p/);
});

test("Escrow Devnode harness supports a no-account local preflight", () => {
  assert.match(harness, /ESCROW_DEVNODE_PREFLIGHT_ONLY/);
  assert.match(harness, /generate_preflight_devnode_key/);
  assert.match(harness, /"\$\{LEO_BIN\}" account new/);
  assert.match(harness, /devnode-launch\.XXXXXX/);
  assert.match(harness, /Local Devnode preflight passed/);
  assert.match(harness, /No user-provided accounts, deployments, or transactions were used/);
});

test("Escrow Devnode harness requires a funded local deployment owner before deployment", () => {
  assert.match(harness, /MINIMUM_OWNER_MICROCREDITS=200000000/);
  assert.match(harness, /MINIMUM_OWNER_BOOTSTRAP_MICROCREDITS/);
  assert.match(harness, /require_public_balance "owner-balance" "Owner"/);
  assert.match(harness, /local Devnode owner lacks deployment and bootstrap Credits/);
  assert.match(harness, /assert_owner_has_deployment_balance/);
});

test("Escrow Devnode harness advances blocks sequentially before a V9 deployment", () => {
  assert.match(harness, /"\$\{LEO_BIN\}" devnode advance 1/);
  assert.match(harness, /local Devnode could not advance block/);
  assert.match(harness, /local Devnode did not advance block/);
  assert.match(harness, /10#\$\{next_height\} > 10#\$\{previous_height\}/);
});

test("Escrow Devnode harness derives its deploy baseline from the real Testnet edition 0 fixture", () => {
  assert.match(harness, /TESTNET_EDITION_ZERO_FIXTURE=/);
  assert.match(harness, /5f60a222cc989a55285258d1fa89ae46a6aa9e4487a396898e28cf94aa7afdf2/);
  assert.match(harness, /materialize_real_testnet_edition_zero_baseline/);
  assert.match(harness, /candidate_worktree_status/);
  assert.match(harness, /-c core\.autocrlf=true --git-dir="\$\{candidate_gitdir\}" --work-tree="\$\{CANDIDATE_WORKTREE_DIR\}" status --porcelain=v1/);
  assert.match(harness, /prepare_real_testnet_edition_zero_sources/);
  assert.match(harness, /\[baseline-source\] real Testnet edition 0 fixture/);
  assert.match(harness, /\[baseline-source\] historical Git baseline used: no/);
  assert.match(harness, /\[candidate-source\] root Candidate snapshot/);
  assert.match(harness, /refusing to use the historical Git baseline source/);
  assert.match(harness, /verify_testnet_edition_zero_interface/);
  assert.match(harness, /--ignore-constructor/);
  assert.doesNotMatch(harness, /assert_worktree_ref "\$\{BASELINE_DIR\}" "pre-escrow-upgrade"/);
  assert.doesNotMatch(harness, /api\.explorer\.provable\.com/);
});
test("Protocol V3 reproduction arbitration rejects a severity-only verdict and accepts the receipt severity", () => {
  assert.match(
    harness,
    /expect_chain_rejected "v3-reproduction-severity-only-vote"[\s\S]*cast_arbitration_vote_v3[\s\S]*"\$\{v3_claim_award\}" 2u8/,
  );
  assert.match(harness, /v3-reproduction-severity-only-tally[\s\S]*assert_mapping_unchanged/);
  assert.match(harness, /v3-arbiter-one-critical-vote[\s\S]*"\$\{v3_claim_award\}" 3u8/);
  assert.match(harness, /v3-arbiter-two-critical-vote[\s\S]*"\$\{v3_claim_award\}" 3u8/);
  assert.match(harness, /v3-critical-quorum[\s\S]*critical_votes:2u8/);
  assert.match(harness, /v3-settle-critical-award[\s\S]*3000000u64[\s\S]*1000000u64[\s\S]*3u8/);
  assert.match(harness, /paid_amount:3000000u64/);
  assert.match(harness, /refunded_amount:7000000u64/);
});

test("Protocol V3 Devnode harness uses a strict Leo struct reader and prints raw public mapping diagnostics before votes", () => {
  assert.match(harness, /scripts\/leo-struct-reader\.mjs/);
  assert.match(harness, /resolve_v3_dispute_mapping_key/);
  assert.match(harness, /claim_v3_active_disputes/);
  assert.match(harness, /Historical Edition 2 records have no active/);
  assert.match(harness, /capture_v3_mapping_with_diagnostics/);
  assert.match(harness, /HTTP content-type:/);
  assert.match(harness, /raw mapping value:/);
  assert.match(harness, /bounty_v3_configs\)\n\s+expected_fields=/);
  assert.match(harness, /claim_v3_dispute_metadata\)\n\s+expected_fields=/);
  assert.doesNotMatch(harness, /compact="\$\(printf '%s' "\$\{raw\}" \| tr -d/);
});
test("Protocol V3 Devnode harness parses dispute type independently from severity", () => {
  assert.match(harness, /v3_u8_value\(\)[\s\S]*\^\(\[0-9\]\+\)u8\$/);
  assert.match(harness, /v3_severity_value\(\)[\s\S]*\^\[0-3\]\$/);
  assert.match(harness, /dispute_type="\$\(v3_u8_value "\$\{dispute_type_literal\}"\)/);
  assert.match(harness, /verdict="\$\(v3_severity_value "\$\{verdict_literal\}"\)/);
});
test("Escrow Devnode diagnostics distinguish rejected execution from a fee transaction lookup", () => {
  assert.match(harness, /transaction_response_is_rejected_execution_fee/);
  assert.match(harness, /print_execute_rejection_diagnostics/);
  assert.match(harness, /original execute tx:/);
  assert.match(harness, /fee transaction:/);
  assert.match(harness, /rejection reason:/);
  assert.match(harness, /transaction_response_matches "\$\{fee_tx_id\}"/);
});
test("Protocol V3 Devnode wrapper enables the complete arbitration extension", () => {
  assert.match(protocolV3Harness, /export ZKBB_RUN_PROTOCOL_V3=1/);
  assert.match(protocolV3Harness, /V3_LEO_VERSION="4\.4\.0"/);
  assert.match(protocolV3Harness, /leo-toolchains\/\$\{V3_LEO_VERSION\}\/bin\/leo/);
  assert.match(protocolV3Harness, /Leo 4\.4\.0 is required/);
  assert.match(protocolV3Harness, /env -u LEO_BIN npm test/);
  assert.match(protocolV3Harness, /git -c core\.whitespace=cr-at-eol diff --check --/);
  assert.match(protocolV3Harness, /git diff --ignore-space-at-eol --exit-code -- leo\/bug_proof\/src\/main\.leo/);
  assert.match(protocolV3Harness, /scripts\/protocol-v3-final-dynamic-coverage\.sh/);
  assert.match(protocolV3Harness, /node scripts\/check-protocol-v3-harness-static\.mjs/);
  assert.match(protocolV3Harness, /export LEO_BIN="\$\{V3_E2E_LEO_BIN\}"/);
  assert.match(protocolV3Harness, /exec bash .*escrow-v2-devnode-e2e\.sh/);

  const steps = [
    "v3-create-bounty",
    "v3-fund-bounty",
    "v3-submit-award-claim",
    "v3-begin-review",
    "v3-accept-claim",
    "v3-lock-award",
    "v3-deliver-disclosure",
    "v3-acknowledge-disclosure",
    "v3-reproduction-rejected",
    "v3-open-dispute",
    "v3-reproduction-severity-only-vote",
    "v3-arbiter-one-critical-vote",
    "v3-arbiter-two-critical-vote",
    "v3-settle-critical-award",
    "v3-submit-reject-claim",
    "v3-duplicate-arbiter-vote",
    "v3-finalize-rejection",
    "v3-close-bounty",
    "v3-refund-bounty",
  ];

  let previous = harness.indexOf('if [[ "${ZKBB_RUN_PROTOCOL_V3:-0}" == "1" ]]');
  assert.ok(previous >= 0);
  for (const step of steps) {
    const current = harness.indexOf(step, previous + 1);
    assert.ok(current > previous, `${step} must follow the previous V3 E2E stage`);
    previous = current;
  }

  assert.match(harness, /generate_ephemeral_local_account/);
  assert.match(harness, /quorum: 2u8/);
  assert.match(harness, /assert_balance_delta "v3-program-conservation"/);
  assert.match(harness, /record_event "protocol-v3-award-flow" "passed"/);
  assert.match(harness, /record_event "protocol-v3-rejection-flow" "passed"/);
});

test("Protocol V3 final dynamic coverage is localhost-only, assertion-gated, and covers all dispute routes", () => {
  assert.match(harness, /source "\$\{ROOT_DIR\}\/scripts\/protocol-v3-final-dynamic-coverage\.sh"/);
  assert.match(harness, /run_protocol_v3_final_dynamic_coverage/);
  assert.match(harness, /V3_FINAL_COVERAGE_PASSED/);
  assert.match(harness, /report_v3_final_failure_once/);
  assert.match(harness, /final_e2e_exit_guard/);
  assert.doesNotMatch(harness, /Local Devnode Protocol V3 accepted and rejected arbitration flows passed/);

  for (const [name, type] of [["REJECTION", 1], ["DUPLICATE", 2], ["SCOPE", 3], ["SEVERITY", 4], ["REPRODUCTION", 5], ["REMEDIATION", 6]] as const) {
    assert.match(finalV3Coverage, new RegExp(`assert_v3_dispute_persistence "${name}"[\\s\\S]* ${type} `));
  }
  assert.match(finalV3Coverage, /v3-public-key-deriver/);
  assert.match(finalV3Coverage, /derive_vote_key/);
  assert.match(finalV3Coverage, /v3_active_dispute_id/);
  assert.match(finalV3Coverage, /v3_fixture_run derive_vote_key "\$\{bounty_id\}" "\$\{dispute_id\}"/);
  assert.match(finalV3Coverage, /derive_operation_marker/);
  assert.match(finalV3Coverage, /--offline --disable-update-check/);
  assert.doesNotMatch(finalV3Coverage, /DEVNODE_PRIVATE_KEY|PRIVATE_KEY=/);
  assert.match(finalV3Coverage, /generate_ephemeral_local_account non_arbiter_key non_arbiter_address "ephemeral V3 non-arbiter"/);
  assert.match(harness, /\(\(\$# == 3\)\) \|\| die "generate_ephemeral_local_account requires key variable, address variable, and label"/);
  assert.match(finalV3Coverage, /generated non-arbiter unexpectedly belongs to the panel/);
  assert.match(finalV3Coverage, /non-arbiter rejection: PASS/);
  assert.match(finalV3Coverage, /duplicate vote rollback: PASS/);
  assert.match(finalV3Coverage, /V3 failed-finalize atomic rollback: PASS/);
  assert.match(finalV3Coverage, /v3-final-remediation-timeout-before-deadline/);
  assert.match(finalV3Coverage, /remediation timeout pre-deadline atomicity: PASS/);
  assert.match(finalV3Coverage, /advance_blocks 61/);
  assert.match(finalV3Coverage, /v3-final-remediation-timeout-finalize/);
  assert.match(finalV3Coverage, /remediation timeout recovery: PASS/);
  assert.match(finalV3Coverage, /v3-final-remediation-retry-patch/);
  assert.match(finalV3Coverage, /v3-final-remediation-retry-accept/);
  assert.match(finalV3Coverage, /finalized dispute replay rejection: PASS/);
  assert.match(finalV3Coverage, /V3 refund replay: PASS/);
  assert.match(finalV3Coverage, /confirmed_public_fee_microcredits "\$\{label\}-refund-fee" "\$\{STEP_TX_ID\}" execute/);
  assert.match(finalV3Coverage, /10#\$\{refund_value\} - 10#\$\{refund_fee\}/);
  assert.match(finalV3Coverage, /confirmed_public_fee_microcredits "\$\{label\}-refund-replay-fee" "\$\{STEP_FEE_TX_ID\}" fee/);
  assert.match(finalV3Coverage, /-\$\(\(10#\$\{refund_replay_fee\}\)\)/);
  assert.match(finalV3Coverage, /immutable panel runtime: PASS/);
  assert.match(finalV3Coverage, /2\/3 one-vote settlement rejection: PASS/);
  assert.match(finalV3Coverage, /2\/3 two-vote settlement acceptance: PASS/);
  assert.match(finalV3Coverage, /3\/3 one-vote settlement rejection: PASS/);
  assert.match(finalV3Coverage, /3\/3 two-vote settlement rejection: PASS/);
  assert.match(finalV3Coverage, /3\/3 three-vote settlement acceptance: PASS/);
  assert.match(finalV3Coverage, /quorum: 3u8/);
  assert.match(finalV3Coverage, /Protocol V3 R2 FINAL DYNAMIC COVERAGE: PASS/);
  assert.match(finalV3Coverage, /printf '%s dispute: PASS\\n' "\$\{label\}"/);
  assert.match(finalV3Coverage, /assert_v3_dispute_persistence "REPRODUCTION"/);
  assert.match(finalV3Coverage, /six dispute types: PASS/);
  assert.match(finalV3Coverage, /Credits conservation: 0 microcredits/);
  assert.doesNotMatch(finalV3Coverage, /https?:\/\//);
});

test("Protocol V3 final coverage reuses deployed bytecode and skips the redundant V3 sample", () => {
  const acceptedStart = harness.indexOf("execute_accepted() {");
  const acceptedEnd = harness.indexOf("check_baseline_program_state() {");
  const accepted = harness.slice(acceptedStart, acceptedEnd);
  const rejectedStart = harness.indexOf("expect_chain_rejected() {");
  const rejectedEnd = harness.indexOf("query_mapping() {");
  const rejected = harness.slice(rejectedStart, rejectedEnd);

  assert.match(accepted, /execution_source_args=\(\)/);
  assert.match(accepted, /execution_source_args=\(--no-local\)/);
  assert.match(rejected, /execution_source_args=\(--no-local\)/);
  assert.match(harness, /This transfer happens before the baseline program is deployed/);
  assert.match(harness, /harness_time_begin v3-panel-bootstrap/);
  assert.match(harness, /protocol-v3-redundant-sample" "skipped-final-matrix-is-superset/);
  assert.match(harness, /final six-dispute matrix below already contains both/);
});
test("Protocol V3 development runner separates static, scenario, changed, and final modes", () => {
  assert.equal(packageJson.scripts["v3:preflight"], "bash scripts/protocol-v3-dev-runner.sh preflight");
  assert.equal(packageJson.scripts["v3:e2e"], "bash scripts/protocol-v3-dev-runner.sh e2e");
  assert.equal(packageJson.scripts["v3:e2e:changed"], "bash scripts/protocol-v3-dev-runner.sh changed");
  assert.equal(packageJson.scripts["v3:e2e:final"], "bash scripts/protocol-v3-dev-runner.sh final");
  assert.equal(packageJson.scripts["v3:e2e:final:parallel"], "bash scripts/protocol-v3-dev-runner.sh final-parallel");
  assert.match(developmentRunner, /run_preflight/);
  assert.match(developmentRunner, /static gates: cached PASS/);
  assert.match(developmentRunner, /ESCROW_DEVNODE_STAGE=\$\{harness_stage\}/);
  assert.match(developmentRunner, /ZKBB_DEV_SNAPSHOT_DIR=/);
  assert.match(developmentRunner, /run_final\(\)[\s\S]*final mode forbids resume, snapshot, reuse ledger, and stage overrides/);
  assert.match(developmentRunner, /final-run\.XXXXXX/);
  assert.match(developmentRunner, /127\.0\.0\.1:3030/);
});

test("Protocol V3 parallel final isolates fresh-ledger shards and keeps local role keys off disk and process arguments", () => {
  for (const shard of ["legacy", "two-core", "duplicate-scope", "severity", "reproduction-remediation", "three-of-three"]) {
    assert.match(parallelFinal, new RegExp(`\\b${shard}\\b`));
    assert.match(harness, new RegExp(`\\b${shard}\\b`));
  }
  assert.match(parallelFinal, /ZKBB_PARALLEL_WORKERS/);
  assert.match(parallelFinal, /ZKBB_PARALLEL_BASE_PORT/);
  assert.match(parallelFinal, /printf '%s\\n%s\\n%s\\n'[\s\S]*\|[\s\S]*final-shard/);
  assert.match(parallelFinal, /mktemp -d "\$\{DEVNODE_CACHE_ROOT\}\/parallel-final\.XXXXXX"/);
  assert.match(developmentRunner, /mktemp -d "\$\{DEVNODE_CACHE_ROOT\}\/final-run\.XXXXXX"/);
  assert.match(developmentRunner, /ZKBB_DEVNODE_PORT=\$\{port\}/);
  assert.match(developmentRunner, /ZKBB_DEVNODE_ENDPOINT=http:\/\/127\.0\.0\.1:\$\{port\}/);
  assert.match(parallelFinal, /local index="\$2"\s+local port="" log="" pid=""\s+port="\$\(\(10#\$\{BASE_PORT\} \+ index\)\)"/);
  assert.doesNotMatch(parallelFinal, /local[^\n]*index="\$2"[^\n]*port="\$\(\([^\n]*index/);
  assert.match(parallelFinal, /Protocol V3 R2 FINAL DYNAMIC COVERAGE: PASS/);
  assert.match(parallelFinal, /ZKBB_PARALLEL_RESUME_ROOT/);
  assert.match(parallelFinal, /REUSE PASS/);
  assert.match(parallelFinal, /resolve_resume_root/);
  assert.match(parallelFinal, /verify_shard_log/);
  assert.doesNotMatch(parallelFinal, />[^\n]*(OWNER|WHITEHAT|ARBITER).*KEY/);
  assert.doesNotMatch(parallelFinal, /export (PARALLEL_OWNER_KEY|PARALLEL_WHITEHAT_KEY|PARALLEL_ARBITER_KEY)/);
  assert.doesNotMatch(parallelFinal, /https?:\/\/(?!127\.0\.0\.1|localhost)/);
});

test("Protocol V3 development scenarios are bounded and never select an arbitrary business-state resume", () => {
  for (const scenario of ["reproduction", "dispute-types", "quorum-2", "quorum-3", "non-arbiter", "duplicate-vote", "settlement-replay", "refund-replay", "atomicity"]) {
    assert.match(developmentScenarios, new RegExp(`scenario_${scenario.replace(/-/g, "_")}\\(\\)`));
  }
  assert.match(developmentScenarios, /run_protocol_v3_development_scenario/);
  assert.doesNotMatch(developmentScenarios, /https?:\/\//);
  assert.match(harness, /development_snapshot_path/);
  assert.match(harness, /clone_development_snapshot/);
  assert.match(harness, /create_development_snapshot/);
  assert.match(harness, /snapshot ledger reuse is allowed only for development scenarios/);
  assert.match(harness, /final mode forbids snapshot or ledger reuse/);
});

test("Protocol V3 fail-fast credentials are derived, distinct, and unset after local cleanup", () => {
  const provisionStart = harness.indexOf("provision_local_accounts() {");
  const startDevnode = harness.indexOf("start_devnode() {");
  const provision = harness.slice(provisionStart, startDevnode);
  assert.match(provision, /prompt_secret OWNER_PRIVATE_KEY/);
  assert.match(provision, /prompt_secret WHITEHAT_PRIVATE_KEY/);
  assert.match(provision, /prompt_secret ARBITER_PRIVATE_KEY/);
  assert.match(provision, /derive_local_address/);
  assert.match(provision, /assert_distinct_local_roles/);
  assert.match(harness, /unset DEVNODE_PRIVATE_KEY OWNER_PRIVATE_KEY WHITEHAT_PRIVATE_KEY ARBITER_PRIVATE_KEY/);
  assert.match(harness, /development ledger must be an isolated run ledger/);
  assert.match(harness, /development and final ledgers must use the WSL filesystem/);
});

test("Protocol V3 static checker catches helper-arity regressions before Devnode startup", () => {
  assert.match(staticHarnessCheck, /generate_ephemeral_local_account must reject an invalid arity before Devnode startup/);
  assert.match(staticHarnessCheck, /requires exactly 3 arguments/);
  assert.match(developmentRunner, /check-protocol-v3-harness-static\.mjs/);
  assert.match(harness, /harness_time_begin bootstrap/);
  assert.match(harness, /harness_time_begin legacy/);
  assert.match(harness, /harness_time_begin v3-reproduction/);
  assert.match(harness, /declare -A E2E_TIME_LABEL_STARTED_MS=\(\)/);
  assert.match(harness, /local label="\$1"\n  local started="\$\{E2E_TIME_LABEL_STARTED_MS\[\$\{label\}\]:-\}"/);
  assert.match(staticHarnessCheck, /timer labels must be initialized/);
  for (const stage of ["six-disputes", "quorum-2", "quorum-3", "replay", "atomicity"]) {
    assert.match(finalV3Coverage, new RegExp(`harness_time_track_begin ${stage}`));
    assert.match(finalV3Coverage, new RegExp(`harness_time_track_end ${stage}`));
  }
  assert.match(harness, /write_sanitized_diagnostic/);
  assert.match(harness, /local-devnode\/logs/);
});
