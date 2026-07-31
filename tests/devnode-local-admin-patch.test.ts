import assert from "node:assert/strict";
import test from "node:test";

import {
  assertLocalDevnodeLeoSource,
  patchDevnodeLeoSource,
  PRODUCTION_ADMIN,
} from "../scripts/patch-devnode-admins.mjs";

const localAdmin = "aleo1localowner000000000000000000000000000000000000000000000000000";
const localArbiter = "aleo1localarbiter000000000000000000000000000000000000000000000000";
const options = { file: "fixture/main.leo", localAdmin, localArbiter };

test("Devnode local admin patch replaces one production constructor admin", () => {
  const patched = patchDevnodeLeoSource(
    `program zkbugbounty_7f3c92.aleo;\n@admin(address = "${PRODUCTION_ADMIN}")\nconstructor() {}`,
    options,
  );

  assert.doesNotMatch(patched, new RegExp(PRODUCTION_ADMIN));
  assert.match(patched, new RegExp(`@admin\\(address = "${localAdmin}"\\)`));
});

test("Devnode local admin patch replaces every production role address", () => {
  const patched = patchDevnodeLeoSource(
    `program zkbugbounty_7f3c92.aleo;\nassert_eq(signer, ${PRODUCTION_ADMIN});\n@admin(address = "${PRODUCTION_ADMIN}")\nconstructor() {}`,
    options,
  );

  assert.doesNotMatch(patched, new RegExp(PRODUCTION_ADMIN));
  assert.match(patched, new RegExp(`@admin\\(address = "${localAdmin}"\\)`));
  assert.match(patched, new RegExp(`assert_eq\\(signer, ${localArbiter}\\)`));
});

test("Devnode local admin patch fails when a production address remains after patching", () => {
  assert.throws(
    () => assertLocalDevnodeLeoSource(`assert_eq(signer, ${PRODUCTION_ADMIN});`, options),
    /local admin patch incomplete: fixture\/main\.leo/,
  );
});

test("Devnode local admin patch fails when the source has no production admin", () => {
  assert.throws(
    () => patchDevnodeLeoSource(`@admin(address = "${localAdmin}")`, options),
    /production admin not found: fixture\/main\.leo/,
  );
});
