import { readFileSync } from "node:fs";

type AbiPrimitive =
  | { Plaintext: { Primitive: "Field" | "Address" | "Boolean" } }
  | { Plaintext: { Primitive: { UInt: "U8" | "U32" | "U64" } } };

function primitiveType(type: string): AbiPrimitive | null {
  if (type === "field") return { Plaintext: { Primitive: "Field" } };
  if (type === "address") return { Plaintext: { Primitive: "Address" } };
  if (type === "bool") return { Plaintext: { Primitive: "Boolean" } };
  if (type === "u8" || type === "u32" || type === "u64") {
    return {
      Plaintext: {
        Primitive: { UInt: type.toUpperCase() as "U8" | "U32" | "U64" },
      },
    };
  }
  return null;
}

export function readCanonicalLeoSourceAbi() {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8")
    .replace(/\r\n/g, "\n");
  const programMatch = source.match(/\bprogram\s+([a-z0-9_]+\.aleo)\s*\{/);
  const program = programMatch?.[1];
  if (!program || programMatch.index === undefined) {
    throw new Error("Canonical Leo Program ID was not found");
  }
  // Pure helpers live before the Program and are not callable ABI entries.
  const programSource = source.slice(programMatch.index);

  const functions = [...programSource.matchAll(
    /\bfn\s+([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s*->\s*([^{]+)\{/g,
  )].flatMap((match) => {
    const rawInputs = match[2]
      .split(",")
      .map((input) => input.trim())
      .filter(Boolean);
    const inputs = rawInputs.map((input) =>
      input.match(/^(?:(public|private)\s+)?([a-z_][a-z0-9_]*):\s*([A-Za-z0-9_]+)$/)
    );
    if (inputs.some((input) => !input)) return [];

    const inputTypes = inputs.map((input) => primitiveType(input![3]));
    // This lightweight helper covers the primitive V1/V2 builder ABI only.
    // Struct-valued V3 inputs are validated against the generated Leo ABI.
    if (inputTypes.some((type) => type === null)) return [];

    const outputType = match[3].trim();
    return [{
      name: match[1],
      is_final: outputType === "Final",
      inputs: inputs.map((input, index) => ({
        name: input![2],
        mode: input![1] === "public" ? "Public" : "Private",
        ty: inputTypes[index]!,
      })),
      outputs: outputType === "Final"
        ? [{ ty: "Final", mode: "None" }]
        : [],
    }];
  });

  const mappings = [...programSource.matchAll(
    /\bmapping\s+([a-z_][a-z0-9_]*):\s*[A-Za-z0-9_]+\s*=>\s*[A-Za-z0-9_]+\s*;/g,
  )].map((match) => ({ name: match[1] }));

  return { program, functions, mappings };
}
