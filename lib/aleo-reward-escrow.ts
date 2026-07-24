import { CANONICAL_ALEO_PROGRAM_ID } from "./aleo-program.ts";

export const REWARD_ESCROW_FUNCTIONS = [
  "fund_bounty",
  "lock_reward",
  "release_reward",
  "refund_bounty",
] as const;

export const REWARD_ESCROW_MAPPINGS = [
  "bounty_escrows",
  "claim_payouts",
  "bounty_claim_counts",
  "claim_reporters",
] as const;

export const REWARD_ESCROW_UPGRADE_PLAN = {
  newFunctions: [...REWARD_ESCROW_FUNCTIONS],
  newMappings: [...REWARD_ESCROW_MAPPINGS],
  preservedEntryFunctions: [
    "prove_vault_invariant_break",
    "submit_claim",
    "create_bounty",
    "pause_bounty",
    "close_bounty",
  ],
  securityChecks: [
    "fund_bounty transfers real public credits from self.signer to the program account",
    "fund_bounty requires self.signer to equal the bounty owner",
    "lock_reward requires a verified claim receipt, matching bounty, reporter address, and available escrow",
    "release_reward requires a locked payout and transfers public credits to the recorded whitehat address",
    "refund_bounty requires a closed bounty, expired deadline, zero claim count, and zero locked amount",
    "Paid state is represented only by confirmed mapping state, never by UI-only local state",
  ],
} as const;

export const REWARD_ESCROW_CAPABILITY = {
  status: "ProgramUpgradeRequired",
  source: "AleoTestnet",
  network: "testnet",
  programId: CANONICAL_ALEO_PROGRAM_ID,
  transactionBuilderEnabled: false,
  walletRequestEnabled: false,
  demoFallbackAllowed: false,
  paidRequiresConfirmedTransaction: true,
  paidRequiresMappingVerification: true,
} as const;

export type RewardEscrowAbiInspection = {
  available: boolean;
  presentFunctions: string[];
  missingFunctions: string[];
  presentMappings: string[];
  missingMappings: string[];
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function inspectRewardEscrowAbi(abi: unknown): RewardEscrowAbiInspection {
  const root = recordOf(abi);
  const functionNames = new Set(
    (Array.isArray(root?.functions) ? root.functions : [])
      .map((entry) => recordOf(entry)?.name)
      .filter((name): name is string => typeof name === "string"),
  );
  const mappingNames = new Set(
    (Array.isArray(root?.mappings) ? root.mappings : [])
      .map((entry) => recordOf(entry)?.name)
      .filter((name): name is string => typeof name === "string"),
  );
  const presentFunctions = REWARD_ESCROW_FUNCTIONS.filter((name) => functionNames.has(name));
  const presentMappings = REWARD_ESCROW_MAPPINGS.filter((name) => mappingNames.has(name));
  const missingFunctions = REWARD_ESCROW_FUNCTIONS.filter((name) => !functionNames.has(name));
  const missingMappings = REWARD_ESCROW_MAPPINGS.filter((name) => !mappingNames.has(name));

  return {
    available: missingFunctions.length === 0 && missingMappings.length === 0,
    presentFunctions: [...presentFunctions],
    missingFunctions: [...missingFunctions],
    presentMappings: [...presentMappings],
    missingMappings: [...missingMappings],
  };
}
