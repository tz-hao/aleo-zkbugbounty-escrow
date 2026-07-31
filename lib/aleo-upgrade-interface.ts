export type AleoCallableInterface = {
  inputs: string[];
  outputs: string[];
};

export type AleoFinalizeInterface = {
  inputs: string[];
};

export type AleoProgramInterface = {
  imports: string[];
  program: string;
  constructor: string[] | null;
  structs: Record<string, string[]>;
  records: Record<string, string[]>;
  mappings: Record<string, string[]>;
  closures: Record<string, string[]>;
  functions: Record<string, AleoCallableInterface>;
  finalizes: Record<string, AleoFinalizeInterface>;
  views: Record<string, AleoCallableInterface>;
};

export type AleoUpgradeInterfaceMismatch = {
  component: string;
  name?: string;
  reason: "missing" | "mismatch";
  baseline?: unknown;
  candidate?: unknown;
};

const COMPONENT_PATTERN =
  /^(struct|record|mapping|closure|function|finalize|view)\s+([A-Za-z0-9_]+):$/;

function normalizedBlock(lines: string[]) {
  const normalized = lines.map((line) => line.trimEnd());
  while (normalized.length > 1 && normalized.at(-1)?.trim() === "") {
    normalized.pop();
  }
  return normalized.map((line) => line.trim());
}

export function parseAleoProgramInterface(source: string): AleoProgramInterface {
  const lines = source.replace(/\r/g, "").split("\n");
  const parsed: AleoProgramInterface = {
    imports: [],
    program: "",
    constructor: null,
    structs: {},
    records: {},
    mappings: {},
    closures: {},
    functions: {},
    finalizes: {},
    views: {},
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("import ")) parsed.imports.push(trimmed);
    if (trimmed.startsWith("program ")) parsed.program = trimmed;
  }

  const headings: Array<{
    index: number;
    kind: "struct" | "record" | "mapping" | "closure" | "function" | "finalize" | "view" | "constructor";
    name: string;
  }> = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const match = trimmed.match(COMPONENT_PATTERN);
    if (match) {
      headings.push({
        index,
        kind: match[1] as Exclude<(typeof headings)[number]["kind"], "constructor">,
        name: match[2],
      });
    } else if (trimmed === "constructor:") {
      headings.push({ index, kind: "constructor", name: "constructor" });
    }
  });

  headings.forEach((heading, index) => {
    const nextIndex = headings[index + 1]?.index ?? lines.length;
    const block = normalizedBlock(lines.slice(heading.index, nextIndex));

    if (
      heading.kind === "struct" ||
      heading.kind === "record" ||
      heading.kind === "mapping" ||
      heading.kind === "closure"
    ) {
      parsed[`${heading.kind}s`][heading.name] = block;
      return;
    }

    if (heading.kind === "constructor") {
      parsed.constructor = block;
      return;
    }

    const inputs = block.filter((line) => line.startsWith("input "));
    if (heading.kind === "finalize") {
      parsed.finalizes[heading.name] = { inputs };
      return;
    }

    parsed[`${heading.kind}s`][heading.name] = {
      inputs,
      outputs: block.filter((line) => line.startsWith("output ")),
    };
  });

  return parsed;
}

function sameInterface(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function compareAleoUpgradeInterfaces(
  baseline: AleoProgramInterface,
  candidate: AleoProgramInterface,
) {
  const mismatches: AleoUpgradeInterfaceMismatch[] = [];

  if (baseline.program !== candidate.program) {
    mismatches.push({
      component: "program",
      reason: "mismatch",
      baseline: baseline.program,
      candidate: candidate.program,
    });
  }

  for (const importedProgram of baseline.imports) {
    if (!candidate.imports.includes(importedProgram)) {
      mismatches.push({
        component: "import",
        name: importedProgram,
        reason: "missing",
      });
    }
  }

  if (!sameInterface(baseline.constructor, candidate.constructor)) {
    mismatches.push({
      component: "constructor",
      reason: "mismatch",
      baseline: baseline.constructor,
      candidate: candidate.constructor,
    });
  }

  for (const component of [
    "structs",
    "records",
    "mappings",
    "closures",
    "functions",
    "finalizes",
    "views",
  ] as const) {
    for (const [name, baselineInterface] of Object.entries(baseline[component])) {
      const candidateInterface = candidate[component][name];
      if (!candidateInterface) {
        mismatches.push({ component, name, reason: "missing" });
      } else if (!sameInterface(baselineInterface, candidateInterface)) {
        mismatches.push({
          component,
          name,
          reason: "mismatch",
          baseline: baselineInterface,
          candidate: candidateInterface,
        });
      }
    }
  }

  return {
    compatible: mismatches.length === 0,
    checked: {
      imports: baseline.imports.length,
      constructor: baseline.constructor === null ? 0 : 1,
      structs: Object.keys(baseline.structs).length,
      records: Object.keys(baseline.records).length,
      mappings: Object.keys(baseline.mappings).length,
      closures: Object.keys(baseline.closures).length,
      functions: Object.keys(baseline.functions).length,
      finalizes: Object.keys(baseline.finalizes).length,
      views: Object.keys(baseline.views).length,
    },
    mismatches,
  };
}
