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
      setMessage("受控测试向量已加载。页面只显示公开字段，完整输入仅留在当前页面内存。");
    }, []);

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
        setMessage("钱包连接已断开，受控测试输入已清空。");
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [wallet.connectionState, lifecycle]);

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
      setMessage("第一笔 submit_claim 已交给 Leo Wallet。请用公开 Transaction ID 完成链上验收。");
    } catch (caught) {
      clearDuplicateTestWitness("FAILED");
      setError(caught instanceof Error ? caught.message : "第一笔钱包请求失败，受控输入已清空。");
    }
  }

  function markFirstConfirmed() {
    if (!preview || !vectorRef.current || !firstTransactionId.trim()) {
      setError("需要填入第一笔真实 Transaction ID 后才能进入重复测试。");
      return;
    }
    setError("");
    setLifecycle("DUPLICATE_READY");
    setMessage("第一笔链上验收已由操作者确认；第二笔将复用完全相同的 16 项输入。");
  }

  function importSealedVector() {
    try {
      const parsed = JSON.parse(sealedVectorText) as ControlledDuplicateNullifierVector;
      loadControlledVector(parsed);
    } catch {
      setSealedVectorText("");
      setError("受控测试向量格式无效，已清空导入框。");
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
      setMessage("重复 Nullifier 交易已交给 Leo Wallet。完成公开链上验收后必须清空本页。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "第二笔钱包请求失败，受控输入已清空。");
    } finally {
      clearDuplicateTestWitness("CLEARED");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="surface-card-strong rounded-lg p-6">
        <p className="page-kicker">Security Test · Aleo Testnet</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              Duplicate Nullifier 受控拒绝测试
            </h1>
            <p className="muted-copy mt-3 max-w-3xl">
              用同一组纯 DemoVault 测试输入发送两次 submit_claim，验证链上 Final 会拒绝重复 Nullifier。
              此页不进入正式导航，不保存敏感输入。
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-md border border-red-300/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100">
            <AlertTriangle size={15} aria-hidden="true" />
            Testnet Fee Warning
          </span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="surface-card rounded-lg p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="page-kicker">Controlled Boundary</p>
              <h2 className="mt-2 text-lg font-semibold text-white">链上安全验收状态</h2>
            </div>
            <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 font-mono text-xs text-cyan-100">
              {lifecycle}
            </span>
          </div>

          <dl className="mt-4 grid gap-3 text-sm">
            <Fact label="Program ID" value={DUPLICATE_NULLIFIER_TEST_BOUNDARY.programId} />
            <Fact label="Function" value={DUPLICATE_NULLIFIER_TEST_BOUNDARY.functionName} />
            <Fact label="Network" value={DUPLICATE_NULLIFIER_TEST_BOUNDARY.network} />
            <Fact label="Wallet Address" value={wallet.address ?? "Not connected"} />
            <Fact label="Bounty ID" value={preview?.bountyId ?? EXPECTED_BOUNTY_ID} />
            <Fact label="Scope Hash" value={preview?.scopeHash ?? EXPECTED_SCOPE_HASH} />
            <Fact label="Rule" value={preview?.rule ?? EXPECTED_RULE} />
            <Fact label="Deadline" value={String(EXPECTED_DEADLINE)} />
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
              第一笔 accepted 后应为 N+1：{expectedAfterFirst}。第二笔 rejected 后仍应为：
              {expectedAfterDuplicate}。
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
              {connected ? "Wallet Connected" : "连接 Whitehat Wallet"}
            </button>
            <button
              className="focus-ring secondary-action"
              type="button"
              onClick={() => {
                clearDuplicateTestWitness("CLEARED");
                setMessage("受控测试输入已手动清空。");
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              清空测试输入
            </button>
          </div>
        </div>

        <div className="surface-card rounded-lg p-5">
          <p className="page-kicker">Transaction Preview</p>
          <h2 className="mt-2 text-lg font-semibold text-white">公开输入预览</h2>
          {preview ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Fact label="Claim Hash" value={preview.claimHash} />
              <Fact label="Nullifier" value={preview.nullifier} />
              <Fact label="Witness Commitment" value={preview.witnessCommitment} />
              <Fact label="Reporter Commitment" value={preview.reporterCommitment} />
              <Fact label="Severity" value={preview.severity} />
              <Fact label="Fee" value={`${preview.feeMicrocredits} microcredits`} />
              <Fact label="First Expected" value={preview.expectedFirstStatus} />
              <Fact label="Duplicate Expected" value={preview.expectedDuplicateStatus} />
            </dl>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-white/[0.025] p-5 text-sm leading-6 text-slate-400">
              等待操作者注入受控测试向量。页面不会读取历史 claim，也不会恢复已经清除的 reporter secret。
            </div>
          )}

          <div className="mt-5 rounded-lg border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            第二笔交易预计被 Testnet 拒绝，但仍可能消耗 Testnet Fee。只有你本人可以在 Leo Wallet 中确认或取消。
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
              请求第一笔签名
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
              请求重复签名
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.055] p-3">
              <label className="grid gap-2 text-sm text-slate-300">
                一次性密封导入
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
                导入受控测试向量
              </button>
            </div>
            <label className="grid gap-2 text-sm text-slate-300">
              First submit_claim Transaction ID
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
              已完成第一笔公开验收
            </button>
            <label className="grid gap-2 text-sm text-slate-300">
              Duplicate submit_claim Transaction ID
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
              {firstWalletRequestId ? <Fact label="First Wallet Request ID" value={firstWalletRequestId} /> : null}
              {duplicateWalletRequestId ? <Fact label="Duplicate Wallet Request ID" value={duplicateWalletRequestId} /> : null}
            </dl>
          ) : null}

          {message ? <p className="mt-4 text-sm text-emerald-100">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}
        </div>
      </section>

      <section className="surface-card rounded-lg p-5">
        <p className="page-kicker">16-Input ABI</p>
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
