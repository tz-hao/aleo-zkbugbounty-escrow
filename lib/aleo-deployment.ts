import {
  ALEO_TESTNET_DEPLOYMENT,
  ALEO_TESTNET_PROGRAM_OWNER,
  CANONICAL_ALEO_PROGRAM_ID,
} from "./aleo-program.ts";
import { assertNoPrivateFields } from "./privacy-guards.ts";

export type DeploymentVerificationStatus =
  | "verified"
  | "program_found_transaction_unavailable"
  | "transaction_found_program_unavailable"
  | "endpoint_unavailable"
  | "not_deployed"
  | "configuration_error";

export type DeploymentEndpointError = {
  status: number | "timeout" | "network_error" | "invalid_payload" | "mismatch";
  message: string;
};

export type AleoDeploymentStatus = {
  status: "Confirmed" | "Partial" | "Unavailable" | "NotDeployed" | "ConfigurationError";
  verification: "NetworkConfirmed" | "Partial" | "Unavailable" | "NotDeployed" | "ConfigurationError";
  verificationStatus: DeploymentVerificationStatus;
  network: "testnet";
  programId: string;
  transactionId: string;
  programOwner: string;
  edition: number | null;
  currentEdition: number | null;
  verifyingKeyCount: number | null;
  programFound: boolean;
  transactionFound: boolean;
  programExplorerUrl: string;
  transactionExplorerUrl: string;
  endpoints: {
    program: string;
    transaction: string;
  };
  errors?: {
    program?: DeploymentEndpointError;
    transaction?: DeploymentEndpointError;
  };
};

export type DeploymentFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type EndpointResult<T> =
  | { kind: "found"; value: T }
  | { kind: "not_found"; error: DeploymentEndpointError }
  | { kind: "unavailable"; error: DeploymentEndpointError }
  | { kind: "configuration_error"; error: DeploymentEndpointError };

type TransactionVerification = {
  edition: number;
  verifyingKeyCount: number;
};

const DEPLOYMENT_LOOKUP_TIMEOUT_MS = 8_000;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Aleo deployment ${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function normalizeHttpError(status: number): EndpointResult<never> {
  if (status === 404) {
    return {
      kind: "not_found",
      error: { status, message: "Public endpoint returned 404 for this deployment artifact." },
    };
  }
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return {
      kind: "unavailable",
      error: { status, message: `Public endpoint is temporarily unavailable (${status}).` },
    };
  }
  return {
    kind: "configuration_error",
    error: { status, message: `Unexpected public endpoint status (${status}).` },
  };
}

async function fetchEndpoint(
  fetcher: DeploymentFetch,
  url: string,
  timeoutMs = DEPLOYMENT_LOOKUP_TIMEOUT_MS,
): Promise<EndpointResult<Response>> {
  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return normalizeHttpError(response.status);
    return { kind: "found", value: response };
  } catch (error) {
    const aborted =
      error instanceof DOMException ||
      (error && typeof error === "object" && "name" in error && error.name === "AbortError");
    return {
      kind: "unavailable",
      error: {
        status: aborted ? "timeout" : "network_error",
        message: aborted ? "Public endpoint request timed out." : "Public endpoint request failed.",
      },
    };
  }
}

async function readProgramSource(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "string") return parsed;
  } catch {
    // Some tests and fallback endpoints return plain Aleo source instead of a JSON string.
  }
  return text;
}

function assertCanonicalProgramSource(source: string) {
  if (!source.includes(`program ${CANONICAL_ALEO_PROGRAM_ID}`)) {
    throw new Error("Aleo deployment Program ID mismatch");
  }
  if (!source.includes(`assert.eq program_owner ${ALEO_TESTNET_PROGRAM_OWNER};`)) {
    throw new Error("Aleo deployment admin constructor mismatch");
  }
}

function verificationKeyCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  throw new Error("Aleo deployment verifying keys are invalid");
}

async function verifyProgramEndpoint(
  fetcher: DeploymentFetch,
): Promise<EndpointResult<{ source: string }>> {
  const response = await fetchEndpoint(fetcher, ALEO_TESTNET_DEPLOYMENT.programApiUrl);
  if (response.kind !== "found") return response;
  try {
    const source = await readProgramSource(response.value);
    assertCanonicalProgramSource(source);
    return { kind: "found", value: { source } };
  } catch (error) {
    return {
      kind: "configuration_error",
      error: {
        status: "mismatch",
        message: error instanceof Error ? error.message : "Program source verification failed.",
      },
    };
  }
}

