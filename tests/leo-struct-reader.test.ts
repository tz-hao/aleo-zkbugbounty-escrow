import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLeoStructHttpResponse,
  parseLeoStructResponse,
  readLeoStructField,
} from "../scripts/leo-struct-reader.mjs";

const panelFields = ["arbiter_one", "arbiter_two", "arbiter_three", "quorum"];
const panelLiteral = "{ arbiter_one: aleo1one, arbiter_two: aleo1two, arbiter_three: aleo1three, quorum: 2u8 }";

test("Leo struct reader decodes direct and JSON-quoted public panel literals", () => {
  assert.equal(readLeoStructField(panelLiteral, panelFields, "arbiter_one"), "aleo1one");
  assert.equal(readLeoStructField(JSON.stringify(panelLiteral), panelFields, "quorum"), "2u8");
});

test("Leo struct reader accepts CRLF and LF whitespace without changing public values", () => {
  const value = "{\r\n  arbiter_one: aleo1one,\n  arbiter_two: aleo1two,\r\n  arbiter_three: aleo1three,\n  quorum: 2u8\r\n}";
  assert.deepEqual({ ...parseLeoStructResponse(value, panelFields) }, {
    arbiter_one: "aleo1one",
    arbiter_two: "aleo1two",
    arbiter_three: "aleo1three",
    quorum: "2u8",
  });
});

test("Leo struct reader fails closed for missing mappings, HTTP errors, and unexpected fields", () => {
  assert.throws(() => parseLeoStructResponse("null", panelFields), /mapping is absent/);
  assert.throws(() => parseLeoStructHttpResponse(404, panelLiteral, panelFields), /HTTP 404/);
  assert.throws(
    () => parseLeoStructResponse("{ arbiter_one: aleo1one, arbiter_two: aleo1two, arbiter_three: aleo1three, quorum: 2u8, extra: 1u8 }", panelFields),
    /unexpected field/,
  );
});

test("Leo struct reader rejects missing, duplicate, malformed, and non-struct responses", () => {
  assert.throws(() => parseLeoStructResponse("{ arbiter_one: aleo1one, arbiter_two: aleo1two, quorum: 2u8 }", panelFields), /missing field/);
  assert.throws(() => parseLeoStructResponse("{ arbiter_one: aleo1one, arbiter_one: aleo1two, arbiter_three: aleo1three, quorum: 2u8 }", panelFields), /duplicate field/);
  assert.throws(() => parseLeoStructResponse("{ arbiter_one aleo1one }", panelFields), /expected colon/);
  assert.throws(() => parseLeoStructResponse("not-a-struct", panelFields), /not a Leo struct/);
});