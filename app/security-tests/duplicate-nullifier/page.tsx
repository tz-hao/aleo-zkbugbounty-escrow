"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CopyCheck,
  LoaderCircle,
  ShieldAlert,
  Trash2,
  WalletCards,
} from "lucide-react";

import { useAleoWallet } from "@/components/aleo-wallet-provider";
import { useLocale } from "@/components/locale-provider";
import { getChineseProtocolValue } from "@/lib/i18n/zh";
import {
  buildDuplicateNullifierPublicPreview,
  describeDuplicateNullifierAbi,
  DUPLICATE_NULLIFIER_TEST_BOUNDARY,
  DUPLICATE_NULLIFIER_TEST_TIMEOUT_MS,
  expectedClaimCountAfterFirst,
  expectedClaimCountAfterRejectedDuplicate,
  zeroControlledDuplicateInputs,
  type ControlledDuplicateNullifierVector,
  type DuplicateNullifierLifecycle,
  type DuplicateNullifierPublicPreview,
} from "@/lib/duplicate-nullifier-test";

const EXPECTED_BOUNTY_ID =
  "257640041950318553814753415615134947371field";
const EXPECTED_SCOPE_HASH =
  "165263616045655158386888829934414575403field";
const EXPECTED_RULE = "1field";
const EXPECTED_DEADLINE = 18_145_243;
const DEFAULT_BASELINE_COUNT = 1;

declare global {
  interface Window {
    __zkbbLoadDuplicateNullifierVector?: (vector: ControlledDuplicateNullifierVector) => void;
  }
}

