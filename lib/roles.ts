import type { CurrentActor, Role } from "./models.ts";

export const demoActors: CurrentActor[] = [
  {
    id: "owner-demo",
    role: "ProjectOwner",
    displayName: "Demo Vault Team",
  },
  {
    id: "whitehat-demo",
    role: "Whitehat",
    displayName: "Anonymous Whitehat",
  },
  {
    id: "arbiter-demo",
    role: "TriageArbiter",
    displayName: "Security Arbiter",
  },
  {
    id: "public-demo",
    role: "PublicUser",
    displayName: "Public Community",
  },
];

export const roleLabels: Record<Role, string> = {
  ProjectOwner: "Project Owner",
  Whitehat: "Whitehat",
  TriageArbiter: "Triage Arbiter",
  PublicUser: "Public User",
};

export function getDemoActor(role: Role) {
  const actor = demoActors.find((item) => item.role === role);
  if (!actor) {
    throw new Error(`Demo actor not found for ${role}`);
  }
  return actor;
}
