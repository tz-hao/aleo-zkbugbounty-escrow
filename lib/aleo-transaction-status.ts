import { diagnoseShieldWalletTransactionError } from "./shield-wallet-diagnostics.ts";

export type AleoTransactionState =
  | "idle"
  | "wallet_disconnected"
  | "wrong_network"
  | "awaiting_signature"
  | "signature_rejected"
  | "generating_transaction"
  | "broadcasting"
  | "pending"
  | "accepted"
  | "confirmed"
  | "rejected"
  | "failed"
  | "timeout";

export type TransactionIndexStatus =
  | "found"
  | "not_indexed_yet"
  | "endpoint_not_supported"
  | "not_found_after_timeout"
  | "http_error";

export type PublicTransactionFeedback = {
  state: AleoTransactionState;
  code: string;
  message: string;
  advice: string;
  indexStatus?: TransactionIndexStatus;
  rejectionSummary?: string;
};

export type PublicTransactionLookup = {
  httpStatus: number;
  status?: string | null;
  rejectionReason?: string | null;
};

export type PollingOptions = {
  lookup: (attempt: number) => Promise<PublicTransactionLookup>;
  onUpdate?: (feedback: PublicTransactionFeedback) => void;
  signal?: AbortSignal;
  maxAttempts?: number;
  intervalMs?: number;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
};

const IN_FLIGHT_STATES = new Set<AleoTransactionState>([
  "awaiting_signature",
  "generating_transaction",
  "broadcasting",
  "pending",
  "accepted",
]);
const DEFAULT_POLL_ATTEMPTS = 12;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

export function isTransactionSubmissionBlocked(state: AleoTransactionState) {
  return IN_FLIGHT_STATES.has(state);
}

export function transactionFeedback(
  state: AleoTransactionState,
  overrides: Partial<Omit<PublicTransactionFeedback, "state">> = {},
): PublicTransactionFeedback {
  const defaults: Record<AleoTransactionState, Omit<PublicTransactionFeedback, "state">> = {
    idle: { code: "IDLE", message: "尚未创建交易请求。", advice: "请先核对公开 Transaction Preview。" },
    wallet_disconnected: { code: "WALLET_DISCONNECTED", message: "Shield 未连接。", advice: "连接 Shield 并确认 Aleo Testnet 后重试。" },
    wrong_network: { code: "WRONG_NETWORK", message: "Shield 当前不在 Aleo Testnet。", advice: "切换到 Aleo Testnet 后重试。" },
    awaiting_signature: { code: "AWAITING_SIGNATURE", message: "正在等待 Wallet 签名。", advice: "不要重复提交同一操作。" },
    signature_rejected: { code: "SIGNATURE_REJECTED", message: "交易已取消或 Wallet 签名被拒绝。", advice: "未广播交易；核对 Preview 后可手动重新请求。" },
    generating_transaction: { code: "GENERATING_TRANSACTION", message: "正在生成 Wallet 交易请求。", advice: "请保持此页面打开，不要重复提交。" },
    broadcasting: { code: "BROADCASTING", message: "Wallet 正在广播交易。", advice: "不要重复签名或重复广播。" },
    pending: { code: "PENDING", message: "交易已提交，等待 Testnet 索引或确认。", advice: "不要重复提交同一操作。", indexStatus: "not_indexed_yet" },
    accepted: { code: "ACCEPTED", message: "交易已被节点接受，仍需等待 Confirmed 与 Mapping 核验。", advice: "继续轮询，不要重新提交。" },
    confirmed: { code: "CONFIRMED", message: "交易已 Confirmed。", advice: "继续核验预期 Public Mapping 状态。", indexStatus: "found" },
    rejected: { code: "REJECTED", message: "交易已被 Testnet 明确拒绝。", advice: "检查公开 rejection summary 与 Mapping 前置状态后再创建新 Preview。" },
    failed: { code: "WALLET_REQUEST_FAILED", message: "Shield 未能完成这笔交易。", advice: "确认钱包已解锁、处于 Aleo Testnet 且拥有足够的 Public Credits 支付交易费；刷新后重新生成 Preview。系统不会自动重签或广播。" },
    timeout: { code: "POLL_TIMEOUT", message: "在限定时间内未获得交易确认。", advice: "稍后使用公开 Transaction ID 继续查询；不要立即重新提交。", indexStatus: "not_found_after_timeout" },
  };
  return { state, ...defaults[state], ...overrides };
}

