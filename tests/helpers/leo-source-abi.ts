import { readFileSync } from "node:fs";

type AbiPrimitive =
  | { Plaintext: { Primitive: "Field" | "Address" | "Boolean" } }
  | { Plaintext: { Primitive: { UInt: "U8" | "U32" | "U64" } } };

function primitiveType(type: string): AbiPrimitive {
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
  throw new Error(`Unsupported Leo ABI primitive: ${type}`);
}

export function readCanonicalLeoSourceAbi() {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8")
    .replace(/\r\n/g, "\n");
  const program = source.match(/\bprogram\s+([a-z0-9_]+\.aleo)\s*\{/)?.[1];
  if (!program) throw new Error("Canonical Leo Program ID was not found");

  const functions = [...source.matchAll(
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

    const outputType = match[3].trim();
    return [{
      name: match[1],
      is_final: outputType === "Final",
      inputs: inputs.map((input) => ({
        name: input![2],
        mode: input![1] === "public" ? "Public" : "Private",
        ty: primitiveType(input![3]),
      })),
      outputs: outputType === "Final"
        ? [{ ty: "Final", mode: "None" }]
        : [],
    }];
  });

  const mappings = [...source.matchAll(
    /\bmapping\s+([a-z_][a-z0-9_]*):\s*[A-Za-z0-9_]+\s*=>\s*[A-Za-z0-9_]+\s*;/g,
  )].map((match) => ({ name: match[1] }));

  return { program, functions, mappings };
}
