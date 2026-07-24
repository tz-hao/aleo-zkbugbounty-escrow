import { assertNoPrivateFields } from "./privacy-guards.ts";
import type { DemoState } from "./models.ts";

export const DEMO_STATE_STORAGE_KEY = "zkbugbounty.public-demo-state.v1";

export type PersistedDemoState = Pick<
  DemoState,
  | "bounties"
  | "claims"
  | "claimReceipts"
  | "publicClaimRegistry"
  | "nullifierRecords"
  | "disclosurePackages"
  | "triageActions"
> & {
  version: 1;
};

export function createPersistedDemoState(state: DemoState): PersistedDemoState {
  const persisted: PersistedDemoState = {
    version: 1,
    bounties: state.bounties,
    claims: state.claims,
    claimReceipts: state.claimReceipts,
    publicClaimRegistry: state.publicClaimRegistry,
    nullifierRecords: state.nullifierRecords,
    disclosurePackages: state.disclosurePackages,
    triageActions: state.triageActions,
  };

  assertNoPrivateFields(persisted);
  return persisted;
}

export function hydratePersistedDemoState(
  initialState: DemoState,
  persisted: PersistedDemoState,
): DemoState {
  if (persisted.version !== 1) {
    return initialState;
  }
  assertNoPrivateFields(persisted);
  const receipts = persisted.claimReceipts.map((receipt) => {
    if (receipt.verification) return receipt;
    const isBundledDemo = receipt.bountyId === "bounty-001" && receipt.projectId === "owner-demo";
    return {
      ...receipt,
      proofEngine: isBundledDemo ? "Mock Invariant Engine" : receipt.proofEngine,
      protocolVersion: isBundledDemo
        ? { ...receipt.protocolVersion, proofSystem: "mock-invariant" }
        : receipt.protocolVersion,
      verification: isBundledDemo
        ? { level: "Simulation" as const, network: "local" as const, programId: "mock-vault-engine" }
        : { level: "Unavailable" as const, network: "unavailable" as const, programId: "unknown" },
    };
  });
  const verificationByReceipt = new Map(
    receipts.map((receipt) => [receipt.receiptId, receipt.verification]),
  );
  return {
    ...initialState,
    bounties: persisted.bounties,
    claims: persisted.claims.map((claim) => ({
      ...claim,
      verification: claim.verification ?? verificationByReceipt.get(claim.receiptId),
    })),
    claimReceipts: receipts,
    publicClaimRegistry: persisted.publicClaimRegistry.map((entry) => {
      const verification = entry.verification ?? verificationByReceipt.get(entry.receiptId);
      return {
        ...entry,
        proofEngine:
          verification?.level === "Simulation" ? "Mock Invariant Engine" : entry.proofEngine,
        verification,
      };
    }),
    nullifierRecords: persisted.nullifierRecords,
    disclosurePackages: persisted.disclosurePackages,
    triageActions: persisted.triageActions,
  };
}

export function parsePersistedDemoState(value: string): PersistedDemoState | null {
  try {
    const parsed = JSON.parse(value) as PersistedDemoState;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.bounties) || !Array.isArray(parsed.claims)) {
      return null;
    }
    assertNoPrivateFields(parsed);
    return parsed;
  } catch {
    return null;
  }
}
