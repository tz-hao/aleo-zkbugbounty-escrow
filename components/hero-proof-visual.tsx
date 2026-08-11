"use client";

import Image from "next/image";

import { useLocale } from "@/components/locale-provider";

export function HeroProofVisual() {
  const { text } = useLocale();
  return (
    <figure className="home-hero-visual" aria-label={text("零知识漏洞披露协议入口视觉", "Zero-knowledge vulnerability disclosure protocol visual")}>
      <Image
        alt={text("由青色与紫色精密线框组成的零知识证明协议拱门", "A zero-knowledge protocol gateway built from precise cyan and violet linework")}
        className="object-cover object-center"
        fill
        priority
        sizes="100vw"
        src="/images/zkbugbounty-protocol-portal.webp"
      />
      <div className="home-hero-image-wash" aria-hidden="true" />
      <figcaption className="sr-only">{text("私有见证数据留在设备端，链上仅公开可验证结果。", "The Private Witness stays on-device; only a verifiable result is public on-chain.")}</figcaption>
    </figure>
  );
}
