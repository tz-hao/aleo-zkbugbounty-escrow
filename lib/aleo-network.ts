import { ALEO_TESTNET_API_ENDPOINT } from "./aleo-program.ts";
import { ALEO_WALLET_TESTNET_CHAIN_ID } from "./aleo-create-bounty.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";

export type AleoNetworkFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type AleoTestnetStatus = {
  status: "Available";
  network: "testnet";
  walletChainId: typeof ALEO_WALLET_TESTNET_CHAIN_ID;
  latestHeight: number;
  endpoint: typeof ALEO_TESTNET_API_ENDPOINT;
};

export function parseAleoBlockHeight(raw: string) {
  const normalized = raw.trim().replace(/^"|"$/g, "");
  if (!/^[0-9]+$/.test(normalized)) {
    throw new Error("Aleo Testnet returned an invalid block height");
  }
  const height = Number(normalized);
  if (!Number.isSafeInteger(height) || height < 0) {
    throw new Error("Aleo Testnet block height is out of range");
  }
  return height;
}

export async function fetchAleoTestnetStatus(
  fetcher: AleoNetworkFetch = fetch,
): Promise<AleoTestnetStatus> {
  const response = await fetcher(
    `${ALEO_TESTNET_API_ENDPOINT}/testnet/block/height/latest`,
    {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Aleo Testnet height lookup failed with HTTP ${response.status}`);
  }
  const status: AleoTestnetStatus = {
    status: "Available",
    network: "testnet",
    walletChainId: ALEO_WALLET_TESTNET_CHAIN_ID,
    latestHeight: parseAleoBlockHeight(await response.text()),
    endpoint: ALEO_TESTNET_API_ENDPOINT,
  };
  assertNoPrivateFields(status);
  return status;
}
