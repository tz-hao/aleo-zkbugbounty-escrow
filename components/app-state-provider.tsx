"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  createPersistedDemoState,
  DEMO_STATE_STORAGE_KEY,
  hydratePersistedDemoState,
  parsePersistedDemoState,
  type PersistedDemoState,
} from "@/lib/persistence";
import type { ActionType, Bounty, DemoState, ProofResult, Role } from "@/lib/models";
import type { BountyRewards } from "@/lib/models";
import type { DisclosureShareAttestation } from "@/lib/store";
import {
  addTriageNote,
  createBounty,
  createInitialDemoState,
  lockReward,
  markPatched,
  rejectClaim,
  releaseBounty,
  requestEncryptedDetails,
  shareEncryptedDetails,
  submitClaim,
  switchActor,
} from "@/lib/store";

type CreateBountyInput = {
  projectName: string;
  scope: string;
  bountyAmount: number;
  rewards: BountyRewards;
  ruleId?: Bounty["ruleId"];
  ruleText: string;
  disclosureDeadline: string;
};

type StoreAction =
  | { type: "switchActor"; role: Role }
  | { type: "createBounty"; input: CreateBountyInput }
  | { type: "submitClaim"; bountyId: string; proof: ProofResult }
  | { type: "triage"; claimId: string; actionType: ActionType; publicNote?: string }
  | { type: "shareEncryptedDetails"; claimId: string; attestation: DisclosureShareAttestation }
  | { type: "addTriageNote"; claimId: string; publicNote: string }
  | { type: "hydratePublicState"; persisted: PersistedDemoState };

type AppStateContextValue = {
  state: DemoState;
  dispatch: Dispatch<StoreAction>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

function reducer(state: DemoState, action: StoreAction): DemoState {
  switch (action.type) {
    case "switchActor":
      return switchActor(state, action.role);
    case "hydratePublicState":
      return hydratePersistedDemoState(state, action.persisted);
    case "createBounty":
      return createBounty(state, state.currentActor, action.input);
    case "submitClaim":
      return submitClaim(state, state.currentActor, action.bountyId, action.proof);
    case "shareEncryptedDetails":
      return shareEncryptedDetails(state, state.currentActor, action.claimId, action.attestation);
    case "addTriageNote":
      return addTriageNote(state, state.currentActor, action.claimId, action.publicNote);
    case "triage":
      if (action.actionType === "RewardLocked") {
        return lockReward(state, state.currentActor, action.claimId, action.publicNote);
      }
      if (action.actionType === "DetailsRequested") {
        return requestEncryptedDetails(state, state.currentActor, action.claimId, action.publicNote);
      }
      if (action.actionType === "Patched") {
        return markPatched(state, state.currentActor, action.claimId, action.publicNote);
      }
      if (action.actionType === "Paid") {
        return releaseBounty(state, state.currentActor, action.claimId, action.publicNote);
      }
      if (action.actionType === "Rejected") {
        return rejectClaim(state, state.currentActor, action.claimId, action.publicNote);
      }
      return state;
    default:
      return state;
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialDemoState);
  const hydrated = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(DEMO_STATE_STORAGE_KEY);
    const persisted = stored ? parsePersistedDemoState(stored) : null;
    hydrated.current = true;
    dispatch({
      type: "hydratePublicState",
      persisted: persisted ?? createPersistedDemoState(createInitialDemoState()),
    });
  }, []);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    window.localStorage.setItem(
      DEMO_STATE_STORAGE_KEY,
      JSON.stringify(createPersistedDemoState(state)),
    );
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return context;
}
