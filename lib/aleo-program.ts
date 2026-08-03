export const CANONICAL_ALEO_PROGRAM_ID = "zkbugbounty_7f3c92.aleo";
export const ALEO_TESTNET_NETWORK = "testnet";
export const ALEO_TESTNET_API_ENDPOINT = "https://api.explorer.provable.com/v1";
export const ALEO_TESTNET_EXPLORER_ENDPOINT = "https://testnet.explorer.provable.com";
export const ALEO_TESTNET_DEPLOYMENT_TRANSACTION_ID =
  "at1m392ux58vwqlclcrqklh0693n8pfktsegpkw69rtpfhgj0jxsyzs3xdtxv";
export const ALEO_TESTNET_UPGRADE_TRANSACTION_ID =
  "at1jlz849t23sdyc58kdxevxl50x6kpjq8ypcf9253d825vvkeu9c8sshk78x";
export const ALEO_TESTNET_UPGRADE_FEE_TRANSACTION_ID =
  "at15c8j82u3mpxj0c6fq3kq9873rmzly0h8gegumypjtafz4wlg8s8q6k0c5r";
export const ALEO_TESTNET_EXPECTED_EDITION = 1;
export const ALEO_TESTNET_PROGRAM_OWNER =
  "aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6";

export const ALEO_TESTNET_DEPLOYMENT = {
  network: ALEO_TESTNET_NETWORK,
  programId: CANONICAL_ALEO_PROGRAM_ID,
  transactionId: ALEO_TESTNET_DEPLOYMENT_TRANSACTION_ID,
  programOwner: ALEO_TESTNET_PROGRAM_OWNER,
  apiEndpoint: ALEO_TESTNET_API_ENDPOINT,
  programApiUrl: `${ALEO_TESTNET_API_ENDPOINT}/${ALEO_TESTNET_NETWORK}/program/${CANONICAL_ALEO_PROGRAM_ID}`,
  latestEditionApiUrl: `${ALEO_TESTNET_API_ENDPOINT}/${ALEO_TESTNET_NETWORK}/program/${CANONICAL_ALEO_PROGRAM_ID}/latest_edition`,
  transactionApiUrl: `${ALEO_TESTNET_API_ENDPOINT}/${ALEO_TESTNET_NETWORK}/transaction/${ALEO_TESTNET_DEPLOYMENT_TRANSACTION_ID}`,
  programExplorerUrl: `${ALEO_TESTNET_EXPLORER_ENDPOINT}/program/${CANONICAL_ALEO_PROGRAM_ID}`,
  transactionExplorerUrl: `${ALEO_TESTNET_EXPLORER_ENDPOINT}/transaction/${ALEO_TESTNET_DEPLOYMENT_TRANSACTION_ID}`,
} as const;

export const ALEO_TESTNET_EDITION_ONE_UPGRADE = {
  network: ALEO_TESTNET_NETWORK,
  programId: CANONICAL_ALEO_PROGRAM_ID,
  transactionId: ALEO_TESTNET_UPGRADE_TRANSACTION_ID,
  feeTransactionId: ALEO_TESTNET_UPGRADE_FEE_TRANSACTION_ID,
  expectedEdition: ALEO_TESTNET_EXPECTED_EDITION,
  programOwner: ALEO_TESTNET_PROGRAM_OWNER,
  transactionApiUrl: `${ALEO_TESTNET_API_ENDPOINT}/${ALEO_TESTNET_NETWORK}/transaction/${ALEO_TESTNET_UPGRADE_TRANSACTION_ID}`,
  feeTransactionApiUrl: `${ALEO_TESTNET_API_ENDPOINT}/${ALEO_TESTNET_NETWORK}/transaction/${ALEO_TESTNET_UPGRADE_FEE_TRANSACTION_ID}`,
  transactionExplorerUrl: `${ALEO_TESTNET_EXPLORER_ENDPOINT}/transaction/${ALEO_TESTNET_UPGRADE_TRANSACTION_ID}`,
} as const;