export type ShieldWalletEnvironment = "Missing" | "Incompatible" | "Ready";

export type ShieldWalletConnectionIssue =
  | "WalletUnavailable"
  | "AuthorizationRejected"
  | "NetworkMismatch"
  | "PopupUnavailable"
  | "InvalidPublicAddress"
  | "Unknown";

export type ShieldWalletConnectionDiagnostic = {
  issue: ShieldWalletConnectionIssue;
  message: string;
};

export type ShieldWalletTransactionIssue =
  | "WalletDisconnected"
  | "SignatureRejected"
  | "NetworkMismatch"
  | "WalletLocked"
  | "PopupUnavailable"
  | "Unknown";

export type ShieldWalletTransactionDiagnostic = {
  issue: ShieldWalletTransactionIssue;
  message: string;
};

type BrowserWithShieldWallet = {
  shield?: unknown;
};

export function getInjectedShieldWallet(browserWindow: unknown): unknown {
  if (!browserWindow || typeof browserWindow !== "object") return null;
  return (browserWindow as BrowserWithShieldWallet).shield ?? null;
}

export function inspectShieldWalletProvider(provider: unknown): ShieldWalletEnvironment {
  if (!provider) return "Missing";
  if (typeof provider !== "object") return "Incompatible";
  const candidate = provider as {
    connect?: unknown;
    executeTransaction?: unknown;
  };
  return typeof candidate.connect === "function" &&
    typeof candidate.executeTransaction === "function"
    ? "Ready"
    : "Incompatible";
}

function collectErrorText(error: unknown): string {
  const fragments: string[] = [];
  let current = error;

  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (current instanceof Error) {
      fragments.push(current.name, current.message);
      current = (current as Error & { cause?: unknown; error?: unknown }).cause ??
        (current as Error & { error?: unknown }).error;
      continue;
    }
    if (typeof current === "object") {
      const record = current as {
        name?: unknown;
        message?: unknown;
        cause?: unknown;
        error?: unknown;
      };
      if (typeof record.name === "string") fragments.push(record.name);
      if (typeof record.message === "string") fragments.push(record.message);
      current = record.cause ?? record.error;
      continue;
    }
    break;
  }

  return fragments.join(" ").toLowerCase();
}

export function diagnoseShieldWalletConnectionError(
  error: unknown,
): ShieldWalletConnectionDiagnostic {
  const text = collectErrorText(error);

  if (text.includes("invalid") && text.includes("address")) {
    return {
      issue: "InvalidPublicAddress",
      message: "Shield 已响应，但返回的公开地址格式无效。请更新扩展并刷新页面后重试。",
    };
  }
  if (/(reject|denied|declined|cancel|not authorized|permission)/.test(text)) {
    return {
      issue: "AuthorizationRejected",
      message: "Shield 授权被取消或拒绝。请在扩展中移除本站授权后重新连接。",
    };
  }
  if (/(network|testnet|chain)/.test(text)) {
    return {
      issue: "NetworkMismatch",
      message: "Shield 当前网络与 Aleo Testnet 不一致。请切换到 Testnet 后重新连接。",
    };
  }
  if (/(popup|window blocked|window closed|timeout|timed out)/.test(text)) {
    return {
      issue: "PopupUnavailable",
      message: "Shield 授权窗口未打开或已关闭。请允许本站弹窗后重新连接。",
    };
  }
  if (/(not available|not ready|locked|unavailable)/.test(text)) {
    return {
      issue: "WalletUnavailable",
      message: "Shield 已安装但当前不可用。请解锁扩展并刷新页面后重试。",
    };
  }
  return {
    issue: "Unknown",
    message: "Shield 返回连接错误。请解锁扩展，并重新授权本站。",
  };
}

export function diagnoseShieldWalletTransactionError(
  error: unknown,
): ShieldWalletTransactionDiagnostic {
  const text = collectErrorText(error);

  if (/(network|testnet|chain)/.test(text)) {
    return {
      issue: "NetworkMismatch",
      message: "Shield 当前网络与 Aleo Testnet 不一致。请切换网络并重新连接。",
    };
  }
  if (/(locked|not ready|unavailable)/.test(text)) {
    return {
      issue: "WalletLocked",
      message: "Shield 当前不可用或尚未解锁。请解锁扩展后重新发起交易。",
    };
  }
  if (/(reject|denied|declined|cancel|not authorized)/.test(text)) {
    return {
      issue: "SignatureRejected",
      message: "Shield 签名请求已取消或拒绝；未产生已确认的链上交易。",
    };
  }
  if (/(popup|window blocked|window closed|timeout)/.test(text)) {
    return {
      issue: "PopupUnavailable",
      message: "Shield 交易窗口未打开或已关闭。请允许本站弹窗后重试。",
    };
  }
  if (/(not connected|disconnected)/.test(text)) {
    return {
      issue: "WalletDisconnected",
      message: "Shield 已断开。请在 Aleo Testnet 上重新连接后再发起交易。",
    };
  }
  return {
    issue: "Unknown",
    message: "Shield 未接受交易请求；未写入任何链上成功状态。",
  };
}
