import type { ConfirmedCreateBountyTransaction } from "./aleo-create-bounty-acceptance.ts";
import type { OnChainBountyState } from "./models.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";

export type AcceptanceCheck = {
  id: string;
  label: string;
  status: "Verified" | "Mismatch" | "NotChecked";
  expected: string;
  actual: string;
};

export type CreateBountyAcceptance = {
  mappingVerified: boolean;
  ownerVerified: boolean;
  ownerCheck: "Verified" | "Mismatch" | "NotConnected";
  checks: AcceptanceCheck[];
};

function check(id: string, label: string, expected: string, actual: string): AcceptanceCheck {
  return {
    id,
    label,
    status: expected === actual ? "Verified" : "Mismatch",
    expected,
    actual,
  };
}

export function verifyCreateBountyMapping(
  transaction: ConfirmedCreateBountyTransaction,
  bounty: OnChainBountyState,
  connectedAddress: string | null,
): CreateBountyAcceptance {
  const publicInputs = transaction.publicInputs;
  const checks: AcceptanceCheck[] = [
    check("bountyId", "Bounty ID", publicInputs.bountyId, bounty.bountyId),
    check("programId", "Program ID", transaction.programId, bounty.programId),
    check("network", "Network", transaction.network, bounty.network),
    check("scopeHash", "Scope Hash", publicInputs.scopeHash, bounty.scopeHash),
    check("ruleId", "Rule ID", publicInputs.ruleId, bounty.ruleId),
    check("criticalReward", "Critical Reward", publicInputs.criticalReward, bounty.rewards.critical),
    check("highReward", "High Reward", publicInputs.highReward, bounty.rewards.high),
    check("mediumReward", "Medium Reward", publicInputs.mediumReward, bounty.rewards.medium),
    check("lowReward", "Low Reward", publicInputs.lowReward, bounty.rewards.low),
    check(
      "disclosureDeadline",
      "Disclosure Deadline",
      String(publicInputs.disclosureDeadline),
      String(bounty.disclosureDeadline),
    ),
    check("status", "Bounty Status", "Active", bounty.status),
  ];
  const ownerCheck: AcceptanceCheck = connectedAddress
    ? check("owner", "Owner / Connected Wallet", connectedAddress, bounty.owner)
    : {
        id: "owner",
        label: "Owner / Connected Wallet",
        status: "NotChecked",
        expected: "Connect wallet to compare",
        actual: bounty.owner,
      };
  checks.push(ownerCheck);

  const result: CreateBountyAcceptance = {
    mappingVerified: checks
      .filter((item) => item.id !== "owner")
      .every((item) => item.status === "Verified"),
    ownerVerified: ownerCheck.status === "Verified",
    ownerCheck:
      ownerCheck.status === "Verified"
        ? "Verified"
        : ownerCheck.status === "Mismatch"
          ? "Mismatch"
          : "NotConnected",
    checks,
  };
  assertNoPrivateFields(result);
  return result;
}
