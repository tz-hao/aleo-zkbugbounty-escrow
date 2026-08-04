import type { Role } from "../models.ts";

export const glossary = {
  bounty: "漏洞赏金（Bounty）",
  projectOwner: "项目方（Project Owner）",
  whitehat: "白帽研究员（Whitehat）",
  triageArbiter: "分诊仲裁者（Triage Arbiter）",
  publicUser: "公开用户（Public User）",
  privateProof: "隐私证明（Private Proof）",
  privateWitness: "私有见证数据（Private Witness）",
  witnessCommitment: "见证承诺（Witness Commitment）",
  bugClaim: "漏洞声明（Bug Claim）",
  claimReceipt: "声明收据（Claim Receipt）",
  nullifier: "防重复标识（Nullifier）",
  invariant: "安全不变量（Invariant）",
  responsibleDisclosure: "负责任披露（Responsible Disclosure）",
} as const;

export const roleDisplayLabels: Record<Role, string> = {
  ProjectOwner: glossary.projectOwner,
  Whitehat: glossary.whitehat,
  TriageArbiter: glossary.triageArbiter,
  PublicUser: glossary.publicUser,
};