export function classifyWalletTransactionFailure(error: unknown): PublicTransactionFeedback {
  const diagnostic = diagnoseShieldWalletTransactionError(error);
  if (diagnostic.issue === "SignatureRejected") return transactionFeedback("signature_rejected");
  if (diagnostic.issue === "NetworkMismatch") return transactionFeedback("wrong_network");
  if (diagnostic.issue === "WalletDisconnected") return transactionFeedback("wallet_disconnected");
  if (diagnostic.issue === "WalletLocked") {
    return transactionFeedback("failed", {
      code: "WALLET_LOCKED",
      message: diagnostic.message,
      advice: "解锁 Shield 后重新生成 Preview，并手动发起一次新的签名请求。",
    });
  }
  if (diagnostic.issue === "PopupUnavailable") {
    return transactionFeedback("failed", {
      code: "WALLET_POPUP_UNAVAILABLE",
      message: diagnostic.message,
      advice: "允许本站打开 Shield 弹窗，再重新生成 Preview 并请求签名。",
    });
  }
  return transactionFeedback("failed");
}

export function sanitizeRejectionSummary(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "No public rejection summary was provided.";
  return value.replace(/(?:APrivateKey|AViewKey|sign1)[0-9A-Za-z_-]+/g, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function classifyPublicTransactionLookup(lookup: PublicTransactionLookup): PublicTransactionFeedback {
  if (lookup.httpStatus === 404) return transactionFeedback("pending", { indexStatus: "not_indexed_yet" });
  if (lookup.httpStatus === 405 || lookup.httpStatus === 501) {
    return transactionFeedback("pending", { code: "TRANSACTION_ENDPOINT_UNSUPPORTED", message: "Transaction endpoint 暂不支持单笔索引查询。", advice: "使用主 Transaction 或公开 Mapping 继续核验；不要将 HTTP 404/501 视为 rejected。", indexStatus: "endpoint_not_supported" });
  }
  if (lookup.httpStatus < 200 || lookup.httpStatus >= 300) {
    return transactionFeedback("pending", { code: "TRANSACTION_LOOKUP_UNAVAILABLE", message: "Transaction 状态查询暂不可用。", advice: "系统会在限定次数内重试；不要重复广播。", indexStatus: "http_error" });
  }
  const status = (lookup.status ?? "").toLowerCase();
  if (status === "rejected" || status === "aborted" || status === "failed") return transactionFeedback("rejected", { rejectionSummary: sanitizeRejectionSummary(lookup.rejectionReason) });
  if (status === "confirmed" || status === "finalized") return transactionFeedback("confirmed");
  if (status === "accepted") return transactionFeedback("accepted");
  return transactionFeedback("pending", { indexStatus: "not_indexed_yet" });
}

function defaultSleep(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    if (!signal) return;
    const onAbort = () => { clearTimeout(timer); reject(new DOMException("Polling cancelled", "AbortError")); };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function pollPublicTransaction(options: PollingOptions): Promise<PublicTransactionFeedback> {
  const attempts = options.maxAttempts ?? DEFAULT_POLL_ATTEMPTS;
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const sleep = options.sleep ?? defaultSleep;
  let latest = transactionFeedback("pending");
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (options.signal?.aborted) throw new DOMException("Polling cancelled", "AbortError");
    try { latest = classifyPublicTransactionLookup(await options.lookup(attempt)); }
    catch { latest = transactionFeedback("pending", { code: "TRANSACTION_LOOKUP_UNAVAILABLE", message: "Transaction 状态查询暂不可用。", advice: "系统会在限定次数内重试；不要重复广播。", indexStatus: "http_error" }); }
    options.onUpdate?.(latest);
    if (["confirmed", "rejected"].includes(latest.state)) return latest;
    if (attempt < attempts) await sleep(intervalMs, options.signal);
  }
  const timeout = transactionFeedback("timeout", { indexStatus: latest.indexStatus === "not_indexed_yet" ? "not_found_after_timeout" : latest.indexStatus });
  options.onUpdate?.(timeout);
  return timeout;
}