export default function DuplicateNullifierSecurityTestPage() {
  const { text } = useLocale();
  const wallet = useAleoWallet();
  const vectorRef = useRef<ControlledDuplicateNullifierVector | null>(null);
  const [lifecycle, setLifecycle] = useState<DuplicateNullifierLifecycle>("EMPTY");
  const [preview, setPreview] = useState<DuplicateNullifierPublicPreview | null>(null);
  const [baselineCount, setBaselineCount] = useState(DEFAULT_BASELINE_COUNT);
  const [firstWalletRequestId, setFirstWalletRequestId] = useState("");
  const [firstTransactionId, setFirstTransactionId] = useState("");
  const [duplicateWalletRequestId, setDuplicateWalletRequestId] = useState("");
  const [duplicateTransactionId, setDuplicateTransactionId] = useState("");
  const [sealedVectorText, setSealedVectorText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const abi = useMemo(() => describeDuplicateNullifierAbi(), []);
  const expectedAfterFirst = expectedClaimCountAfterFirst(baselineCount);
  const expectedAfterDuplicate = expectedClaimCountAfterRejectedDuplicate(baselineCount);
  const connected = wallet.connectionState === "Connected" && Boolean(wallet.address);
  const firstRequestAllowed = connected && preview && lifecycle === "GENERATED";
  const duplicateRequestAllowed = connected && preview && lifecycle === "DUPLICATE_READY";

  function clearDuplicateTestWitness(nextState: DuplicateNullifierLifecycle = "CLEARED") {
    zeroControlledDuplicateInputs(vectorRef.current);
    vectorRef.current = null;
    setSealedVectorText("");
    setLifecycle(nextState);
  }

  const loadControlledVector = useCallback((vector: ControlledDuplicateNullifierVector) => {
      setError("");
      setMessage("");
      const nextPreview = buildDuplicateNullifierPublicPreview({
        ...vector,
        inputs: [...vector.inputs],
      });
      if (
        nextPreview.bountyId !== EXPECTED_BOUNTY_ID ||
        nextPreview.scopeHash !== EXPECTED_SCOPE_HASH ||
        nextPreview.rule !== EXPECTED_RULE
      ) {
        throw new Error("Controlled vector does not match the active Testnet bounty");
      }
      zeroControlledDuplicateInputs(vectorRef.current);
      vectorRef.current = {
        ...vector,
        inputs: [...vector.inputs],
      };
      setPreview(nextPreview);
      setLifecycle("GENERATED");
      setSealedVectorText("");
      setMessage(text("受控测试向量已加载。页面只显示公开字段，完整输入仅留在当前页面内存。", "The controlled test vector is loaded. The page shows public fields only; full inputs remain in current-page memory."));
    }, [text]);

  useEffect(() => {
    const handleControlledMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data as
        | { type?: string; vector?: ControlledDuplicateNullifierVector }
        | null;
      if (payload?.type !== "zkbb:controlled-duplicate-vector" || !payload.vector) return;
      loadControlledVector(payload.vector);
    };

    window.__zkbbLoadDuplicateNullifierVector = loadControlledVector;
    window.addEventListener("message", handleControlledMessage);

    const clearOnExit = () => clearDuplicateTestWitness("CLEARED");
    window.addEventListener("pagehide", clearOnExit);
    window.addEventListener("beforeunload", clearOnExit);
    const timeout = window.setTimeout(clearOnExit, DUPLICATE_NULLIFIER_TEST_TIMEOUT_MS);

    return () => {
      delete window.__zkbbLoadDuplicateNullifierVector;
      window.removeEventListener("message", handleControlledMessage);
      window.removeEventListener("pagehide", clearOnExit);
      window.removeEventListener("beforeunload", clearOnExit);
      window.clearTimeout(timeout);
      clearOnExit();
    };
  }, [loadControlledVector]);

  useEffect(() => {
    if (lifecycle === "EMPTY" || lifecycle === "CLEARED") return;
    if (wallet.connectionState === "Disconnected" || wallet.connectionState === "NotInstalled") {
      const timeout = window.setTimeout(() => {
        clearDuplicateTestWitness("CLEARED");
        setMessage(text("钱包连接已断开，受控测试输入已清空。", "Wallet connection ended. Controlled test inputs were cleared."));
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [wallet.connectionState, lifecycle, text]);

  async function requestFirstClaim() {
    if (!preview || !vectorRef.current) return;
    setError("");
    setMessage("");
    setLifecycle("FIRST_SIGNING");
    try {
      const requestId = await wallet.submitControlledDuplicateClaimInputs({
        bountyId: preview.bountyId,
        feeMicrocredits: preview.feeMicrocredits,
        inputs: vectorRef.current.inputs,
      });
      setFirstWalletRequestId(requestId);
      setLifecycle("FIRST_SUBMITTED");
      setMessage(text("第一笔 submit_claim 已交给 Leo Wallet。请用公开交易编号完成链上验收。", "The first submit_claim was handed to Leo Wallet. Complete on-chain acceptance with its public Transaction ID."));
    } catch (caught) {
      clearDuplicateTestWitness("FAILED");
      setError(caught instanceof Error ? caught.message : text("第一笔钱包请求失败，受控输入已清空。", "The first wallet request failed. Controlled inputs were cleared."));
    }
  }

  function markFirstConfirmed() {
    if (!preview || !vectorRef.current || !firstTransactionId.trim()) {
      setError(text("需要填入第一笔真实交易编号后才能进入重复测试。", "Enter the first real Transaction ID before continuing to the duplicate test."));
      return;
    }
    setError("");
    setLifecycle("DUPLICATE_READY");
    setMessage(text("第一笔链上验收已由操作者确认；第二笔将复用完全相同的 16 项输入。", "The operator confirmed first-transaction acceptance. The second request will reuse the exact same 16 inputs."));
  }

  function importSealedVector() {
    try {
      const parsed = JSON.parse(sealedVectorText) as ControlledDuplicateNullifierVector;
      loadControlledVector(parsed);
    } catch {
      setSealedVectorText("");
      setError(text("受控测试向量格式无效，已清空导入框。", "The controlled test vector format is invalid. The import field was cleared."));
    }
  }

  async function requestDuplicateClaim() {
    if (!preview || !vectorRef.current) return;
    setError("");
    setMessage("");
    setLifecycle("DUPLICATE_SIGNING");
    try {
      const requestId = await wallet.submitControlledDuplicateClaimInputs({
        bountyId: preview.bountyId,
        feeMicrocredits: preview.feeMicrocredits,
        inputs: vectorRef.current.inputs,
      });
      setDuplicateWalletRequestId(requestId);
      setLifecycle("DUPLICATE_SUBMITTED");
      setMessage(text("重复防重复标识交易已交给 Leo Wallet。完成公开链上验收后必须清空本页。", "The duplicate-Nullifier transaction was handed to Leo Wallet. Clear this page after public on-chain acceptance."));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("第二笔钱包请求失败，受控输入已清空。", "The duplicate wallet request failed. Controlled inputs were cleared."));
    } finally {
      clearDuplicateTestWitness("CLEARED");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="surface-card-strong rounded-lg p-6">
        <p className="page-kicker">{text("安全测试 · Aleo 测试网", "Security Test · Aleo Testnet")}</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              {text("重复防重复标识受控拒绝测试", "Controlled Duplicate Nullifier rejection test")}
            </h1>
            <p className="muted-copy mt-3 max-w-3xl">
              {text("使用同一组纯演示金库测试输入发送两次 submit_claim，验证链上最终处理会拒绝重复防重复标识。", "Send the same DemoVault test inputs to submit_claim twice to verify that on-chain Final rejects the duplicate Nullifier.")}{" "}
              {text("此页不进入正式导航，不保存敏感输入。", "This page is outside normal navigation and never persists sensitive inputs.")}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-md border border-red-300/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100">
            <AlertTriangle size={15} aria-hidden="true" />
            {text("测试网费用警告", "Testnet Fee Warning")}
          </span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="surface-card rounded-lg p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="page-kicker">{text("受控测试边界", "Controlled Boundary")}</p>
              <h2 className="mt-2 text-lg font-semibold text-white">{text("链上安全验收状态", "On-chain security acceptance state")}</h2>
            </div>
            <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 font-mono text-xs text-cyan-100">
              {lifecycle}
            </span>
          </div>

          <dl className="mt-4 grid gap-3 text-sm">
            <Fact label={text("程序编号", "Program ID")} value={DUPLICATE_NULLIFIER_TEST_BOUNDARY.programId} />
            <Fact label={text("函数", "Function")} value={DUPLICATE_NULLIFIER_TEST_BOUNDARY.functionName} />
            <Fact label={text("网络", "Network")} value={text(getChineseProtocolValue(DUPLICATE_NULLIFIER_TEST_BOUNDARY.network), DUPLICATE_NULLIFIER_TEST_BOUNDARY.network)} />
            <Fact label={text("钱包地址", "Wallet Address")} value={wallet.address ?? text("未连接", "Not connected")} />
            <Fact label={text("赏金编号", "Bounty ID")} value={preview?.bountyId ?? EXPECTED_BOUNTY_ID} />
            <Fact label={text("范围哈希", "Scope Hash")} value={preview?.scopeHash ?? EXPECTED_SCOPE_HASH} />
            <Fact label={text("安全规则", "Rule")} value={preview?.rule ?? EXPECTED_RULE} />
            <Fact label={text("披露期限", "Deadline")} value={String(EXPECTED_DEADLINE)} />
          </dl>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-2 text-sm text-slate-300">
              Public Claim Count Baseline N
              <input
                className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
                min="0"
                type="number"
                value={baselineCount}
                onChange={(event) => setBaselineCount(Number(event.target.value))}
              />
            </label>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
              {text("第一笔交易被接受后应为 N+1：", "After the first accepted transaction, expected count is N+1: ")}{expectedAfterFirst}{text("。第二笔交易被拒绝后仍应为：", ". After the rejected duplicate, it remains: ")}
              {expectedAfterDuplicate}{text("。", ".")}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="focus-ring secondary-action"
              type="button"
              onClick={() => void wallet.connect()}
              disabled={wallet.connectionState === "Connecting" || connected}
            >
              <WalletCards size={16} aria-hidden="true" />
              {connected ? text("钱包已连接", "Wallet Connected") : text("连接白帽研究员钱包", "Connect Whitehat Wallet")}
            </button>
            <button
              className="focus-ring secondary-action"
              type="button"
              onClick={() => {
                clearDuplicateTestWitness("CLEARED");
                setMessage(text("受控测试输入已手动清空。", "Controlled test inputs were manually cleared."));
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              {text("清空测试输入", "Clear test inputs")}
            </button>
          </div>
        </div>

        <div className="surface-card rounded-lg p-5">
          <p className="page-kicker">{text("交易预览", "Transaction Preview")}</p>
          <h2 className="mt-2 text-lg font-semibold text-white">{text("公开输入预览", "Public input preview")}</h2>
          {preview ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Fact label={text("漏洞声明哈希", "Claim Hash")} value={preview.claimHash} />
              <Fact label={text("防重复标识", "Nullifier")} value={preview.nullifier} />
              <Fact label={text("见证承诺", "Witness Commitment")} value={preview.witnessCommitment} />
              <Fact label={text("报告人承诺", "Reporter Commitment")} value={preview.reporterCommitment} />
              <Fact label={text("严重程度", "Severity")} value={preview.severity} />
              <Fact label={text("交易费", "Fee")} value={`${preview.feeMicrocredits} microcredits`} />
              <Fact label={text("第一笔预期状态", "First Expected")} value={preview.expectedFirstStatus} />
              <Fact label={text("重复交易预期状态", "Duplicate Expected")} value={preview.expectedDuplicateStatus} />
            </dl>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-white/[0.025] p-5 text-sm leading-6 text-slate-400">
              {text("等待操作者注入受控测试向量。页面不会读取历史漏洞声明，也不会恢复已经清除的报告人秘密值。", "Waiting for the operator to inject a controlled test vector. The page never reads historical claims or restores a cleared reporter secret.")}
            </div>
          )}

          <div className="mt-5 rounded-lg border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            {text("第二笔交易预计会被测试网拒绝，但仍可能消耗测试网交易费。只有你本人可以在 Leo Wallet 中确认或取消。", "The second transaction is expected to be rejected by Testnet and may still consume a Testnet Fee. Only you can confirm or cancel it in Leo Wallet.")}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              className="focus-ring primary-action disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
              type="button"
              disabled={!firstRequestAllowed}
              onClick={() => void requestFirstClaim()}
            >
              {lifecycle === "FIRST_SIGNING" ? (
                <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
              ) : (
                <ShieldAlert size={16} aria-hidden="true" />
              )}
              {text("请求第一笔签名", "Request first signature")}
            </button>
            <button
              className="focus-ring primary-action border-red-300/40 bg-red-400/15 text-red-50 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
              type="button"
              disabled={!duplicateRequestAllowed}
              onClick={() => void requestDuplicateClaim()}
            >
              {lifecycle === "DUPLICATE_SIGNING" ? (
                <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
              ) : (
                <CopyCheck size={16} aria-hidden="true" />
              )}
              {text("请求重复签名", "Request duplicate signature")}
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.055] p-3">
              <label className="grid gap-2 text-sm text-slate-300">
                {text("一次性密封导入", "One-time sealed import")}
                <input
                  className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
                  value={sealedVectorText}
                  onChange={(event) => setSealedVectorText(event.target.value)}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button
                className="focus-ring secondary-action mt-3"
                type="button"
                disabled={!sealedVectorText}
                onClick={importSealedVector}
              >
                {text("导入受控测试向量", "Import controlled test vector")}
              </button>
            </div>
            <label className="grid gap-2 text-sm text-slate-300">
              第一笔 submit_claim 交易编号
              <input
                className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
                value={firstTransactionId}
                onChange={(event) => setFirstTransactionId(event.target.value)}
                placeholder="at1..."
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              className="focus-ring secondary-action w-fit"
              type="button"
              disabled={lifecycle !== "FIRST_SUBMITTED" && lifecycle !== "GENERATED"}
              onClick={markFirstConfirmed}
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              {text("已完成第一笔公开验收", "First public acceptance complete")}
            </button>
            <label className="grid gap-2 text-sm text-slate-300">
              重复 submit_claim 交易编号
              <input
                className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
                value={duplicateTransactionId}
                onChange={(event) => setDuplicateTransactionId(event.target.value)}
                placeholder="at1..."
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>

          {firstWalletRequestId || duplicateWalletRequestId ? (
            <dl className="mt-5 grid gap-3 border-t border-white/10 pt-4 text-sm">
              {firstWalletRequestId ? <Fact label={text("第一笔钱包请求编号", "First Wallet Request ID")} value={firstWalletRequestId} /> : null}
              {duplicateWalletRequestId ? <Fact label={text("重复交易钱包请求编号", "Duplicate Wallet Request ID")} value={duplicateWalletRequestId} /> : null}
            </dl>
          ) : null}

          {message ? <p className="mt-4 text-sm text-emerald-100">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}
        </div>
      </section>

      <section className="surface-card rounded-lg p-5">
        <p className="page-kicker">{text("16 项输入 ABI", "16-Input ABI")}</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {abi.map((input) => (
            <div
              key={input.index}
              className="rounded-md border border-white/10 bg-white/[0.025] p-3 text-xs"
            >
              <p className="font-mono text-slate-200">
                {input.index}. {input.name}
              </p>
              <p className="mt-1 text-slate-500">
                {input.mode} · {input.type}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-white/10 pb-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs text-slate-100">{value}</dd>
    </div>
  );
}
