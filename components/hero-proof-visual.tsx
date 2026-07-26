import Image from "next/image";
import { Fingerprint, LockKeyhole, ReceiptText } from "lucide-react";

const proofStages = [
  {
    icon: LockKeyhole,
    label: "Private input",
    detail: "Device only",
    tone: "text-cyan-100",
  },
  {
    icon: Fingerprint,
    label: "ZK proof",
    detail: "Wallet execution",
    tone: "text-violet-100",
  },
  {
    icon: ReceiptText,
    label: "Public receipt",
    detail: "Mapping verified",
    tone: "text-emerald-100",
  },
];

export function HeroProofVisual() {
  return (
    <figure
      className="proof-hero-visual min-h-[13rem] sm:min-h-[20rem]"
      aria-label="零知识证明边界视觉演示"
    >
      <Image
        alt="封闭输入经过零知识证明电路转换为公开验证节点的三维示意图"
        className="object-cover object-center"
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 48vw"
        src="/images/zk-proof-circuit-hero.png"
      />
      <div className="proof-hero-image-wash" aria-hidden="true" />

      <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-md border border-violet-300/20 bg-[#08090c]/72 px-3 py-2 text-xs font-semibold text-violet-100 backdrop-blur-md">
        <span className="proof-visual-pulse" aria-hidden="true" />
        ZK Proof Boundary
      </div>

      <div className="absolute inset-x-3 bottom-3 z-10 grid grid-cols-3 gap-2 sm:inset-x-4 sm:bottom-4">
        {proofStages.map(({ icon: Icon, label, detail, tone }, index) => (
          <div
            className="proof-visual-chip min-w-0"
            key={label}
            style={{ animationDelay: `${index * 620}ms` }}
          >
            <Icon className={`shrink-0 ${tone}`} size={15} aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-[0.68rem] font-semibold text-white sm:text-xs">{label}</p>
              <p className="hidden truncate font-mono text-[0.62rem] text-slate-400 sm:block">
                {detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      <figcaption className="sr-only">
        Private input 留在设备端，Wallet 执行 Proof Program，仅将 Receipt 与 Commitment 写入公开 Mapping。
      </figcaption>
    </figure>
  );
}
