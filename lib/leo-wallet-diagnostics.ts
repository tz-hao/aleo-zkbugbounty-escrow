export type LeoWalletEnvironment = "Missing" | "Incompatible" | "Ready";

export type LeoWalletConnectionIssue =
  | "WalletUnavailable"
  | "AuthorizationRejected"
  | "NetworkMismatch"
  | "PopupUnavailable"
  | "InvalidPublicAddress"
  | "Unknown";

export type LeoWalletConnectionDiagnostic = {
  issue: LeoWalletConnectionIssue;
  message: string;
};

export type LeoWalletTransactionIssue =
  | "WalletDisconnected"
  | "SignatureRejected"
  | "NetworkMismatch"
  | "WalletLocked"
  | "PopupUnavailable"
  | "Unknown";

export type LeoWalletTransactionDiagnostic = {
  issue: LeoWalletTransactionIssue;
  message: string;
};

type BrowserWithLeoWallet = {
  leoWallet?: unknown;
  leo?: unknown;
};

export function getInjectedLeoWallet(browserWindow: unknown): unknown {
  if (!browserWindow || typeof browserWindow !== "object") return null;
  const candidate = browserWindow as BrowserWithLeoWallet;
  return candidate.leoWallet ?? candidate.leo ?? null;
}

export function inspectLeoWalletProvider(provider: unknown): LeoWalletEnvironment {
  if (!provider) return "Missing";
  if (typeof provider !== "object") return "Incompatible";
  return typeof (provider as { connect?: unknown }).connect === "function"
    ? "Ready"
    : "Incompatible";
}

function collectErrorText(error: unknown): string {
  const fragments: string[] = [];
  let current = error;

  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (current instanceof Error) {
      fragments.push(current.name, current.message);
      current = (current as Error & { error?: unknown; cause?: unknown }).error ?? current.cause;
      continue;
    }
    if (typeof current === "object") {
      const record = current as { name?: unknown; message?: unknown; error?: unknown; cause?: unknown };
      if (typeof record.name === "string") fragments.push(record.name);
      if (typeof record.message === "string") fragments.push(record.message);
      current = record.error ?? record.cause;
      continue;
    }
    break;
  }

  return fragments.join(" ").toLowerCase();
}

export function diagnoseLeoWalletConnectionError(
  error: unknown,
): LeoWalletConnectionDiagnostic {
  const text = collectErrorText(error);

  if (text.includes("invalid_aleo_public_address") || text.includes("invalid public address")) {
    return {
      issue: "InvalidPublicAddress",
      message: "Leo Wallet 已响应，但返回的公开地址格式无效。请更新扩展并刷新页面后重试。",
    };
  }
  if (
    text.includes("reject") ||
    text.includes("denied") ||
    text.includes("declined") ||
    text.includes("cancel") ||
    text.includes("not authorized") ||
    text.includes("permission")
  ) {
    return {
      issue: "AuthorizationRejected",
      message: "Leo Wallet 授权被取消或拒绝。请在扩展的 Connected sites 中移除本站，再重新授权。",
    };
  }
  if (
    text.includes("invalidparamsaleowalleterror") ||
    text.includes("network") ||
    text.includes("testnet") ||
    text.includes("chain")
  ) {
    return {
      issue: "NetworkMismatch",
      message: "Leo Wallet 拒绝了 Aleo Testnet（testnetbeta）连接。请切换到 Testnet，刷新页面后重新授权。",
    };
  }
  if (
    text.includes("popup") ||
    text.includes("window blocked") ||
    text.includes("window closed") ||
    text.includes("timeout") ||
    text.includes("timed out")
  ) {
    return {
      issue: "PopupUnavailable",
      message: "Leo Wallet 授权窗口未打开或已关闭。请允许本站弹窗，并从连接按钮重新发起授权。",
    };
  }
  if (
    text.includes("not available") ||
    text.includes("not ready") ||
    text.includes("locked") ||
    text.includes("unavailable")
  ) {
    return {
      issue: "WalletUnavailable",
      message: "Leo Wallet 已安装但当前不可用。请先解锁扩展，保持扩展启用后再重试。",
    };
  }

  return {
    issue: "Unknown",
    message: "Leo Wallet 返回连接错误。请解锁扩展，并在 Connected sites 中移除本站后重新授权。",
  };
}

export function diagnoseLeoWalletTransactionError(
  error: unknown,
): LeoWalletTransactionDiagnostic {
  const text = collectErrorText(error);

  if (
    text.includes("network") ||
    text.includes("testnet") ||
    text.includes("chain") ||
    text.includes("invalidparamsaleowalleterror")
  ) {
    return {
      issue: "NetworkMismatch",
      message: "Leo Wallet 当前网络与 Aleo Testnet（testnetbeta）不一致。请切换网络并重新连接。",
    };
  }
  if (text.includes("locked") || text.includes("not ready") || text.includes("unavailable")) {
    return {
      issue: "WalletLocked",
      message: "Leo Wallet 当前不可用或尚未解锁。请解锁扩展后重新发起交易。",
    };
  }
  if (
    text.includes("reject") ||
    text.includes("denied") ||
    text.includes("declined") ||
    text.includes("cancel") ||
    text.includes("not authorized")
  ) {
    return {
      issue: "SignatureRejected",
      message: "Leo Wallet 签名请求已取消或拒绝；未产生已确认的链上交易。",
    };
  }
  if (
    text.includes("popup") ||
    text.includes("window blocked") ||
    text.includes("window closed") ||
    text.includes("timeout")
  ) {
    return {
      issue: "PopupUnavailable",
      message: "Leo Wallet 交易窗口未打开或已关闭。请允许本站弹窗后重试。",
    };
  }
  if (text.includes("connect leo wallet") || text.includes("disconnected")) {
    return {
      issue: "WalletDisconnected",
      message: "Leo Wallet 已断开。请在 Aleo Testnet 上重新连接后再发起交易。",
    };
  }
  return {
    issue: "Unknown",
    message: "Leo Wallet 未接受交易请求；未写入任何链上成功状态。",
  };
}
