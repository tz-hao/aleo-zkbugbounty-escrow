import type { Bounty } from "../models.ts";
import type { ProofEngineMode } from "./types.ts";
import { CANONICAL_ALEO_PROGRAM_ID } from "../aleo-program.ts";

export type ProofEngineCapability = {
  mode: ProofEngineMode;
  label: string;
  supported: boolean;
  message: string;
};

export function getProofEngineCapability(
  mode: "mock-invariant" | "aleo-program",
  ruleId: Bounty["ruleId"],
): ProofEngineCapability {
  if (mode === "mock-invariant") {
    return {
      mode,
      label: "Mock Invariant Engine",
      supported: true,
      message: "Deterministic local verification for all four DemoVault rules.",
    };
  }

  return {
    mode,
    label: "Aleo Leo Proof",
    supported: true,
    message: `Development-only local Leo execution for ${ruleId}. Real Mode uses Shield with ${CANONICAL_ALEO_PROGRAM_ID}.`,
  };
}
