"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  ALEO_WALLET_TESTNET_CHAIN_ID,
  type CreateBountyTransactionPreview,
} from "@/lib/aleo-create-bounty";
import { CANONICAL_ALEO_PROGRAM_ID } from "@/lib/aleo-program";
import {
  RESPONSIBLE_DISCLOSURE_FUNCTIONS,
  REWARD_ESCROW_FUNCTIONS,
  type RewardEscrowTransactionPreview,
} from "@/lib/aleo-reward-escrow";
import {
  buildTransientSubmitClaimV3Inputs,
  PROTOCOL_V3_PUBLIC_TRANSACTION_FUNCTIONS,
  SUBMIT_CLAIM_V3_FUNCTION,
  type ProtocolV3TransactionPreview,
  type TransientSubmitClaimV3Request,
} from "@/lib/aleo-protocol-v3";
import {
  assertSubmitClaimRawInputs,
  buildTransientSubmitClaimInputs,
  SUBMIT_CLAIM_FUNCTION,
  type TransientSubmitClaimRequest,
} from "@/lib/aleo-submit-claim";
import {
  buildTransientSubmitClaimV2Inputs,
  SUBMIT_CLAIM_V2_FUNCTION,
  type TransientSubmitClaimV2Request,
} from "@/lib/aleo-submit-claim-v2";
import {
  diagnoseLeoWalletConnectionError,
  getInjectedLeoWallet,
  inspectLeoWalletProvider,
} from "@/lib/leo-wallet-diagnostics";
import {
  classifyWalletResponseId,
  normalizeWalletTransactionStatus,
} from "@/lib/wallet-compatibility";
import {
  classifyWalletTransactionFailure,
  isTransactionSubmissionBlocked,
  pollPublicTransaction,
  transactionFeedback,
  type PublicTransactionFeedback,
} from "@/lib/aleo-transaction-status";

type LeoAdapter = import("@demox-labs/aleo-wallet-adapter-leo").LeoWalletAdapter;

export type WalletConnectionState =
  | "Initializing"
  | "NotInstalled"
  | "Disconnected"
  | "Connecting"
  | "Connected"
  | "Error";

export type WalletCreateBountySubmission = {
  walletRequestId: string;
  publicTransactionId: string | null;
  bountyId: string;
  status: "Submitted" | "Processing" | "Finalized" | "Failed";
  statusText: string;
};

export type WalletClaimSubmission = {
  walletRequestId: string;
  publicTransactionId: string | null;
  bountyId: string;
  functionName:
    | typeof SUBMIT_CLAIM_FUNCTION
    | typeof SUBMIT_CLAIM_V2_FUNCTION
    | typeof SUBMIT_CLAIM_V3_FUNCTION;
  status: "Submitted" | "Processing" | "Finalized" | "Failed";
  statusText: string;
};

export type WalletProtocolSubmission = {
  walletRequestId: string;
  publicTransactionId: string | null;
  functionName:
    | RewardEscrowTransactionPreview["functionName"]
    | ProtocolV3TransactionPreview["functionName"];
  bountyId: string;
  claimHash: string | null;
  status: "Submitted" | "Processing" | "Finalized" | "Failed";
  statusText: string;
};

type AleoWalletContextValue = {
  address: string | null;
  connectionState: WalletConnectionState;
  errorMessage: string | null;
  transactionStatus: PublicTransactionFeedback;
  transactionSubmissionBlocked: boolean;
  pendingPublicTransactionId: string | null;
  submission: WalletCreateBountySubmission | null;
  claimSubmission: WalletClaimSubmission | null;
  protocolSubmission: WalletProtocolSubmission | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  submitCreateBounty: (preview: CreateBountyTransactionPreview) => Promise<string>;
  submitWalletClaim: (request: TransientSubmitClaimRequest) => Promise<string>;
  submitWalletClaimV2: (request: TransientSubmitClaimV2Request) => Promise<string>;
  submitWalletClaimV3: (request: TransientSubmitClaimV3Request) => Promise<string>;
  submitProtocolTransaction: (preview: RewardEscrowTransactionPreview) => Promise<string>;
  submitProtocolV3Transaction: (
    preview: ProtocolV3TransactionPreview,
  ) => Promise<string>;
  refreshSubmission: () => Promise<void>;
  refreshClaimSubmission: () => Promise<void>;
  refreshProtocolSubmission: () => Promise<void>;
  submitControlledDuplicateClaimInputs: (request: {
    bountyId: string;
    feeMicrocredits: number;
    inputs: readonly string[];
  }) => Promise<string>;
};

