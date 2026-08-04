import { ALEO_TRANSACTION_ID_PATTERN } from "./aleo-create-bounty-acceptance.ts";

export type WalletVerificationStatus = "Verified" | "Experimental" | "NotVerified";

export type WalletCompatibility = {
  id: string;
  name: string;
  verification: WalletVerificationStatus;
  network: "Aleo Testnet";
  walletChainId: "testnetbeta";
  environments: readonly string[];
  verifiedCapabilities: readonly string[];
};

export const WALLET_COMPATIBILITY: readonly WalletCompatibility[] = [
  {
    id: "leo-wallet",
    name: "Leo Wallet",
    verification: "Verified",
    network: "Aleo Testnet",
    walletChainId: "testnetbeta",
    environments: ["Desktop browser extension"],
    verifiedCapabilities: [
      "Connect",
      "Disconnect",
      "Public fee transaction request",
      "create_bounty",
      "Wallet Request ID classification",
    ],
  },
  {
    id: "other-aleo-wallets",
    name: "Other Aleo wallets",
    verification: "NotVerified",
    network: "Aleo Testnet",
    walletChainId: "testnetbeta",
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
  if (typeof walletStatus !== "string") return "Processing";
  const normalized = walletStatus.toLowerCase();
  if (normalized === "finalized") return "Finalized";
  if (
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("abort")
  ) {
    return "Failed";
  }
  return "Processing";
}
