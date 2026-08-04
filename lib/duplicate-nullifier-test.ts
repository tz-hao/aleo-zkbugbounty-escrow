import {
  createControlledSubmitClaimPreview,
  SUBMIT_CLAIM_ABI_INPUTS,
  SUBMIT_CLAIM_FUNCTION,
  SUBMIT_CLAIM_WALLET_BOUNDARY,
  type ControlledSubmitClaimInputPreview,
} from "./aleo-submit-claim.ts";
import { CANONICAL_ALEO_PROGRAM_ID } from "./aleo-program.ts";

export const DUPLICATE_NULLIFIER_TEST_ROUTE = "/security-tests/duplicate-nullifier";
export const DUPLICATE_NULLIFIER_TEST_TIMEOUT_MS = 10 * 60 * 1000;

export const DUPLICATE_NULLIFIER_TEST_BOUNDARY = {
  route: DUPLICATE_NULLIFIER_TEST_ROUTE,
  network: SUBMIT_CLAIM_WALLET_BOUNDARY.network,
  programId: CANONICAL_ALEO_PROGRAM_ID,
  functionName: SUBMIT_CLAIM_FUNCTION,
  usesNextApiRoutes: false,
  usesBrowserPersistence: false,
  mockFallbackAllowed: false,
  serverSigningAllowed: false,
} as const;

export type DuplicateNullifierLifecycle =
  | "EMPTY"
  | "GENERATED"
  | "FIRST_SIGNING"
  | "FIRST_SUBMITTED"
  | "FIRST_CONFIRMED"
  | "DUPLICATE_READY"
  | "DUPLICATE_SIGNING"
  | "DUPLICATE_SUBMITTED"
  | "DUPLICATE_REJECTED"
  | "CLEARED"
  | "FAILED";

export const DUPLICATE_TEST_PRIVATE_INPUT_STATES = [
  "GENERATED",
  "FIRST_SIGNING",
  "FIRST_SUBMITTED",
  "FIRST_CONFIRMED",
  "DUPLICATE_READY",
  "DUPLICATE_SIGNING",
] as const satisfies readonly DuplicateNullifierLifecycle[];

export type ControlledDuplicateNullifierVector = {
  inputs: string[];
  feeMicrocredits: number;
  claimHash: string;
  nullifier: string;
  witnessCommitment: string;
  reporterCommitment: string;
  severity: string;
};

export type DuplicateNullifierPublicPreview = ControlledSubmitClaimInputPreview & {
  programId: typeof CANONICAL_ALEO_PROGRAM_ID;
  functionName: typeof SUBMIT_CLAIM_FUNCTION;
  network: "testnet";
  expectedFirstStatus: "accepted";
  expectedDuplicateStatus: "rejected";
  expectedRejectionGuard: "duplicate nullifier";
};

export function buildDuplicateNullifierPublicPreview(
  vector: ControlledDuplicateNullifierVector,
): DuplicateNullifierPublicPreview {
  const preview = createControlledSubmitClaimPreview(
    vector.inputs,
    {
      claimHash: vector.claimHash,
      nullifier: vector.nullifier,
      witnessCommitment: vector.witnessCommitment,
      reporterCommitment: vector.reporterCommitment,
      severity: vector.severity,
    },
    vector.feeMicrocredits,
  );
  return {
    ...preview,
    programId: CANONICAL_ALEO_PROGRAM_ID,
    functionName: SUBMIT_CLAIM_FUNCTION,
    network: "testnet",
    expectedFirstStatus: "accepted",
    expectedDuplicateStatus: "rejected",
    expectedRejectionGuard: "duplicate nullifier",
  };
}

export function expectedClaimCountAfterFirst(baselineCount: number) {
  if (!Number.isSafeInteger(baselineCount) || baselineCount < 0) {
    throw new Error("baseline public claim count is invalid");
  }
  return baselineCount + 1;
}

export function expectedClaimCountAfterRejectedDuplicate(baselineCount: number) {
  return expectedClaimCountAfterFirst(baselineCount);
}

export function zeroControlledDuplicateInputs(vector: ControlledDuplicateNullifierVector | null) {
  vector?.inputs.fill("");
}

export function describeDuplicateNullifierAbi() {
  return SUBMIT_CLAIM_ABI_INPUTS.map((input, index) => ({
    index: index + 1,
    name: input.name,
    mode: input.mode,
    type: input.type,
  }));
}
