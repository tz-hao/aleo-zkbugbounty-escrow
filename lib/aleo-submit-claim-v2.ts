import { ALEO_WALLET_TESTNET_CHAIN_ID } from "./aleo-create-bounty.ts";
import { ESCROW_V2_CLAIM_FUNCTION } from "./aleo-reward-escrow.ts";
import { CANONICAL_ALEO_PROGRAM_ID } from "./aleo-program.ts";
import {
  buildTransientSubmitClaimInputs,
  type TransientSubmitClaimRequest,
} from "./aleo-submit-claim.ts";

export const SUBMIT_CLAIM_V2_FUNCTION = ESCROW_V2_CLAIM_FUNCTION;

export const SUBMIT_CLAIM_V2_ABI_INPUTS = [
  { name: "bounty_id", mode: "public", type: "field" },
  { name: "scope_hash", mode: "public", type: "field" },
  { name: "rule_id", mode: "public", type: "field" },
  { name: "vault_balance_before", mode: "private", type: "u64" },
  { name: "total_deposits_before", mode: "private", type: "u64" },
  { name: "total_claims_before", mode: "private", type: "u64" },
  { name: "reserved_rewards_before", mode: "private", type: "u64" },
  { name: "withdraw_limit_before", mode: "private", type: "u64" },
  { name: "user_balance_before", mode: "private", type: "u64" },
  { name: "requested_withdraw_before", mode: "private", type: "u64" },
  { name: "hidden_delta_balance", mode: "private", type: "u64" },
  { name: "hidden_delta_claims", mode: "private", type: "u64" },
  { name: "hidden_delta_reserved_rewards", mode: "private", type: "u64" },
  { name: "hidden_delta_withdraw_amount", mode: "private", type: "u64" },
  { name: "hidden_delta_user_balance", mode: "private", type: "u64" },
  { name: "reporter_secret", mode: "private", type: "field" },
] as const;

export type TransientSubmitClaimV2Request = TransientSubmitClaimRequest;

// This delegates only literal validation and preserves the exact Leo v2 input order.
// The result contains private inputs and must be cleared immediately after Wallet submission.
export function buildTransientSubmitClaimV2Inputs(request: TransientSubmitClaimV2Request) {
  const inputs = buildTransientSubmitClaimInputs(request);
  if (inputs.length !== SUBMIT_CLAIM_V2_ABI_INPUTS.length) {
    throw new Error("submit_claim_v2 ABI input count mismatch");
  }
  return inputs;
}

export const SUBMIT_CLAIM_V2_WALLET_BOUNDARY = {
  network: "testnet" as const,
  walletChainId: ALEO_WALLET_TESTNET_CHAIN_ID,
  programId: CANONICAL_ALEO_PROGRAM_ID,
  functionName: SUBMIT_CLAIM_V2_FUNCTION,
  protocolVersion: 2 as const,
};
