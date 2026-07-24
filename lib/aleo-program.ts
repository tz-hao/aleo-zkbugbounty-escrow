export const CANONICAL_ALEO_PROGRAM_ID = "zkbugbounty_7f3c92.aleo";
export const ALEO_TESTNET_NETWORK = "testnet";
export const ALEO_TESTNET_API_ENDPOINT = "https://api.explorer.provable.com/v1";
export const ALEO_TESTNET_EXPLORER_ENDPOINT = "https://testnet.explorer.provable.com";
export const ALEO_TESTNET_DEPLOYMENT_TRANSACTION_ID =
  "at1m392ux58vwqlclcrqklh0693n8pfktsegpkw69rtpfhgj0jxsyzs3xdtxv";
export const ALEO_TESTNET_PROGRAM_OWNER =
  "aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6";

export const ALEO_TESTNET_DEPLOYMENT = {
  network: ALEO_TESTNET_NETWORK,
  programId: CANONICAL_ALEO_PROGRAM_ID,
  transactionId: ALEO_TESTNET_DEPLOYMENT_TRANSACTION_ID,
  programOwner: ALEO_TESTNET_PROGRAM_OWNER,
  apiEndpoint: ALEO_TESTNET_API_ENDPOINT,
  programApiUrl: `${ALEO_TESTNET_API_ENDPOINT}/${ALEO_TESTNET_NETWORK}/program/${CANONICAL_ALEO_PROGRAM_ID}`,
  transactionApiUrl: `${ALEO_TESTNET_API_ENDPOINT}/${ALEO_TESTNET_NETWORK}/transaction/${ALEO_TESTNET_DEPLOYMENT_TRANSACTION_ID}`,
  programExplorerUrl: `${ALEO_TESTNET_EXPLORER_ENDPOINT}/program/${CANONICAL_ALEO_PROGRAM_ID}`,
  transactionExplorerUrl: `${ALEO_TESTNET_EXPLORER_ENDPOINT}/transaction/${ALEO_TESTNET_DEPLOYMENT_TRANSACTION_ID}`,
} as const;
