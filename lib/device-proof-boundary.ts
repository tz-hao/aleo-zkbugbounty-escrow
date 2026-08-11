import { CANONICAL_ALEO_PROGRAM_ID } from "./aleo-program.ts";

export const DEVICE_PROOF_BOUNDARY = Object.freeze({
  mode: "leo-wallet-device" as const,
  network: "testnet" as const,
  programId: CANONICAL_ALEO_PROGRAM_ID,
  functionName: "submit_claim_v2" as const,
  serverProofEnabled: false,
  privateInputsAcceptedByApi: false,
  mockFallbackAllowed: false,
});

export function getDeviceProofCapability() {
  return {
    available: true,
    ...DEVICE_PROOF_BOUNDARY,
    status: "WalletRequired" as const,
  };
}
