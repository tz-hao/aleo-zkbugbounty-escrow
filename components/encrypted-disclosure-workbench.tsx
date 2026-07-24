"use client";

import { Download, KeyRound, LockKeyhole, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useState, type ChangeEvent } from "react";

import {
  decryptDisclosureReport,
  encryptDisclosureReport,
  exportDisclosureKeyBundle,
  exportDisclosurePublicKey,
  generateDisclosureRecipientKeys,
  parseEncryptedDisclosurePackage,
  type EncryptedDisclosurePackage,
} from "@/lib/encrypted-disclosure";
import type { BugClaim } from "@/lib/models";
import { canShareEncryptedDetails } from "@/lib/permissions";
import { useAppState } from "./app-state-provider";

function downloadJson(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readJsonFile(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return null;
  if (file.size > 1_000_000) throw new Error("JSON package exceeds the 1 MB local limit");
  return file.text();
}

export function EncryptedDisclosureWorkbench({ claim }: { claim: BugClaim }) {
  const { state, dispatch } = useAppState();
  const actor = state.currentActor;
  const [publicKeyJson, setPublicKeyJson] = useState("");
  const [decryptionKeyJson, setDecryptionKeyJson] = useState("");
  const [recipientPublicKeyInput, setRecipientPublicKeyInput] = useState("");
  const [report, setReport] = useState("");
  const [encryptedPackage, setEncryptedPackage] = useState<EncryptedDisclosurePackage | null>(null);
  const [packageInput, setPackageInput] = useState("");
  const [decryptionKeyInput, setDecryptionKeyInput] = useState("");
  const [decryptedReport, setDecryptedReport] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  if (actor.role !== "ProjectOwner" && actor.role !== "Whitehat") return null;

  async function generateOwnerKeys() {
    setBusy(true);
    setFeedback("");
    try {
      const keys = await generateDisclosureRecipientKeys();
      setPublicKeyJson(exportDisclosurePublicKey(keys));
      setDecryptionKeyJson(exportDisclosureKeyBundle(keys));
      setFeedback("披露密钥已在当前设备生成，未写入 Store 或浏览器存储。");
    } catch {
      setFeedback("当前浏览器无法生成披露密钥。");
    } finally {
      setBusy(false);
    }
  }

  async function encryptReport() {
    setBusy(true);
    setFeedback("");
    try {
      const packageValue = await encryptDisclosureReport({
        claimId: claim.id,
        plaintext: report,
        recipient: recipientPublicKeyInput,
      });
      setEncryptedPackage(packageValue);
      setReport("");
      setRecipientPublicKeyInput("");
      setFeedback("Ciphertext Package 已在本地生成。请导出并通过外部安全通道交付。");
    } catch {
      setEncryptedPackage(null);
      setFeedback("本地加密失败，请检查 Owner Public Key 与报告内容。");
    } finally {
      setBusy(false);
    }
  }

  function attestDelivery() {
    if (!encryptedPackage || !canShareEncryptedDetails(actor, claim)) return;
    dispatch({
      type: "shareEncryptedDetails",
      claimId: claim.id,
      attestation: {
        packageHash: encryptedPackage.packageHash,
        recipientKeyId: encryptedPackage.recipientKeyId,
      },
    });
    setEncryptedPackage(null);
    setFeedback("仅 Package Hash、Recipient Key ID 与公开状态已登记；Ciphertext 未进入 Store。");
  }

  async function decryptPackage() {
    setBusy(true);
    setDecryptedReport("");
    setFeedback("");
    try {
      const packageValue = parseEncryptedDisclosurePackage(packageInput);
      if (packageValue.claimId !== claim.id) throw new Error("Claim mismatch");
      const plaintext = await decryptDisclosureReport({
        package: packageValue,
        recipientKeys: decryptionKeyInput,
      });
      setDecryptedReport(plaintext);
      setPackageInput("");
      setDecryptionKeyInput("");
      setFeedback("Integrity Check 通过。解密内容仅存在于当前组件内存中。");
    } catch {
      setFeedback("解密失败：Package 被修改、Claim 不匹配，或 Disclosure Decryption Key 错误。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 border-t border-white/10 pt-4" aria-labelledby={`encrypted-disclosure-${claim.id}`}>
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 shrink-0 text-cyan-200" size={18} aria-hidden="true" />
        <div>
          <h3 id={`encrypted-disclosure-${claim.id}`} className="font-semibold text-white">
            Encrypted Disclosure · Device Only
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            明文与 Disclosure Decryption Key 不上传、不持久化；云端 Ciphertext Delivery 尚未配置。
          </p>
        </div>
      </div>

      {actor.role === "ProjectOwner" ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button className="focus-ring secondary-action" disabled={busy} onClick={() => void generateOwnerKeys()} type="button">
              <KeyRound size={16} aria-hidden="true" />
              生成披露密钥
            </button>
            {publicKeyJson ? (
              <button className="focus-ring secondary-action" onClick={() => downloadJson(`zkbb-${claim.id}-owner-public-key.json`, publicKeyJson)} type="button">
                <Download size={16} aria-hidden="true" />
                导出 Owner Public Key
              </button>
            ) : null}
            {decryptionKeyJson ? (
              <button className="focus-ring secondary-action border-amber-300/25 text-amber-100" onClick={() => downloadJson(`zkbb-${claim.id}-disclosure-decryption-key.json`, decryptionKeyJson)} type="button">
                <Download size={16} aria-hidden="true" />
                导出 Disclosure Decryption Key
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ImportField label="导入 Ciphertext Package" onLoad={setPackageInput} />
            <ImportField label="导入 Disclosure Decryption Key" onLoad={setDecryptionKeyInput} />
          </div>
          <button className="focus-ring primary-action w-fit" disabled={busy || !packageInput || !decryptionKeyInput} onClick={() => void decryptPackage()} type="button">
            <ShieldCheck size={16} aria-hidden="true" />
            Integrity Check + 本地解密
          </button>
          {decryptedReport ? (
            <div className="grid gap-2 border-l-2 border-emerald-300/40 pl-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-emerald-100">Decrypted · Memory Only</p>
                <button className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300" onClick={() => setDecryptedReport("")} type="button" title="清除解密内容" aria-label="清除解密内容">
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{decryptedReport}</pre>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3">
          <ImportField label="导入 Owner Public Key" onLoad={setRecipientPublicKeyInput} />
          <label className="grid gap-2 text-sm text-slate-300">
            私密披露报告（Memory Only）
            <textarea className="focus-ring input-surface min-h-32 rounded-lg px-3 py-3" value={report} onChange={(event) => setReport(event.target.value)} autoComplete="off" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="focus-ring primary-action" disabled={busy || !canShareEncryptedDetails(actor, claim) || !recipientPublicKeyInput || !report.trim()} onClick={() => void encryptReport()} type="button">
              <LockKeyhole size={16} aria-hidden="true" />
              本地加密
            </button>
            {encryptedPackage ? (
              <button className="focus-ring secondary-action" onClick={() => downloadJson(`zkbb-${claim.id}-ciphertext-package.json`, JSON.stringify(encryptedPackage, null, 2))} type="button">
                <Download size={16} aria-hidden="true" />
                导出 Ciphertext Package
              </button>
            ) : null}
            {encryptedPackage ? (
              <button className="focus-ring secondary-action border-emerald-300/25 text-emerald-100" onClick={attestDelivery} type="button">
                <ShieldCheck size={16} aria-hidden="true" />
                确认交付并登记 Hash
              </button>
            ) : null}
          </div>
          {!canShareEncryptedDetails(actor, claim) ? (
            <p className="text-xs text-amber-200/80">仅在 DetailsRequested 且 RewardLocked Demo 状态后开放本地加密交付。</p>
          ) : null}
        </div>
      )}
      <p className="min-h-5 text-sm text-emerald-200" aria-live="polite">{feedback}</p>
    </section>
  );
}

function ImportField({ label, onLoad }: { label: string; onLoad: (value: string) => void }) {
  const [error, setError] = useState("");
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      {label}
      <span className="focus-ring input-surface inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm">
        <Upload size={15} aria-hidden="true" />
        选择 JSON 文件
        <input
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            setError("");
            void readJsonFile(event)
              .then((value) => {
                if (value) onLoad(value);
              })
              .catch(() => setError("JSON 文件无法读取或超过限制。"));
          }}
        />
      </span>
      <span className="min-h-4 text-xs text-red-200">{error}</span>
    </label>
  );
}
