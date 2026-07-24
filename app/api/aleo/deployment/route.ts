import { NextResponse } from "next/server.js";

import {
  deploymentHttpStatus,
  fetchAleoDeploymentStatus,
  type DeploymentFetch,
} from "../../../../lib/aleo-deployment.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeploymentStatusOptions = {
  fetcher?: DeploymentFetch;
};

export async function handleAleoDeploymentStatus(options: DeploymentStatusOptions = {}) {
  try {
    const deployment = await fetchAleoDeploymentStatus(options.fetcher);
    return { status: deploymentHttpStatus(deployment), body: { deployment } };
  } catch (error) {
    return {
      status: 500,
      body: {
        deployment: {
          status: "ConfigurationError",
          verification: "ConfigurationError",
          verificationStatus: "configuration_error",
          error: error instanceof Error ? error.message : "Deployment verification failed.",
        },
      },
    };
  }
}

export async function GET() {
  const result = await handleAleoDeploymentStatus();
  return NextResponse.json(result.body, { status: result.status });
}