async function verifyTransactionEndpoint(
  fetcher: DeploymentFetch,
): Promise<EndpointResult<TransactionVerification>> {
  const response = await fetchEndpoint(fetcher, ALEO_TESTNET_DEPLOYMENT.transactionApiUrl);
  if (response.kind !== "found") return response;
  try {
    const transaction = asRecord(await response.value.json(), "transaction");
    const owner = asRecord(transaction.owner, "transaction owner");
    const deployment = asRecord(transaction.deployment, "transaction payload");
    const transactionProgram = deployment.program;

    if (transaction.type !== "deploy" || transaction.id !== ALEO_TESTNET_DEPLOYMENT.transactionId) {
      throw new Error("Aleo deployment transaction mismatch");
    }
    if (owner.address !== ALEO_TESTNET_PROGRAM_OWNER || deployment.program_owner !== ALEO_TESTNET_PROGRAM_OWNER) {
      throw new Error("Aleo deployment owner mismatch");
    }
    if (typeof deployment.edition !== "number" || typeof transactionProgram !== "string") {
      throw new Error("Aleo deployment edition or program payload is invalid");
    }
    assertCanonicalProgramSource(transactionProgram);
    return {
      kind: "found",
      value: {
        edition: deployment.edition,
        verifyingKeyCount: verificationKeyCount(deployment.verifying_keys),
      },
    };
  } catch (error) {
    return {
      kind: "configuration_error",
      error: {
        status: error instanceof SyntaxError ? "invalid_payload" : "mismatch",
        message: error instanceof Error ? error.message : "Deployment transaction verification failed.",
      },
    };
  }
}

function deploymentStatusFrom(
  program: EndpointResult<{ source: string }>,
  transaction: EndpointResult<TransactionVerification>,
): AleoDeploymentStatus {
  const programFound = program.kind === "found";
  const transactionFound = transaction.kind === "found";
  const programError = program.kind === "found" ? undefined : program.error;
  const transactionError = transaction.kind === "found" ? undefined : transaction.error;

  let verificationStatus: DeploymentVerificationStatus;
  if (program.kind === "configuration_error" || transaction.kind === "configuration_error") {
    verificationStatus = "configuration_error";
  } else if (programFound && transactionFound) {
    verificationStatus = "verified";
  } else if (programFound && transaction.kind === "unavailable") {
    verificationStatus = "program_found_transaction_unavailable";
  } else if (transactionFound && program.kind === "unavailable") {
    verificationStatus = "transaction_found_program_unavailable";
  } else if (program.kind === "not_found" && transaction.kind === "not_found") {
    verificationStatus = "not_deployed";
  } else if (program.kind === "not_found" || transaction.kind === "not_found") {
    verificationStatus = "configuration_error";
  } else {
    verificationStatus = "endpoint_unavailable";
  }

  const confirmed = verificationStatus === "verified";
  const partial =
    verificationStatus === "program_found_transaction_unavailable" ||
    verificationStatus === "transaction_found_program_unavailable";

  const status: AleoDeploymentStatus = {
    status: confirmed
      ? "Confirmed"
      : partial
        ? "Partial"
        : verificationStatus === "not_deployed"
          ? "NotDeployed"
          : verificationStatus === "configuration_error"
            ? "ConfigurationError"
            : "Unavailable",
    verification: confirmed
      ? "NetworkConfirmed"
      : partial
        ? "Partial"
        : verificationStatus === "not_deployed"
          ? "NotDeployed"
          : verificationStatus === "configuration_error"
            ? "ConfigurationError"
            : "Unavailable",
    verificationStatus,
    network: "testnet",
    programId: CANONICAL_ALEO_PROGRAM_ID,
    transactionId: ALEO_TESTNET_DEPLOYMENT.transactionId,
    programOwner: ALEO_TESTNET_PROGRAM_OWNER,
    edition: transactionFound ? transaction.value.edition : null,
    currentEdition: transactionFound ? transaction.value.edition : null,
    verifyingKeyCount: transactionFound ? transaction.value.verifyingKeyCount : null,
    programFound,
    transactionFound,
    programExplorerUrl: ALEO_TESTNET_DEPLOYMENT.programExplorerUrl,
    transactionExplorerUrl: ALEO_TESTNET_DEPLOYMENT.transactionExplorerUrl,
    endpoints: {
      program: ALEO_TESTNET_DEPLOYMENT.programApiUrl,
      transaction: ALEO_TESTNET_DEPLOYMENT.transactionApiUrl,
    },
    errors: {
      ...(programError ? { program: programError } : {}),
      ...(transactionError ? { transaction: transactionError } : {}),
    },
  };
  if (Object.keys(status.errors ?? {}).length === 0) delete status.errors;
  assertNoPrivateFields(status);
  return status;
}

export async function fetchAleoDeploymentStatus(
  fetcher: DeploymentFetch = fetch,
): Promise<AleoDeploymentStatus> {
  const [program, transaction] = await Promise.all([
    verifyProgramEndpoint(fetcher),
    verifyTransactionEndpoint(fetcher),
  ]);
  return deploymentStatusFrom(program, transaction);
}

export function deploymentHttpStatus(deployment: AleoDeploymentStatus): number {
  switch (deployment.verificationStatus) {
    case "verified":
    case "program_found_transaction_unavailable":
    case "transaction_found_program_unavailable":
      return 200;
    case "not_deployed":
      return 404;
    case "configuration_error":
      return 500;
    case "endpoint_unavailable":
      return 503;
  }
}
