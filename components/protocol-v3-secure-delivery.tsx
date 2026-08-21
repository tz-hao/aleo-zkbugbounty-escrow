"use client";

import { Download, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { useLocale } from "./locale-provider";
import {
  decryptDisclosureReport,
  deriveDisclosureKeyCommitment,
  encryptDisclosureReport,
  exportDisclosureKeyBundle,
  exportDisclosurePublicKey,
  generateDisclosureRecipientKeys,
  parseEncryptedDisclosurePackage,
  type DisclosureRecipientKeyBundle,
  type EncryptedDisclosurePackage,
  verifyProtocolDisclosureBinding,
} from "@/lib/encrypted-disclosure";

type ArbiterPackage = {
  address: string;
  packageValue: EncryptedDisclosurePackage;
};

type ProtocolV3SecureDeliveryProps = {
  claimHash: string;
  disclosureKeyCommitment: string;
  reportCommitment: string;
  disputeCommitment: string | null;
  state: string;
  ownerAddress: string;
  whitehatAddress: string;
  arbiters: readonly string[];
  connectedAddress: string | null;
  onPrepareDelivery: () => void;
  onPrepareAcknowledgement: () => void;
};

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function DownloadPackage({ filename, packageValue }: { filename: string; packageValue: EncryptedDisclosurePackage }) {
  const { text } = useLocale();
  return (
    <button
      className="secondary-action"
      type="button"
      onClick={() => downloadJson(filename, packageValue)}
    >
      <Download size={15} aria-hidden="true" />
      {text("下载密文包", "Download ciphertext package")}
    </button>
  );
}

/**
 * Keeps every private report, private key and ciphertext package in component
 * memory only. The chain receives only the pre-existing Aleo field commitment.
 */
export function ProtocolV3SecureDelivery({
  claimHash,
  disclosureKeyCommitment,
  reportCommitment,
  disputeCommitment,
  state,
  ownerAddress,
  whitehatAddress,
  arbiters,
  connectedAddress,
  onPrepareDelivery,
  onPrepareAcknowledgement,
}: ProtocolV3SecureDeliveryProps) {
  const { text } = useLocale();
  const [ownerKeys, setOwnerKeys] = useState<DisclosureRecipientKeyBundle | null>(null);
  const [recipientPublicKey, setRecipientPublicKey] = useState("");
  const [report, setReport] = useState("");
  const [reportPackage, setReportPackage] = useState<EncryptedDisclosurePackage | null>(null);
  const [packageInput, setPackageInput] = useState("");
  const [decryptionKeyInput, setDecryptionKeyInput] = useState("");
  const [decryptedReport, setDecryptedReport] = useState("");
  const [arbiterPublicKeys, setArbiterPublicKeys] = useState<Record<string, string>>({});
  const [arbitrationEvidence, setArbitrationEvidence] = useState("");
  const [arbiterPackages, setArbiterPackages] = useState<ArbiterPackage[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isOwner = connectedAddress === ownerAddress;
  const isWhitehat = connectedAddress === whitehatAddress;
  const isPanelMember = connectedAddress !== null && arbiters.includes(connectedAddress);
  const canDeliver = isWhitehat && state === "RewardLocked";
  const canAcknowledge = isOwner && state === "DisclosureDelivered";
  const canShareArbitrationEvidence = (isOwner || isWhitehat) && Boolean(disputeCommitment);
  const canDecrypt = isOwner || isPanelMember;

  async function createOwnerKeys() {
    setBusy(true);
    setFeedback(null);
    try {
      const keys = await generateDisclosureRecipientKeys();
      setOwnerKeys(keys);
      setFeedback(text(
        "密钥已在本机生成。立即下载私钥包；它不会上传、持久化或写入链上。创建赏金时必须将该公钥对应的 Aleo 披露承诺登记到链上。",
        "Keys were generated locally. Download the private bundle now; it is never uploaded, persisted, or put on-chain. The matching Aleo disclosure commitment must be registered when the Bounty is created.",
      ));
    } catch {
      setFeedback(text("本地生成披露密钥失败。", "Could not generate local disclosure keys."));
    } finally {
      setBusy(false);
    }
  }

  async function encryptForOwner() {
    setBusy(true);
    setFeedback(null);
    try {
      const packageValue = await encryptDisclosureReport({
        claimId: claimHash,
        plaintext: report,
        recipient: recipientPublicKey,
        protocolCommitment: reportCommitment,
      });
      const recipientCommitment = await deriveDisclosureKeyCommitment(recipientPublicKey);
      if (recipientCommitment !== disclosureKeyCommitment) {
        throw new Error("Project disclosure public key does not match the immutable on-chain key commitment");
      }
      if (!await verifyProtocolDisclosureBinding(
        packageValue,
        { claimId: claimHash, protocolCommitment: reportCommitment },
      )) {
        throw new Error("Package binding did not verify");
      }
      setReportPackage(packageValue);
      setReport("");
      setFeedback(text(
        "密文包已在本地生成，并已绑定当前 Claim Hash 与链上报告承诺。请下载后经约定的安全通道交付，再登记链上交付。",
        "The ciphertext package was generated locally and bound to this Claim Hash and on-chain report commitment. Download it, deliver it through the agreed secure channel, then record delivery on-chain.",
      ));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : text("本地加密失败。", "Local encryption failed."));
    } finally {
      setBusy(false);
    }
  }

  async function decryptAndVerify() {
    setBusy(true);
    setFeedback(null);
    try {
      const packageValue = parseEncryptedDisclosurePackage(packageInput);
      const recipientCommitment = await deriveDisclosureKeyCommitment(decryptionKeyInput);
      if (recipientCommitment !== disclosureKeyCommitment) {
        throw new Error("Local disclosure key does not match the immutable on-chain key commitment");
      }
      const matches = await verifyProtocolDisclosureBinding(
        packageValue,
        { claimId: claimHash, protocolCommitment: reportCommitment },
      );
      if (!matches) throw new Error("Ciphertext package does not match the public Claim Hash and report commitment");
      const plaintext = await decryptDisclosureReport({
        package: packageValue,
        recipientKeys: decryptionKeyInput,
      });
      setDecryptedReport(plaintext);
      setFeedback(text(
        "完整性、Claim Hash 与报告承诺均已本地核验。可确认收到；解密内容仅保留在当前页面内存中。",
        "Integrity, Claim Hash, and report commitment all verified locally. You may acknowledge delivery; plaintext remains only in this page's memory.",
      ));
    } catch (error) {
      setDecryptedReport("");
      setFeedback(error instanceof Error ? error.message : text("无法验证或解密密文包。", "Could not verify or decrypt the ciphertext package."));
    } finally {
      setBusy(false);
    }
  }

  async function encryptForArbiters() {
    if (!disputeCommitment) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (arbiters.some((address) => !arbiterPublicKeys[address]?.trim())) {
        throw new Error("A separate public key package is required for each immutable panel member");
      }
      const packages = await Promise.all(arbiters.map(async (address) => {
        const packageValue = await encryptDisclosureReport({
          claimId: claimHash,
          plaintext: arbitrationEvidence,
          recipient: arbiterPublicKeys[address],
          protocolCommitment: disputeCommitment,
        });
        const matches = await verifyProtocolDisclosureBinding(
          packageValue,
          { claimId: claimHash, protocolCommitment: disputeCommitment },
        );
        if (!matches) throw new Error("Arbitration evidence binding did not verify");
        return { address, packageValue };
      }));
      setArbiterPackages(packages);
      setArbitrationEvidence("");
      setFeedback(text(
        "已分别为三个不可变仲裁员生成密文包。请按地址分别交付，任何包都不应公开或复用给其他接收方。",
        "Separate ciphertext packages were generated for the three immutable panel members. Deliver each package only to its listed address; never publish or reuse a package for another recipient.",
      ));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : text("仲裁证据加密失败。", "Arbitration evidence encryption failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-4" aria-labelledby="v3-secure-delivery-title">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 text-cyan-200" size={18} aria-hidden="true" />
        <div>
          <h3 id="v3-secure-delivery-title" className="text-sm font-semibold text-white">
            {text("V3 本地加密交付与仲裁取证", "V3 local encrypted delivery and arbitration evidence")}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {text(
              "报告、密钥和密文只存在于当前浏览器内存或由你下载的文件中。链上只接收已提交的 field 承诺，不会接收漏洞明文。",
              "Reports, keys, and ciphertext stay only in this browser's memory or files you download. The chain receives only the already-submitted field commitment, never vulnerability plaintext.",
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ReadonlyField label={text("Claim Hash", "Claim Hash")} value={claimHash} />
        <ReadonlyField label={text("披露公钥承诺", "Disclosure key commitment")} value={disclosureKeyCommitment} />
        <ReadonlyField label={text("链上报告承诺", "On-chain report commitment")} value={reportCommitment} />
      </div>

      {isOwner ? (
        <details className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
          <summary className="focus-ring cursor-pointer text-sm font-semibold text-slate-200">
            <span className="inline-flex items-center gap-2"><KeyRound size={15} aria-hidden="true" />{text("项目方披露密钥管理", "Project disclosure key management")}</span>
          </summary>
          <p className="mt-3 text-xs leading-5 text-amber-100/80">
            {text(
              "仅为未来 Bounty 生成密钥。已创建 Bounty 的披露公钥承诺不可修改，必须使用创建时登记的公钥包。",
              "Generate keys only for future Bounties. An existing Bounty's disclosure-key commitment is immutable; use the public key package registered when it was created.",
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="secondary-action" type="button" disabled={busy} onClick={() => void createOwnerKeys()}>
              <KeyRound size={15} aria-hidden="true" />
              {text("本地生成密钥", "Generate local keys")}
            </button>
            {ownerKeys ? (
              <>
                <button className="secondary-action" type="button" onClick={() => downloadJson("zkbb-v3-disclosure-public-key.json", JSON.parse(exportDisclosurePublicKey(ownerKeys)))}>
                  <Download size={15} aria-hidden="true" />
                  {text("下载公钥包", "Download public key")}
                </button>
                <button className="secondary-action border-amber-300/25 text-amber-100" type="button" onClick={() => downloadJson("zkbb-v3-disclosure-private-key.json", JSON.parse(exportDisclosureKeyBundle(ownerKeys)))}>
                  <Download size={15} aria-hidden="true" />
                  {text("下载私钥包", "Download private key")}
                </button>
              </>
            ) : null}
          </div>
        </details>
      ) : null}

      {canDeliver ? (
        <div className="mt-4 grid gap-3 rounded-md border border-white/10 bg-black/20 p-3">
          <h4 className="text-sm font-semibold text-white">{text("白帽：生成并交付密文报告", "Whitehat: generate and deliver ciphertext report")}</h4>
          <label className="grid gap-2 text-xs text-slate-400">
            {text("项目方披露公钥包（JSON）", "Project disclosure public key package (JSON)")}
            <textarea className="input-surface focus-ring min-h-24 rounded-md p-3 font-mono text-xs" value={recipientPublicKey} onChange={(event) => setRecipientPublicKey(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <label className="grid gap-2 text-xs text-slate-400">
            {text("私密漏洞报告", "Private vulnerability report")}
            <textarea className="input-surface focus-ring min-h-32 rounded-md p-3 text-sm" value={report} onChange={(event) => setReport(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="primary-action" type="button" disabled={busy || !recipientPublicKey.trim() || !report.trim()} onClick={() => void encryptForOwner()}>
              <LockKeyhole size={15} aria-hidden="true" />
              {text("本地加密并验证绑定", "Encrypt locally and verify binding")}
            </button>
            {reportPackage ? <DownloadPackage filename={`zkbb-${claimHash}-owner-ciphertext.json`} packageValue={reportPackage} /> : null}
            {reportPackage ? (
              <button className="secondary-action" type="button" disabled={busy} onClick={onPrepareDelivery}>
                <ShieldCheck size={15} aria-hidden="true" />
                {text("准备链上交付登记", "Prepare on-chain delivery record")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canDecrypt ? (
        <details className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
          <summary className="focus-ring cursor-pointer text-sm font-semibold text-slate-200">
            {text("接收方：本地校验并解密密文包", "Recipient: verify and decrypt a ciphertext package locally")}
          </summary>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-2 text-xs text-slate-400">
              {text("密文包（JSON）", "Ciphertext package (JSON)")}
              <textarea className="input-surface focus-ring min-h-24 rounded-md p-3 font-mono text-xs" value={packageInput} onChange={(event) => setPackageInput(event.target.value)} autoComplete="off" spellCheck={false} />
            </label>
            <label className="grid gap-2 text-xs text-slate-400">
              {text("本地私钥包（JSON）", "Local private key bundle (JSON)")}
              <textarea className="input-surface focus-ring min-h-24 rounded-md p-3 font-mono text-xs" value={decryptionKeyInput} onChange={(event) => setDecryptionKeyInput(event.target.value)} autoComplete="off" spellCheck={false} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="primary-action" type="button" disabled={busy || !packageInput.trim() || !decryptionKeyInput.trim()} onClick={() => void decryptAndVerify()}>
                <ShieldCheck size={15} aria-hidden="true" />
                {text("校验绑定并本地解密", "Verify binding and decrypt locally")}
              </button>
              {canAcknowledge && decryptedReport ? (
                <button className="secondary-action" type="button" disabled={busy} onClick={onPrepareAcknowledgement}>
                  {text("准备链上接收确认", "Prepare on-chain acknowledgement")}
                </button>
              ) : null}
              {decryptedReport ? <button className="secondary-action" type="button" onClick={() => setDecryptedReport("")}>{text("清除明文", "Clear plaintext")}</button> : null}
            </div>
            {decryptedReport ? <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-amber-300/20 bg-black/30 p-3 text-sm leading-6 text-amber-50">{decryptedReport}</pre> : null}
          </div>
        </details>
      ) : null}

      {canShareArbitrationEvidence && disputeCommitment ? (
        <details className="mt-4 rounded-md border border-violet-300/20 bg-violet-300/[0.04] p-3">
          <summary className="focus-ring cursor-pointer text-sm font-semibold text-violet-100">
            {text("争议中：分别为仲裁员生成证据包", "During dispute: generate separate evidence packages for panel members")}
          </summary>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            {text("此处使用当前争议承诺绑定密文。每位仲裁员必须获得单独包；链上只记录争议承诺和投票，不记录密文。", "These ciphertexts are bound to the active dispute commitment. Each panel member must receive a separate package; the chain stores only the dispute commitment and votes, never ciphertext.")}
          </p>
          <label className="mt-3 grid gap-2 text-xs text-slate-400">
            {text("私密仲裁证据", "Private arbitration evidence")}
            <textarea className="input-surface focus-ring min-h-28 rounded-md p-3 text-sm" value={arbitrationEvidence} onChange={(event) => setArbitrationEvidence(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <div className="mt-3 grid gap-3">
            {arbiters.map((address) => (
              <label className="grid gap-2 text-xs text-slate-400" key={address}>
                {text("仲裁员公钥包", "Panel member public key package")} · <span className="font-mono text-slate-500">{address}</span>
                <textarea className="input-surface focus-ring min-h-20 rounded-md p-3 font-mono text-xs" value={arbiterPublicKeys[address] ?? ""} onChange={(event) => setArbiterPublicKeys((current) => ({ ...current, [address]: event.target.value }))} autoComplete="off" spellCheck={false} />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="secondary-action" type="button" disabled={busy || !arbitrationEvidence.trim()} onClick={() => void encryptForArbiters()}>
              <LockKeyhole size={15} aria-hidden="true" />
              {text("生成三个独立密文包", "Generate three independent ciphertext packages")}
            </button>
            {arbiterPackages.map(({ address, packageValue }) => (
              <DownloadPackage key={address} filename={`zkbb-${claimHash}-${address.slice(0, 12)}-arbitration-ciphertext.json`} packageValue={packageValue} />
            ))}
          </div>
        </details>
      ) : null}

      {feedback ? <p className="mt-4 text-xs leading-5 text-slate-300">{feedback}</p> : null}
    </section>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-cyan-100">{value}</p>
    </div>
  );
}
