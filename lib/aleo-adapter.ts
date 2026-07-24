import type { Bounty, ProofResult } from "./models.ts";
import { createAleoProgramEngine } from "./proof-engines/index.ts";
import type { PrivateProofInput } from "./proof-engines/types.ts";

export type AleoProofRequest = {
  bounty: Bounty;
  input: PrivateProofInput;
  existingNullifiers?: Set<string>;
};

export async function requestAleoProof(request: AleoProofRequest): Promise<ProofResult> {
  return createAleoProgramEngine(request.existingNullifiers).generateProof(
    request.input,
    request.bounty,
  );
}

export async function verifyAleoProof(result: ProofResult): Promise<boolean> {
  return createAleoProgramEngine().verifyProof(result);
}
