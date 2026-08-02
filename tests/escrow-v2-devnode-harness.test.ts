import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const harness = readFileSync("scripts/escrow-v2-devnode-e2e.sh", "utf8");

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
  assert.match(harness, /http:\/\/127\.0\.0\.1:3030\|http:\/\/localhost:3030/);
  assert.match(harness, /refusing non-local endpoint/);
  assert.match(harness, /aleo-devnode-baseline/);
  assert.match(harness, /aleo-devnode-candidate/);
  assert.match(harness, /aleo-devnode-ledger/);
  assert.match(harness, /"\$\{LEO_BIN\}" devnode start --socket-addr 127\.0\.0\.1:3030/);
  assert.match(harness, /--storage "\$\{ALEO_E2E_LEDGER\}"/);
  assert.doesNotMatch(harness, /api\.explorer\.provable\.com/);
  assert.match(harness, /--clear-storage/);
});

test("Escrow Devnode harness never embeds or persists private credentials", () => {
  assert.match(harness, /set \+x/);
  assert.match(harness, /read -r -s -p/);
  assert.match(harness, /trap cleanup_all EXIT/);
  assert.match(harness, /trap 'handle_signal 130' INT/);
  assert.match(harness, /trap 'handle_signal 143' TERM/);
  assert.match(harness, /DEVNODE_PRIVATE_KEY=""/);
  assert.match(harness, /privateInputsPersisted: false/);
  assert.match(harness, /localKeysPersisted: false/);
  assert.doesNotMatch(harness, new RegExp(["APrivate", "Key"].join("")));
  assert.doesNotMatch(harness, /\.env/);
  assert.doesNotMatch(harness, /json-output|--save/);
  assert.doesNotMatch(harness, /Local-only Devnode bootstrap private key/);
  assert.match(harness, /assert_owner_has_deployment_balance/);
  assert.match(harness, /Do not use a Wallet or Testnet account/);
  assert.match(harness, /print_sanitized_text "\$\{LAST_OUTPUT\}"/);
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
  const sourcePreparation = harness.indexOf('prepare_real_testnet_edition_zero_sources', mainStart);
  const bootstrapCredits = harness.indexOf('bootstrap_test_accounts', mainStart);
  const baselineDeploy = harness.indexOf('deploy_baseline', mainStart);
  const fullPatch = harness.indexOf('patch_local_only_admins', bootstrapBranch);
  assert.ok(mainStart >= 0 && sourcePreparation > mainStart && bootstrapBranch > sourcePreparation);
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
  assert.match(harness, /if is_bootstrap_stage; then\n    return 0/);
  const bootstrapReturn = harness.indexOf('if is_bootstrap_stage; then\n    return 0');
  const whitehatKeyPrompt = harness.indexOf('prompt_secret WHITEHAT_PRIVATE_KEY');
  const arbiterKeyPrompt = harness.indexOf('prompt_secret ARBITER_PRIVATE_KEY');
  assert.ok(bootstrapReturn >= 0 && whitehatKeyPrompt > bootstrapReturn && arbiterKeyPrompt > bootstrapReturn);
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
  assert.match(harness, /assert_worktree_ref "\$\{CANDIDATE_DIR\}" "\$\{CANDIDATE_REF\}"/);
  assert.match(harness, /materialize_real_testnet_edition_zero_baseline/);
  assert.doesNotMatch(harness, /assert_worktree_ref "\$\{BASELINE_DIR\}" "pre-escrow-upgrade"/);
  assert.doesNotMatch(harness, /git -C "\$\{BASELINE_DIR\}"/);
  assert.doesNotMatch(harness, /git -C "\$\{CANDIDATE_DIR\}"/);
});

test("Escrow Devnode harness restores locally patched source without relying on a worktree .git file", () => {
  assert.match(harness, /backup_test_sources/);
  assert.match(harness, /BASELINE_SOURCE_BACKUP/);
  assert.match(harness, /CANDIDATE_SOURCE_BACKUP/);
  assert.match(harness, /cp -- "\$\{BASELINE_SOURCE_BACKUP\}"/);
  assert.match(harness, /cp -- "\$\{CANDIDATE_SOURCE_BACKUP\}"/);
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
  assert.match(harness, /readonly ALEO_E2E_ENDPOINT="\$\{ZKBB_DEVNODE_ENDPOINT:-http:\/\/127\.0\.0\.1:3030\}"/);
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
  assert.doesNotMatch(harness, /unset OWNER_ADDRESS/);
  assert.match(harness, /assert_full_e2e_inputs/);
  assert.match(harness, /local owner address is unavailable before source patching/);
  assert.match(harness, /if \[\[ "\$\{BASH_SOURCE\[0\]\}" == "\$0" \]\]/);
});

test("Escrow Devnode harness reports interrupted interactive input instead of continuing", () => {
  assert.match(harness, /input was interrupted/);
  assert.match(harness, /if ! read -r -s -p/);
  assert.match(harness, /if ! read -r -p/);
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
