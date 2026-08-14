import { ALEO_TRANSACTION_ID_PATTERN } from "./aleo-create-bounty-acceptance.ts";

export type WalletVerificationStatus = "Verified" | "Experimental" | "NotVerified";

export type WalletCompatibility = {
  id: string;
  name: string;
  verification: WalletVerificationStatus;
  network: "Aleo Testnet";
  walletChainId: "testnet";
  environments: readonly string[];
  verifiedCapabilities: readonly string[];
};

export const WALLET_COMPATIBILITY: readonly WalletCompatibility[] = [
  {
    id: "shield-wallet",
    name: "Shield Wallet",
    verification: "Verified",
    network: "Aleo Testnet",
    walletChainId: "testnet",
    environments: ["Desktop browser extension"],
    verifiedCapabilities: [
      "Connect",
      "Disconnect",
      "Public fee transaction execution",
      "create_bounty",
      "V2/V3 public protocol transactions",
      "Wallet Request ID classification",
    ],
  },
  {
    id: "other-aleo-wallets",
    name: "Other Aleo wallets",
    verification: "NotVerified",
    network: "Aleo Testnet",
    walletChainId: "testnet",
    environments: [],
    verifiedCapabilities: [],
  },
] as const;

export type WalletRequestIdentifier = {
  walletRequestId: string;
  publicTransactionId: string | null;
};

export function classifyWalletResponseId(value: unknown): WalletRequestIdentifier | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return {
    walletRequestId: value,
    publicTransactionId: ALEO_TRANSACTION_ID_PATTERN.test(value) ? value : null,
  };
}

export type NormalizedWalletTransactionStatus = "Finalized" | "Failed" | "Processing";

export function normalizeWalletTransactionStatus(
  walletStatus: unknown,
): NormalizedWalletTransactionStatus {
  const rawStatus =
    typeof walletStatus === "string"
      ? walletStatus
      : typeof walletStatus === "object" && walletStatus !== null &&
          typeof (walletStatus as { status?: unknown }).status === "string"
        ? (walletStatus as { status: string }).status
        : null;
  if (!rawStatus) return "Processing";
  const normalized = rawStatus.toLowerCase();
  if (normalized === "finalized" || normalized === "confirmed" || normalized === "accepted") {
    return "Finalized";
  }
  if (
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("abort")
  ) {
    return "Failed";
  }
  return "Processing";
}
