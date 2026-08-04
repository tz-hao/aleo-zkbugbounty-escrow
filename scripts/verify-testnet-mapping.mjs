import {
  isEditionOneMappingName,
  verifyPublicEditionOneMapping,
} from "../lib/testnet-edition-one.ts";

export function parseMappingArguments(argv) {
  const values = { mapping: "", key: "", endpoint: undefined, programId: undefined, indexDelay: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--mapping" && value) values.mapping = value;
    if (flag === "--key" && value) values.key = value;
    if (flag === "--endpoint" && value) values.endpoint = value;
    if (flag === "--program-id" && value) values.programId = value;
    if (flag === "--index-delay") values.indexDelay = true;
  }
  return values;
}

export async function runMappingVerification(values) {
  if (!isEditionOneMappingName(values.mapping)) {
    throw new Error("Mapping must be one of the supported Edition 1 public mappings.");
  }
  return verifyPublicEditionOneMapping(values.mapping, values.key, {
    config: { endpoint: values.endpoint, programId: values.programId },
    indexDelay: values.indexDelay,
  });
}

async function main() {
  try {
    const result = await runMappingVerification(parseMappingArguments(process.argv.slice(2)));
    console.log(`Mapping: ${result.mapping}`);
    console.log(`Key: ${result.key}`);
    console.log(`Status: ${result.status}`);
    console.log(`HTTP status: ${result.httpStatus ?? "UNAVAILABLE"}`);
    console.log(`Value: ${result.valuePreview ?? "NOT_EXPOSED"}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Mapping verification could not be completed.");
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}