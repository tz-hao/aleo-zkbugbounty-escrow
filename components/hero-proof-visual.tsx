import Image from "next/image";

export function HeroProofVisual() {
  return (
    <figure className="home-hero-visual" aria-label="零知识证明电路视觉">
      <Image
        alt="封闭输入经过零知识证明电路转换为公开验证节点的三维示意图"
        className="object-cover object-center"
        fill
        priority
        sizes="100vw"
        src="/images/zk-proof-circuit-hero.png"
      />
      <div className="home-hero-image-wash" aria-hidden="true" />
      <figcaption className="sr-only">Private Witness 留在设备端，仅公开 Proof Receipt。</figcaption>
    </figure>
  );
}
