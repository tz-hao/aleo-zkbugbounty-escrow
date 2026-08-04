import Image from "next/image";

export function HeroProofVisual() {
  return (
    <figure className="home-hero-visual" aria-label="零知识漏洞披露协议入口视觉">
      <Image
        alt="由青色与紫色精密线框组成的零知识证明协议拱门"
        className="object-cover object-center"
        fill
        priority
        sizes="100vw"
        src="/images/zkbugbounty-protocol-portal.webp"
      />
      <div className="home-hero-image-wash" aria-hidden="true" />
      <figcaption className="sr-only">Private Witness 留在设备端，链上仅公开可验证结果。</figcaption>
    </figure>
  );
}
