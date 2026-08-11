import type { Role } from "../models.ts";

export const glossary = {
  bounty: "漏洞赏金",
  projectOwner: "项目方",
  whitehat: "白帽研究员",
  triageArbiter: "分诊仲裁者",
  publicUser: "公开用户",
  privateProof: "隐私证明",
  privateWitness: "私有见证数据",
  witnessCommitment: "见证承诺",
  bugClaim: "漏洞声明",
  claimReceipt: "声明收据",
  nullifier: "防重复标识",
  invariant: "安全不变量",
  responsibleDisclosure: "负责任披露",
} as const;

export const roleDisplayLabels: Record<Role, string> = {
  ProjectOwner: glossary.projectOwner,
  Whitehat: glossary.whitehat,
  TriageArbiter: glossary.triageArbiter,
  PublicUser: glossary.publicUser,
};