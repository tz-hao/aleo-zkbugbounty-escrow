#!/usr/bin/env node

import { pathToFileURL } from "node:url";

class LeoStructParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "LeoStructParseError";
  }
}

function fail(message) {
  throw new LeoStructParseError(message);
}

function asExpectedFields(expectedFields) {
  if (!Array.isArray(expectedFields) || expectedFields.length === 0) {
    fail("expected fields must be a non-empty array");
  }

  const uniqueFields = new Set(expectedFields);
  if (uniqueFields.size !== expectedFields.length || [...uniqueFields].some((field) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field))) {
    fail("expected fields contain an invalid or duplicate name");
  }
  return uniqueFields;
}

function unwrapResponse(rawResponse) {
  const trimmed = String(rawResponse ?? "").trim();
  if (!trimmed) fail("mapping response is empty");
  if (trimmed === "null") fail("mapping is absent");
  if (!trimmed.startsWith('"')) return trimmed;

  let decoded;
  try {
    decoded = JSON.parse(trimmed);
  } catch {
    fail("quoted mapping response is not valid JSON");
  }
  if (typeof decoded !== "string") fail("quoted mapping response must decode to a Leo struct string");
  return unwrapResponse(decoded);
}

function parseJsonStruct(source) {
  try {
    const value = JSON.parse(source);
    if (value === null || Array.isArray(value) || typeof value !== "object") return null;

    const fields = Object.create(null);
    for (const [field, valuePart] of Object.entries(value)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) fail(`invalid JSON struct field ${JSON.stringify(field)}`);
      if (typeof valuePart !== "string" && typeof valuePart !== "number" && typeof valuePart !== "boolean") {
        fail(`JSON struct field ${field} must be a public scalar`);
      }
      fields[field] = String(valuePart);
    }
    return fields;
  } catch (error) {
    if (error instanceof LeoStructParseError) throw error;
    return null;
  }
}

function parseLeoStruct(source) {
  let index = 0;
  const fields = Object.create(null);
  const skipWhitespace = () => {
    while (index < source.length && /\s/.test(source[index])) index += 1;
  };
  const readFieldName = () => {
    const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index));
    if (!match) fail(`expected field name at offset ${index}`);
    index += match[0].length;
    return match[0];
  };
  const readScalar = () => {
    const start = index;
    while (index < source.length && source[index] !== "," && source[index] !== "}") index += 1;
    const scalar = source.slice(start, index).trim();
    if (!scalar) fail(`expected scalar value at offset ${start}`);
    if (/[{}]/.test(scalar)) fail(`nested or malformed value at offset ${start}`);
    return scalar;
  };

  skipWhitespace();
  if (source[index] !== "{") fail("mapping response is not a Leo struct literal");
  index += 1;
  skipWhitespace();
  if (source[index] === "}") {
    index += 1;
  } else {
    for (;;) {
      const field = readFieldName();
      if (Object.hasOwn(fields, field)) fail(`duplicate field ${field}`);
      skipWhitespace();
      if (source[index] !== ":") fail(`expected colon after ${field}`);
      index += 1;
      skipWhitespace();
      fields[field] = readScalar();
      if (source[index] === "}") {
        index += 1;
        break;
      }
      if (source[index] !== ",") fail(`expected comma after ${field}`);
      index += 1;
      skipWhitespace();
      if (source[index] === "}") fail("trailing comma is not allowed");
    }
  }
  skipWhitespace();
  if (index !== source.length) fail(`unexpected trailing data at offset ${index}`);
  return fields;
}

function validateFields(fields, expectedFields) {
  const expected = asExpectedFields(expectedFields);
  const actual = Object.keys(fields);
  const unexpected = actual.filter((field) => !expected.has(field));
  const missing = [...expected].filter((field) => !Object.hasOwn(fields, field));
  if (unexpected.length > 0) fail(`unexpected field(s): ${unexpected.join(", ")}`);
  if (missing.length > 0) fail(`missing field(s): ${missing.join(", ")}`);
  return fields;
}

export function parseLeoStructResponse(rawResponse, expectedFields) {
  const source = unwrapResponse(rawResponse);
  const fields = parseJsonStruct(source) ?? parseLeoStruct(source);
  return validateFields(fields, expectedFields);
}

export function parseLeoStructHttpResponse(httpStatus, rawResponse, expectedFields) {
  if (Number(httpStatus) !== 200) fail(`mapping endpoint returned HTTP ${httpStatus}`);
  return parseLeoStructResponse(rawResponse, expectedFields);
}

export function readLeoStructField(rawResponse, expectedFields, fieldName) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fieldName)) fail(`invalid requested field ${JSON.stringify(fieldName)}`);
  const fields = parseLeoStructResponse(rawResponse, expectedFields);
  if (!Object.hasOwn(fields, fieldName)) fail(`requested field ${fieldName} is unavailable`);
  return fields[fieldName];
}

function parseCliArgs(argv) {
  const fieldsIndex = argv.indexOf("--fields");
  const fieldIndex = argv.indexOf("--field");
  if (fieldsIndex < 0 || fieldIndex < 0 || !argv[fieldsIndex + 1] || !argv[fieldIndex + 1]) {
    fail("usage: leo-struct-reader.mjs --fields field_one,field_two --field field_one");
  }
  if (argv.length !== 4) fail("unexpected CLI arguments");
  return { expectedFields: argv[fieldsIndex + 1].split(","), fieldName: argv[fieldIndex + 1] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { expectedFields, fieldName } = parseCliArgs(process.argv.slice(2));
    let rawResponse = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { rawResponse += chunk; });
    process.stdin.on("end", () => {
      try {
        process.stdout.write(`${readLeoStructField(rawResponse, expectedFields, fieldName)}\n`);
      } catch (error) {
        process.stderr.write(`leo-struct-reader: ${error.message}\n`);
        process.exitCode = 1;
      }
    });
  } catch (error) {
    process.stderr.write(`leo-struct-reader: ${error.message}\n`);
    process.exitCode = 1;
  }
}