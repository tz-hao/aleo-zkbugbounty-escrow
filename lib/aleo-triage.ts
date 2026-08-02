import { CANONICAL_ALEO_PROGRAM_ID } from "./aleo-program.ts";

export const ON_CHAIN_TRIAGE_FUNCTIONS = [
  "lock_reward_v2",
  "request_disclosure",
  "attest_encrypted_details",
  "mark_patched",
  "release_reward_v2",
  "reject_claim",
] as const;

export const ON_CHAIN_TRIAGE_MAPPINGS = ["claim_triage_states", "claim_payouts"] as const;

export const ON_CHAIN_TRIAGE_CAPABILITY = {
  status: "ProgramUpgradeRequired",
  source: "AleoTestnet",
  network: "testnet",
  programId: CANONICAL_ALEO_PROGRAM_ID,
  localUpgradeReady: true,
  walletActionsEnabled: false,
  roleAuthority: "std::ctx::signer()",
  uiRoleSwitcherAuthority: false,
  stateAuthority: "AleoMapping",
  transactionIdRequired: true,
  mappingVerificationRequired: true,
  demoFallbackAllowed: false,
} as const;

type AbiInspection = {
  available: boolean;
  missingFunctions: string[];
  missingMappings: string[];
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function inspectOnChainTriageAbi(abi: unknown): AbiInspection {
  const root = recordOf(abi);
  const functions = new Set(
    (Array.isArray(root?.functions) ? root.functions : [])
      .map((entry) => recordOf(entry)?.name)
      .filter((name): name is string => typeof name === "string"),
  );
  const mappings = new Set(
    (Array.isArray(root?.mappings) ? root.mappings : [])
      .map((entry) => recordOf(entry)?.name)
      .filter((name): name is string => typeof name === "string"),
  );
  const missingFunctions = ON_CHAIN_TRIAGE_FUNCTIONS.filter((name) => !functions.has(name));
  const missingMappings = ON_CHAIN_TRIAGE_MAPPINGS.filter((name) => !mappings.has(name));
  return {
    available: missingFunctions.length === 0 && missingMappings.length === 0,
    missingFunctions: [...missingFunctions],
    missingMappings: [...missingMappings],
  };
}
