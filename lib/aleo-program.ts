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
// Edition 2 remains public historical evidence. Edition 3 is required before
// V3 wallet actions are enabled again because it carries the SLA hardening.
export const ALEO_TESTNET_V3_EXPECTED_EDITION = 3;
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
export const ALEO_TESTNET_V3_EDITION_TWO_EVIDENCE = {
  transactionId: "at1e8yuz289ygf249s96dd6eqszcvywvkrmw3lxzdt4gl96e6a3lu8s4dt499",
  feeTransactionId: "at18q2xfeqchrynkhtysxrjypmc7te53qesm4asjq7rc7mzccy0wsqq8p09vn",
  expectedEdition: 2,
  compiledProgramSha256: "ed5f91070fb37bc5d2a3d61832b2ddc29165a2be73f37dd6dacbc6a552d4b795",
} as const;

// Populated only after the administrator broadcasts and confirms the Edition 3
// hardening upgrade. All three public values are required: the upgrade and fee
// transaction IDs establish provenance, and the compiled Program SHA-256 pins
// the exact on-chain source/ABI instead of only checking its entry names.
export const ALEO_TESTNET_V3_UPGRADE_EVIDENCE: {
  transactionId: string | null;
  feeTransactionId: string | null;
  compiledProgramSha256: string | null;
  expectedEdition: typeof ALEO_TESTNET_V3_EXPECTED_EDITION;
} = {
  transactionId: null,
  feeTransactionId: null,
  compiledProgramSha256: null,
  expectedEdition: ALEO_TESTNET_V3_EXPECTED_EDITION,
};