const AleoWalletContext = createContext<AleoWalletContextValue | null>(null);
const ALEO_ADDRESS_PATTERN = /^aleo1[0-9a-z]{58}$/;
const LEO_WALLET_NOT_DETECTED_MESSAGE =
  "当前浏览器未检测到 Leo Wallet 扩展。请使用已安装该扩展的 Chrome 或 Edge 打开本站。";
const PUBLIC_PENDING_TRANSACTION_STORAGE_KEY = "zkbugbounty.public-pending-transaction.v1";
const PUBLIC_TRANSACTION_ID_PATTERN = /^at1[0-9a-z]{50,80}$/;

export function AleoWalletProvider({ children }: { children: ReactNode }) {
  const adapterRef = useRef<LeoAdapter | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<WalletConnectionState>("Initializing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<PublicTransactionFeedback>(() =>
    transactionFeedback("idle"),
  );
  const transactionRequestActiveRef = useRef(false);
  const pollingControllerRef = useRef<AbortController | null>(null);
  const [pendingPublicTransactionId, setPendingPublicTransactionId] = useState<string | null>(() => {
    try {
      const stored = window.sessionStorage.getItem(PUBLIC_PENDING_TRANSACTION_STORAGE_KEY);
      return stored && PUBLIC_TRANSACTION_ID_PATTERN.test(stored) ? stored : null;
    } catch {
      return null;
    }
  });
  const [submission, setSubmission] = useState<WalletCreateBountySubmission | null>(null);
  const [claimSubmission, setClaimSubmission] = useState<WalletClaimSubmission | null>(null);
  const [protocolSubmission, setProtocolSubmission] =
    useState<WalletProtocolSubmission | null>(null);

  useEffect(() => {
    let active = true;
    let adapter: LeoAdapter | null = null;
    const handleReadyState = (readyState: string) => {
      if (!active || adapter?.connected) return;
      if (readyState === "Installed") {
        setConnectionState("Disconnected");
        setErrorMessage(null);
        return;
      }
      setConnectionState("NotInstalled");
      setErrorMessage(LEO_WALLET_NOT_DETECTED_MESSAGE);
    };
    const handleDisconnect = () => {
      if (!active) return;
      setAddress(null);
      setSubmission(null);
      setClaimSubmission(null);
      setProtocolSubmission(null);
      transactionRequestActiveRef.current = false;
      setTransactionStatus(transactionFeedback("idle"));
      setErrorMessage(null);
      setConnectionState(adapter?.readyState === "Installed" ? "Disconnected" : "NotInstalled");
    };

    void import("@demox-labs/aleo-wallet-adapter-leo")
      .then(({ LeoWalletAdapter }) => {
        if (!active) return;
        adapter = new LeoWalletAdapter({ appName: "zkBugBounty" });
        adapterRef.current = adapter;
        adapter.on("readyStateChange", handleReadyState);
        adapter.on("disconnect", handleDisconnect);
        handleReadyState(adapter.readyState);
      })
      .catch(() => {
        if (!active) return;
        setConnectionState("Error");
        setErrorMessage("Leo Wallet Adapter 无法初始化。");
      });

    return () => {
      active = false;
      adapter?.off("readyStateChange", handleReadyState);
      adapter?.off("disconnect", handleDisconnect);
      adapterRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pendingPublicTransactionId) return;
    const controller = new AbortController();
    transactionRequestActiveRef.current = true;
    pollingControllerRef.current?.abort();
    pollingControllerRef.current = controller;
    void pollPublicTransaction({
      signal: controller.signal,
      maxAttempts: 10,
      intervalMs: 2_000,
      lookup: async () => {
        const response = await fetch(
          "/api/aleo/transactions/" + encodeURIComponent(pendingPublicTransactionId),
          { cache: "no-store", signal: controller.signal },
        );
        const payload = await response.json().catch(() => null) as {
          transactionStatus?: string;
          rejectionSummary?: string;
        } | null;
        return {
          httpStatus: response.status,
          status: payload?.transactionStatus,
          rejectionReason: payload?.rejectionSummary,
        };
      },
      onUpdate: setTransactionStatus,
    }).then((result) => {
      if (controller.signal.aborted) return;
      if (["confirmed", "rejected", "timeout"].includes(result.state)) {
        transactionRequestActiveRef.current = false;
        setPendingPublicTransactionId(null);
        try {
          window.sessionStorage.removeItem(PUBLIC_PENDING_TRANSACTION_STORAGE_KEY);
        } catch {
          // Public state cleanup is best-effort.
        }
      }
    }).catch(() => {
      // Abort and transient lookup failures are already represented by the polling state.
    });
    return () => controller.abort();
  }, [pendingPublicTransactionId]);

  async function connect() {
    const adapter = adapterRef.current;
    const providerEnvironment = inspectLeoWalletProvider(getInjectedLeoWallet(window));

    if (providerEnvironment === "Missing") {
      setConnectionState("NotInstalled");
      setErrorMessage(LEO_WALLET_NOT_DETECTED_MESSAGE);
      return;
    }
    if (providerEnvironment === "Incompatible") {
      setConnectionState("Error");
      setErrorMessage("检测到 Leo Wallet，但扩展接口不可用。请更新扩展、解锁钱包并刷新页面。");
      return;
    }
    if (!adapter || adapter.readyState !== "Installed") {
      setConnectionState("Error");
      setErrorMessage("Leo Wallet 已注入，但 Adapter 尚未就绪。请刷新页面后重新连接。");
      return;
    }
    setConnectionState("Connecting");
    setErrorMessage(null);
    try {
      const { DecryptPermission, WalletAdapterNetwork } = await import(
        "@demox-labs/aleo-wallet-adapter-base"
      );
      await adapter.connect(DecryptPermission.NoDecrypt, WalletAdapterNetwork.TestnetBeta, [
        CANONICAL_ALEO_PROGRAM_ID,
      ]);
      const publicKey = adapter.publicKey;
      if (!ALEO_ADDRESS_PATTERN.test(publicKey)) {
        throw new Error("INVALID_ALEO_PUBLIC_ADDRESS");
      }
      setAddress(publicKey);
      setConnectionState("Connected");
    } catch (error) {
      const diagnostic = diagnoseLeoWalletConnectionError(error);
      setAddress(null);
      setConnectionState(diagnostic.issue === "AuthorizationRejected" ? "Disconnected" : "Error");
      setErrorMessage(diagnostic.message);
    }
  }

  async function disconnect() {
    const adapter = adapterRef.current;
    setErrorMessage(null);
    if (adapter) {
      try {
        await adapter.disconnect();
      } catch {
        setErrorMessage("钱包断开请求失败，请在扩展中检查连接状态。");
      }
    }
    setAddress(null);
    setSubmission(null);
    setClaimSubmission(null);
    setProtocolSubmission(null);
    transactionRequestActiveRef.current = false;
    setTransactionStatus(transactionFeedback("idle"));
    setConnectionState(adapter?.readyState === "Installed" ? "Disconnected" : "NotInstalled");
  }

  async function requestWalletTransaction(
    adapter: LeoAdapter,
    transaction: Parameters<LeoAdapter["requestTransaction"]>[0],
  ) {
    if (transactionRequestActiveRef.current || isTransactionSubmissionBlocked(transactionStatus.state)) {
      throw new Error("A public transaction is already pending. Do not resubmit the same operation.");
    }
    transactionRequestActiveRef.current = true;
    setTransactionStatus(transactionFeedback("awaiting_signature"));
    try {
      const response = classifyWalletResponseId(await adapter.requestTransaction(transaction));
      if (!response) throw new Error("INVALID_WALLET_RESPONSE");
      setTransactionStatus(transactionFeedback("pending"));
      if (response.publicTransactionId && PUBLIC_TRANSACTION_ID_PATTERN.test(response.publicTransactionId)) {
        setPendingPublicTransactionId(response.publicTransactionId);
        try {
          window.sessionStorage.setItem(PUBLIC_PENDING_TRANSACTION_STORAGE_KEY, response.publicTransactionId);
        } catch {
          // A storage failure never changes transaction handling or causes a retry.
        }
      }
      return response;
    } catch (error) {
      transactionRequestActiveRef.current = false;
      const feedback = classifyWalletTransactionFailure(error);
      setTransactionStatus(feedback);
      throw new Error(feedback.message);
    }
  }

  async function submitCreateBounty(preview: CreateBountyTransactionPreview) {
    const adapter = adapterRef.current;
    if (!adapter?.connected || !address) {
      throw new Error("Connect Leo Wallet before requesting a transaction");
    }
    if (
      preview.network !== "testnet" ||
      preview.walletChainId !== ALEO_WALLET_TESTNET_CHAIN_ID ||
      preview.programId !== CANONICAL_ALEO_PROGRAM_ID ||
      preview.functionName !== "create_bounty"
    ) {
      throw new Error("Transaction preview does not match the canonical Testnet program");
    }
    const { Transaction, WalletAdapterNetwork } = await import(
      "@demox-labs/aleo-wallet-adapter-base"
    );
    const transaction = Transaction.createTransaction(
      address,
      WalletAdapterNetwork.TestnetBeta,
      preview.programId,
      preview.functionName,
      [...preview.inputs],
      preview.feeMicrocredits,
      false,
    );
    const response = await requestWalletTransaction(adapter, transaction);
    const { walletRequestId, publicTransactionId } = response;
    setSubmission({
      walletRequestId,
      publicTransactionId,
      bountyId: preview.publicInputs.bountyId,
      status: "Submitted",
      statusText: publicTransactionId
        ? "钱包已返回 Public Transaction ID；仍需等待链上 Confirmed。"
        : "钱包已接收请求；返回值尚不能作为公开 Transaction ID，这不等于链上 Confirmed。",
    });
    return walletRequestId;
  }

  async function submitWalletClaim(request: TransientSubmitClaimRequest) {
    const adapter = adapterRef.current;
    if (!adapter?.connected || !address) {
      throw new Error("Connect Leo Wallet before requesting submit_claim");
    }
    const { Transaction, WalletAdapterNetwork } = await import(
      "@demox-labs/aleo-wallet-adapter-base"
    );
    const inputs = buildTransientSubmitClaimInputs(request);
    try {
      const transaction = Transaction.createTransaction(
        address,
        WalletAdapterNetwork.TestnetBeta,
        CANONICAL_ALEO_PROGRAM_ID,
        SUBMIT_CLAIM_FUNCTION,
        inputs,
        request.feeMicrocredits,
        false,
      );
      const response = await requestWalletTransaction(adapter, transaction);
      const { walletRequestId, publicTransactionId } = response;
      setClaimSubmission({
        walletRequestId,
        publicTransactionId,
        bountyId: request.bounty.bountyId,
        functionName: SUBMIT_CLAIM_FUNCTION,
        status: "Submitted",
        statusText: publicTransactionId
          ? "钱包已返回 Public Transaction ID；仍需等待链上 Confirmed 与 claim_receipts mapping 验证。"
          : "钱包已接收 submit_claim；返回值目前只是 Wallet Request ID，不代表链上 Confirmed。",
      });
      return walletRequestId;
    } finally {
      inputs.fill("");
      for (const key of Object.keys(request.witness) as Array<keyof typeof request.witness>) {
        request.witness[key] = "";
      }
    }
  }

  async function submitWalletClaimV2(request: TransientSubmitClaimV2Request) {
    const adapter = adapterRef.current;
    if (!adapter?.connected || !address) {
      throw new Error("Connect Leo Wallet before requesting submit_claim_v2");
    }

    const [capabilityResponse, bountyResponse] = await Promise.all([
      fetch("/api/aleo/escrow", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      }),
      fetch("/api/aleo/escrow/" + encodeURIComponent(request.bounty.bountyId), {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      }),
    ]);
    const [capabilityPayload, bountyPayload] = await Promise.all([
      capabilityResponse.json().catch(() => null) as Promise<{
        escrow?: { status?: string; walletRequestEnabled?: boolean };
      } | null>,
      bountyResponse.json().catch(() => null) as Promise<{ protocolVersion?: number } | null>,
    ]);
    if (
      !capabilityResponse.ok ||
      capabilityPayload?.escrow?.status !== "Available" ||
      capabilityPayload.escrow.walletRequestEnabled !== true
    ) {
      throw new Error("submit_claim_v2 is not available in the deployed Aleo Program");
    }
    if (!bountyResponse.ok || bountyPayload?.protocolVersion !== 2) {
      throw new Error("submit_claim_v2 requires a protocol-v2 Bounty");
    }

    const { Transaction, WalletAdapterNetwork } = await import(
      "@demox-labs/aleo-wallet-adapter-base"
    );
    const inputs = buildTransientSubmitClaimV2Inputs(request);
    try {
      const transaction = Transaction.createTransaction(
        address,
        WalletAdapterNetwork.TestnetBeta,
        CANONICAL_ALEO_PROGRAM_ID,
        SUBMIT_CLAIM_V2_FUNCTION,
        inputs,
        request.feeMicrocredits,
        false,
      );
      const response = await requestWalletTransaction(adapter, transaction);
      const { walletRequestId, publicTransactionId } = response;
      setClaimSubmission({
        walletRequestId,
        publicTransactionId,
        bountyId: request.bounty.bountyId,
        functionName: SUBMIT_CLAIM_V2_FUNCTION,
        status: "Submitted",
        statusText: publicTransactionId
          ? "钱包已返回 Public Transaction ID；仍需等待链上 Confirmed、Claim Receipt、Reporter 与 Nullifier Mapping 验证。"
          : "钱包已接收 submit_claim_v2；当前返回值只是 Wallet Request ID，不代表链上 Confirmed。",
      });
      return walletRequestId;
    } finally {
      inputs.fill("");
      for (const key of Object.keys(request.witness) as Array<keyof typeof request.witness>) {
        request.witness[key] = "";
      }
    }
  }

  async function submitWalletClaimV3(request: TransientSubmitClaimV3Request) {
    const adapter = adapterRef.current;
    if (!adapter?.connected || !address) {
      throw new Error("Connect Leo Wallet before requesting submit_claim_v3");
    }

    const [capabilityResponse, bountyResponse] = await Promise.all([
      fetch("/api/aleo/v3", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      }),
      fetch(
        "/api/aleo/v3/bounties/" + encodeURIComponent(request.bounty.bountyId),
        {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
        },
      ),
    ]);
    const [capabilityPayload, bountyPayload] = await Promise.all([
      capabilityResponse.json().catch(() => null) as Promise<{
      protocolV3?: {
        status?: string;
        walletRequestEnabled?: boolean;
        programHashVerified?: boolean;
      };
      } | null>,
      bountyResponse.json().catch(() => null) as Promise<{
        protocolVersion?: number;
        policy?: {
          targetSystemCommitment?: string;
          targetCodeHash?: string;
        };
      } | null>,
    ]);
    if (
      !capabilityResponse.ok ||
      capabilityPayload?.protocolV3?.status !== "Available" ||
      capabilityPayload.protocolV3.walletRequestEnabled !== true ||
      capabilityPayload.protocolV3.programHashVerified !== true
    ) {
      throw new Error(
        "submit_claim_v3 requires verified Program Edition source-hash deployment evidence",
      );
    }
    if (
      !bountyResponse.ok ||
      bountyPayload?.protocolVersion !== 3 ||
      bountyPayload.policy?.targetSystemCommitment !==
        request.binding.targetSystemCommitment ||
      bountyPayload.policy.targetCodeHash !== request.binding.targetCodeHash
    ) {
      throw new Error(
        "submit_claim_v3 requires a canonical Protocol-v3 Bounty and matching target bindings",
      );
    }

    const { Transaction, WalletAdapterNetwork } = await import(
      "@demox-labs/aleo-wallet-adapter-base"
    );
    const inputs = buildTransientSubmitClaimV3Inputs(request);
    try {
      const transaction = Transaction.createTransaction(
        address,
        WalletAdapterNetwork.TestnetBeta,
        CANONICAL_ALEO_PROGRAM_ID,
        SUBMIT_CLAIM_V3_FUNCTION,
        inputs,
        request.feeMicrocredits,
        false,
      );
      const response = await requestWalletTransaction(adapter, transaction);
      const { walletRequestId, publicTransactionId } = response;
      setClaimSubmission({
        walletRequestId,
        publicTransactionId,
        bountyId: request.bounty.bountyId,
        functionName: SUBMIT_CLAIM_V3_FUNCTION,
        status: "Submitted",
        statusText: publicTransactionId
          ? "钱包已返回公开 Transaction ID；仍需等待 Confirmed，并核验 V3 Receipt、Evidence 与 State Mapping。"
          : "钱包已接收 submit_claim_v3；当前返回值只是 Wallet Request ID，不代表链上 Confirmed。",
      });
      return walletRequestId;
    } finally {
      inputs.fill("");
      for (
        const key of Object.keys(request.witness) as Array<
          keyof typeof request.witness
        >
      ) {
        request.witness[key] = "";
      }
    }
  }
  async function submitControlledDuplicateClaimInputs(request: {
    bountyId: string;
    feeMicrocredits: number;
    inputs: readonly string[];
  }) {
    const adapter = adapterRef.current;
    if (!adapter?.connected || !address) {
      throw new Error("Connect Leo Wallet before requesting submit_claim");
    }
    if (!Number.isSafeInteger(request.feeMicrocredits) || request.feeMicrocredits <= 0) {
      throw new Error("submit_claim fee must be positive microcredits");
    }
    assertSubmitClaimRawInputs(request.inputs);
    const { Transaction, WalletAdapterNetwork } = await import(
      "@demox-labs/aleo-wallet-adapter-base"
    );
    const transientInputs = [...request.inputs];
    try {
      const transaction = Transaction.createTransaction(
        address,
        WalletAdapterNetwork.TestnetBeta,
        CANONICAL_ALEO_PROGRAM_ID,
        SUBMIT_CLAIM_FUNCTION,
        transientInputs,
        request.feeMicrocredits,
        false,
      );
      const response = await requestWalletTransaction(adapter, transaction);
      const { walletRequestId, publicTransactionId } = response;
      setClaimSubmission({
        walletRequestId,
        publicTransactionId,
        bountyId: request.bountyId,
        functionName: SUBMIT_CLAIM_FUNCTION,
        status: "Submitted",
        statusText: publicTransactionId
          ? "钱包已返回 Public Transaction ID；仍需等待链上 Confirmed 与 duplicate nullifier 验证。"
          : "钱包已接收受控 submit_claim；返回值目前只是 Wallet Request ID，不代表链上 Confirmed。",
      });
      return walletRequestId;
    } finally {
      transientInputs.fill("");
    }
  }

  async function submitProtocolTransaction(preview: RewardEscrowTransactionPreview) {
    const adapter = adapterRef.current;
    if (!adapter?.connected || !address) {
      throw new Error("Connect Leo Wallet before requesting a protocol transaction");
    }
    const capabilityResponse = await fetch("/api/aleo/escrow", {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const capabilityPayload = await capabilityResponse.json().catch(() => null) as {
      escrow?: { status?: string; walletRequestEnabled?: boolean };
    } | null;
    if (
      !capabilityResponse.ok ||
      capabilityPayload?.escrow?.status !== "Available" ||
      capabilityPayload.escrow.walletRequestEnabled !== true
    ) {
      throw new Error("Reward Escrow is not available in the deployed Aleo Program");
    }
    const operationMarker = preview.publicSummary.operationMarker;
    if (operationMarker) {
      const markerResponse = await fetch(
        "/api/aleo/mappings/escrow_operation_markers/" + encodeURIComponent(operationMarker),
        { method: "GET", headers: { accept: "application/json" }, cache: "no-store" },
      );
      const markerPayload = await markerResponse.json().catch(() => null) as {
        verification?: { status?: string };
      } | null;
      const markerStatus = markerPayload?.verification?.status;
      if (!markerResponse.ok || markerStatus === "HTTP_ERROR" || markerStatus === "PARSE_ERROR") {
        throw new Error("Operation marker could not be verified against the public registry");
      }
      if (markerStatus === "FOUND") {
        throw new Error("Operation marker already exists. Do not resubmit this operation.");
      }
    }
    const allowedFunctions = new Set<string>([
      ...REWARD_ESCROW_FUNCTIONS,
      ...RESPONSIBLE_DISCLOSURE_FUNCTIONS,
    ]);
    if (
      preview.source !== "AleoTestnet" ||
      preview.network !== "testnet" ||
      preview.walletChainId !== ALEO_WALLET_TESTNET_CHAIN_ID ||
      preview.programId !== CANONICAL_ALEO_PROGRAM_ID ||
      !allowedFunctions.has(preview.functionName) ||
      !Number.isSafeInteger(preview.feeMicrocredits) ||
      preview.feeMicrocredits <= 0 ||
      preview.inputs.length === 0
    ) {
      throw new Error("Protocol transaction preview is not canonical");
    }
    const { Transaction, WalletAdapterNetwork } = await import(
      "@demox-labs/aleo-wallet-adapter-base"
    );
    const transaction = Transaction.createTransaction(
      address,
      WalletAdapterNetwork.TestnetBeta,
      preview.programId,
      preview.functionName,
      [...preview.inputs],
      preview.feeMicrocredits,
      false,
    );
    const response = await requestWalletTransaction(adapter, transaction);
    const { walletRequestId, publicTransactionId } = response;
    setProtocolSubmission({
      walletRequestId,
      publicTransactionId,
      functionName: preview.functionName,
      bountyId: preview.publicSummary.bountyId,
      claimHash: preview.publicSummary.claimHash ?? null,
      status: "Submitted",
      statusText: publicTransactionId
        ? "Wallet 已返回公开 Transaction ID；仍需等待 Confirmed 与 Mapping Verified。"
        : "Wallet 已接收协议交易；当前返回值不能视为链上 Confirmed。",
    });
    return walletRequestId;
  }


  async function submitProtocolV3Transaction(
    preview: ProtocolV3TransactionPreview,
  ) {
    const adapter = adapterRef.current;
    if (!adapter?.connected || !address) {
      throw new Error("Connect Leo Wallet before requesting a Protocol-v3 transaction");
    }
    const capabilityResponse = await fetch("/api/aleo/v3", {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const capabilityPayload = await capabilityResponse.json().catch(() => null) as {
      protocolV3?: {
        status?: string;
        walletRequestEnabled?: boolean;
        upgradeEvidenceVerified?: boolean;
        programHashVerified?: boolean;
      };
    } | null;
    if (
      !capabilityResponse.ok ||
      capabilityPayload?.protocolV3?.status !== "Available" ||
      capabilityPayload.protocolV3.walletRequestEnabled !== true ||
      capabilityPayload.protocolV3.upgradeEvidenceVerified !== true ||
      capabilityPayload.protocolV3.programHashVerified !== true
    ) {
      throw new Error(
        "Protocol V3 requires verified Program Edition source-hash deployment evidence",
      );
    }

    const expectedInputCounts: Record<
      ProtocolV3TransactionPreview["functionName"],
      number
    > = {
      create_bounty_v3: 9,
      fund_bounty_v3: 3,
      review_claim_v3: 5,
      lock_reward_v3: 4,
      disclosure_action_v3: 5,
      resolution_action_v3: 5,
      dispute_claim_v3: 6,
      cast_arbitration_vote_v3: 4,
      settle_reward_v3: 7,
      finalize_arbitration_prelock_v3: 7,
      finalize_rejection_v3: 5,
      refund_bounty_v3: 3,
    };
    const allowedFunctions = new Set<string>(
      PROTOCOL_V3_PUBLIC_TRANSACTION_FUNCTIONS,
    );
    if (
      preview.source !== "AleoTestnet" ||
      preview.network !== "testnet" ||
      preview.walletChainId !== ALEO_WALLET_TESTNET_CHAIN_ID ||
      preview.programId !== CANONICAL_ALEO_PROGRAM_ID ||
      !allowedFunctions.has(preview.functionName) ||
      preview.inputs.length !== expectedInputCounts[preview.functionName] ||
      !Number.isSafeInteger(preview.feeMicrocredits) ||
      preview.feeMicrocredits <= 0
    ) {
      throw new Error("Protocol-v3 transaction preview is not canonical");
    }

    const { Transaction, WalletAdapterNetwork } = await import(
      "@demox-labs/aleo-wallet-adapter-base"
    );
    const transaction = Transaction.createTransaction(
      address,
      WalletAdapterNetwork.TestnetBeta,
      preview.programId,
      preview.functionName,
      [...preview.inputs],
      preview.feeMicrocredits,
      false,
    );
    const response = await requestWalletTransaction(adapter, transaction);
    const { walletRequestId, publicTransactionId } = response;
    setProtocolSubmission({
      walletRequestId,
      publicTransactionId,
      functionName: preview.functionName,
      bountyId: preview.publicSummary.bountyId,
      claimHash: preview.publicSummary.claimHash ?? null,
      status: "Submitted",
      statusText: publicTransactionId
        ? "Wallet 已返回公开 Transaction ID；仍需等待 Confirmed，并重新读取 V3 Mapping。"
        : "Wallet 已接收 V3 协议交易；当前返回值不能视为链上 Confirmed。",
    });
    return walletRequestId;
  }
  async function refreshSubmission() {
    const adapter = adapterRef.current;
    if (!adapter?.connected || !submission) return;
    try {
      const walletStatus = await adapter.transactionStatus(submission.walletRequestId);
      const status = normalizeWalletTransactionStatus(walletStatus);
      if (status === "Failed") {
        transactionRequestActiveRef.current = false;
        setTransactionStatus(transactionFeedback("failed"));
      } else if (status === "Finalized") {
        setTransactionStatus(transactionFeedback("accepted"));
      }
      setSubmission({
        ...submission,
        status,
        statusText:
          status === "Finalized"
            ? "钱包处理已 Finalized；仍需使用公开 Transaction ID 验证链上交易与 mapping。"
            : status === "Failed"
              ? "钱包报告交易失败或拒绝。"
              : `钱包状态：${walletStatus}`,
      });
    } catch {
      setSubmission({
        ...submission,
        status: "Processing",
        statusText: "暂时无法读取钱包请求状态，请稍后重试。",
      });
    }
  }

  async function refreshClaimSubmission() {
    const adapter = adapterRef.current;
    if (!adapter?.connected || !claimSubmission) return;
    try {
      const walletStatus = await adapter.transactionStatus(claimSubmission.walletRequestId);
      const status = normalizeWalletTransactionStatus(walletStatus);
      if (status === "Failed") {
        transactionRequestActiveRef.current = false;
        setTransactionStatus(transactionFeedback("failed"));
      } else if (status === "Finalized") {
        setTransactionStatus(transactionFeedback("accepted"));
      }
      setClaimSubmission({
        ...claimSubmission,
        status,
        statusText:
          status === "Finalized"
            ? "钱包处理已 Finalized；仍需用公开 Transaction ID 验证 claim receipt 与 nullifier mapping。"
            : status === "Failed"
              ? "钱包报告 submit_claim 失败或拒绝；没有生成链上 Claim Receipt。"
              : `钱包状态：${walletStatus}`,
      });
    } catch {
      setClaimSubmission({
        ...claimSubmission,
        status: "Processing",
        statusText: "暂时无法读取 Wallet Request 状态，请稍后重试。",
      });
    }
  }

  async function refreshProtocolSubmission() {
    const adapter = adapterRef.current;
    if (!adapter?.connected || !protocolSubmission) return;
    try {
      const walletStatus = await adapter.transactionStatus(protocolSubmission.walletRequestId);
      const status = normalizeWalletTransactionStatus(walletStatus);
      if (status === "Failed") {
        transactionRequestActiveRef.current = false;
        setTransactionStatus(transactionFeedback("failed"));
      } else if (status === "Finalized") {
        setTransactionStatus(transactionFeedback("accepted"));
      }
      setProtocolSubmission({
        ...protocolSubmission,
        status,
        statusText:
          status === "Finalized"
            ? "Wallet 处理已 Finalized；仍需核验公开 Transaction 与协议 Mapping。"
            : status === "Failed"
              ? "Wallet 报告协议交易失败或拒绝；不得更新链上状态。"
              : `钱包状态：${walletStatus}`,
      });
    } catch {
      setProtocolSubmission({
        ...protocolSubmission,
        status: "Processing",
        statusText: "暂时无法读取 Wallet Request 状态，请稍后重试。",
      });
    }
  }

  const value: AleoWalletContextValue = {
    address,
    connectionState,
    errorMessage,
    transactionStatus,
    transactionSubmissionBlocked:
      pendingPublicTransactionId !== null || isTransactionSubmissionBlocked(transactionStatus.state),
    pendingPublicTransactionId,
    submission,
    claimSubmission,
    protocolSubmission,
    connect,
    disconnect,
    submitCreateBounty,
    submitWalletClaim,
    submitWalletClaimV2,
    submitWalletClaimV3,
    submitProtocolTransaction,
    submitProtocolV3Transaction,
    submitControlledDuplicateClaimInputs,
    refreshSubmission,
    refreshClaimSubmission,
    refreshProtocolSubmission,
  };

  return <AleoWalletContext.Provider value={value}>{children}</AleoWalletContext.Provider>;
}

export function useAleoWallet() {
  const context = useContext(AleoWalletContext);
  if (!context) throw new Error("useAleoWallet must be used inside AleoWalletProvider");
  return context;
}
