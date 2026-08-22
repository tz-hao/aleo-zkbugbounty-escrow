import type { BountyStatus, DisclosureStatus, PayoutStatus, ProofStatus, Severity } from "../models.ts";
import { CANONICAL_ALEO_PROGRAM_ID } from "../aleo-program.ts";

export const zh = {
  common: {
    create: "创建",
    submit: "提交",
    cancel: "取消",
    confirm: "确认",
    loading: "处理中…",
    status: "状态",
    project: "项目",
    actions: "可执行操作",
    currentRole: "演示预览视角",
    liveDemo: "Aleo 测试网演示",
    protocolConsole: "测试网协议界面",
    notIssued: "尚未签发",
    unknown: "未知",
    pending: "待完成",
    skipToContent: "跳到主要内容",
  },
  brand: {
    englishSubtitle: "面向负责任披露的隐私漏洞证明协议",
    chineseSubtitle: "面向负责任披露的隐私漏洞证明协议",
    slogan: "zkBugBounty 让白帽研究员证明漏洞存在，而不泄露利用细节。",
    sloganZh: "证明漏洞存在，而不泄露利用细节",
  },
  navigation: {
    home: "首页",
    createBounty: "发布赏金",
    submitProof: "提交 ZK 证明",
    triage: "漏洞评审",
    publicClaims: "公开存证榜",
  },
  rules: {
    "vault-accounting-safety": {
      name: "金库记账安全",
      description: "金库必须始终保有足够余额覆盖全部索赔。",
    },
    "claims-vs-deposits": {
      name: "索赔与存款安全",
      description: "系统中的索赔总额不能超过存款总额。",
    },
    "reward-reserve-safety": {
      name: "奖励准备金安全",
      description: "预留奖励总额不能超过金库实际余额。",
    },
    "withdraw-limit-safety": {
      name: "提款限额安全",
      description: "用户提款金额不能超过提款限额或可用余额。",
    },
  },
  privacy: {
    privateWitnessTemporary: "私有见证数据仅在当前设备内存中临时存在，不会持久化。",
    publicMetadataBoundary: "公开元数据不包含私有见证数据、报告人秘密值、隐藏变化量、利用路径或概念验证。",
    aiBoundary: "人工智能只能读取公开元数据，无法访问私有见证数据或利用细节。",
    exploitHidden: "利用细节已隐藏",
    witnessNeverStored: "私有见证数据从未保存",
    publiclyVerifiable: "证明的验证级别已明确标注",
  },
  home: {
    kicker: "零知识负责任披露协议",
    title: "证明漏洞，不泄露利用细节。",
    description: "zkBugBounty 运行于 Aleo 测试网。白帽研究员可以使用私有见证数据证明安全不变量被破坏，而无需公开利用路径、触发参数或完整概念验证。",
    createAction: "创建漏洞赏金",
    proofAction: "进入协议",
    trustSignals: ["利用细节始终密封", "收据标注验证级别", "注册表可公开审计"],
    deskTitle: "证明而不披露",
    deskLabel: "协议执行边界",
    verified: "本地模拟",
    metrics: ["进行中的赏金", "已验证的声明", "奖励池"],
    flowTitle: "核心披露流程",
    flowNote: "从已验证声明到释放赏金，所有状态严格按序推进。",
    protocolTitle: "公开协议层",
    protocolNote: "以下内容均可安全展示在演示注册表中。",
    rulesTitle: "多不变量演示金库",
    rulesDescription: "项目方可使用预设安全规则定义赏金范围；白帽研究员使用私有见证数据证明规则被破坏，公开侧只会得到公开元数据。",
  },
  createBounty: {
    kicker: "项目方",
    title: "创建漏洞赏金",
    description: "选择安全规则，设置漏洞范围与奖励档位。",
    fields: {
      projectName: "项目名称",
      deadline: "披露期限",
      scope: "漏洞范围",
      rule: "安全规则",
      ruleName: "规则名称",
      affectedModule: "受影响模块",
      description: "规则说明",
      pool: "赏金总额",
    },
    submit: "创建漏洞赏金",
    forbidden: "当前演示预览视角不能创建本地漏洞赏金。",
  },
  submit: {
    kicker: "白帽研究员",
    title: "提交隐私证明",
    description: "验证链上漏洞赏金，在设备端生成证明，并请求钱包签名。",
    forbidden: "当前演示预览视角不能提交本地隐私证明。",
    selectBounty: "选择漏洞赏金",
    selectEngine: "选择证明引擎",
    capability: "证明引擎能力",
    rule: "当前安全规则",
    bugType: "漏洞类型（可选公开标签）",
    generate: "生成证明",
    publish: "提交漏洞声明",
    generating: "正在生成 Aleo 证明…",
    noBounty: "请先选择进行中的漏洞赏金。",
    onlyVerified: "只有已验证的证明可以发布。",
    capabilities: {
      mock: "模拟不变量引擎支持演示金库的全部四条安全规则。",
      aleo: `${CANONICAL_ALEO_PROGRAM_ID} 支持全部四条安全规则；仅在本机、WSL 或远程 Leo 证明器可用时启用。`,
      aleoUnsupported: "当前环境没有可用的 Leo 证明器，Aleo 模式不会生成回退的已验证证明。",
    },
  },
  proofPanel: {
    title: "证明引擎控制台",
    publicOnly: "仅输出公开结果",
    ready: "证明已验证，可以提交公开漏洞声明",
    notReady: "尚未生成可提交的已验证声明",
    rejected: "证明验证失败",
    waiting: "等待私有输入",
  },
  triage: {
    kicker: "漏洞分诊",
    title: "漏洞分诊与负责任披露",
    description: "核验公开声明，推进加密披露、复现、修复和可审计结算。",
    roleNotice: "本页角色仅用于本地演示；链上权限以钱包签名者和程序映射为准。",
    noAccessTitle: "公开用户无法访问漏洞分诊操作。",
    noAccessBody: "公开用户在本地流程中为只读；演示预览不代表钱包或链上权限。",
    noClaims: "当前演示预览视角没有可处理的漏洞声明。",
    sections: {
      summary: "已验证声明摘要",
      receipt: "证明收据",
      disclosure: "负责任披露流程",
      actions: "可执行操作",
      copilot: "分诊助手（本地策略）",
      audit: "披露包交付审计",
      timeline: "分诊时间线",
    },
    privacyNotice: "加密报告只会分享给项目方。利用细节不会出现在公开页面中。",
    workflow: {
      current: "当前阶段",
      next: "下一步操作",
      requiredRole: "所需角色",
      final: "流程已结束",
      none: "无需操作",
      terminalReason: "当前漏洞声明已进入终态，不能继续修改。",
      stages: {
        Pending: "等待验证",
        Invalid: "验证失败",
        Verified: "证明已验证",
        RewardLocked: "奖励已锁定（演示）",
        DetailsRequested: "已请求加密细节",
        EncryptedDetailsShared: "已记录外部加密分享",
        Patched: "漏洞已修复",
        Paid: "赏金已标记支付（演示）",
        Rejected: "漏洞声明已拒绝",
      } as Record<string, string>,
      actionLabels: {
        RewardLocked: "锁定奖励",
        DetailsRequested: "请求加密细节",
        EncryptedDetailsShared: "分享加密报告",
        Patched: "标记已修复",
        Paid: "释放赏金",
        Rejected: "拒绝漏洞声明",
        PublicNoteAdded: "添加公开备注",
      } as Record<string, string>,
    },
    actions: {
      lock: "锁定奖励",
      request: "请求加密细节",
      patched: "标记已修复",
      paid: "释放赏金",
      rejected: "拒绝漏洞声明",
      share: "分享加密报告",
      recommend: "建议严重程度",
      addNote: "添加公开备注",
      notePlaceholder: "添加不会泄露利用细节的公开分诊备注",
    },
    confirmFinal: "确认不可逆操作",
    confirmFinalBody: "该协议状态为终态，完成后不能修改。",
    publicNoActions: "公开用户没有漏洞分诊操作权限。",
    noTimeline: "暂无公开漏洞分诊记录。",
  },
  publicClaims: {
    kicker: "公开声明与存证中心",
    title: "公开漏洞存证记录 (Public Claims)",
    description: "链上公开存证仅记录零知识验证状态与完成凭证，绝不包含任何漏洞利用细节与敏感数据，全方位保障白帽黑客与项目方的隐私安全。",
    registryNotice: "公开注册表只展示协议收据与披露状态，不提供敏感披露内容或操作入口。",
    viewReceipt: "查看协议收据",
    noClaims: "当前没有可公开展示的已验证漏洞声明。",
  },
  receipt: {
    back: "返回公开漏洞声明",
    kicker: "协议收据",
    titleFallback: "已验证漏洞声明",
    description: "以下为本地演示收据，仅包含可公开审计的协议元数据，并明确显示验证级别。",
    fieldsTitle: "公开审计字段",
    notFoundTitle: "未找到漏洞声明收据",
    notFoundBody: "当前浏览器的公开演示状态中不存在该注册表键。",
    copy: "复制",
    copied: "已复制",
  },
  errors: {
    duplicateClaim: "检测到重复漏洞声明：该防重复标识已被使用。",
    invariantNotBroken: "证明验证失败：当前私有见证数据未能打破指定安全规则。",
    invalidInitialState: "初始状态不合法，无法生成有效证明。",
    leoFailed: "Aleo Leo 证明执行不可用，请配置本机、WSL 或远程 Leo 证明器，或切换到模拟不变量引擎。",
    genericProof: "证明生成失败，请检查输入后重试。",
    genericClaim: "漏洞声明提交失败，请重试。",
  },
  status: {
    proof: {
      Pending: "等待验证",
      Verified: "已验证",
      Invalid: "验证失败",
    } satisfies Record<ProofStatus, string>,
    disclosure: {
      NotRequested: "尚未请求披露",
      Requested: "已请求加密细节",
      EncryptedDetailsShared: "已记录外部加密分享",
      Patched: "已修复",
    } satisfies Record<DisclosureStatus, string>,
    payout: {
      Unfunded: "尚未锁定奖励",
      RewardLocked: "奖励已锁定（演示）",
      Paid: "已标记支付（演示）",
      Rejected: "已拒绝",
    } satisfies Record<PayoutStatus, string>,
    bounty: {
      Draft: "草稿",
      Active: "进行中",
      Paused: "已暂停",
      Closed: "已关闭",
    } satisfies Record<BountyStatus, string>,
    severity: {
      Critical: "严重",
      High: "高危",
      Medium: "中危",
      Low: "低危",
    } satisfies Record<Severity, string>,
  },
} as const;

export function getRuleDisplayName(ruleId: string, fallback: string) {
  return ruleId in zh.rules ? zh.rules[ruleId as keyof typeof zh.rules].name : fallback;
}

const chineseProtocolValues: Record<string, string> = {
  "Demo Vault": "演示金库",
  "ZK Bridge Relay": "ZK 跨链中继",
  "Vault accounting invariant breach": "金库记账不变量被破坏",
  "Vault Accounting Safety": "金库记账安全",
  "Claims vs Deposits Safety": "索赔与存款安全",
  "Reward Reserve Safety": "奖励准备金安全",
  "Withdrawal Limit Safety": "提款限额安全",
  "Vault accounting logic": "金库记账逻辑",
  "Claims accounting": "索赔记账逻辑",
  "Reward reserve logic": "奖励准备金逻辑",
  "Withdrawal logic": "提款逻辑",
  "Mock Invariant Engine": "模拟不变量引擎",
  "Aleo Leo Proof": "Aleo Leo 证明",
  "Aleo Leo Proof Placeholder": "Aleo Leo 证明占位引擎",
  "Verified Claim Receipt 已生成，可供 Project Owner 进行公开元数据审查。": "已生成经过验证的漏洞声明收据，可供项目方审查公开元数据。",
  "Reward lock demo state recorded.": "已记录本地演示奖励锁定状态。",
  "Encrypted disclosure details requested.": "已请求加密披露细节。",
  "Patch confirmed.": "已确认修复。",
  "Payout demo state recorded; no on-chain transfer was submitted.": "已记录本地演示支付状态；未提交链上转账。",
  "Claim rejected.": "漏洞声明已拒绝。",
  "Encrypted disclosure package hash and recipient attestation recorded. Payload remains off-store.": "已记录加密披露包哈希与接收方证明；载荷未进入状态仓库。",
  local: "本地",
  testnet: "Aleo 测试网",
  testnetbeta: "Aleo 测试网",
  unavailable: "暂不可用",
};

export function getChineseProtocolValue(value: string) {
  const severityRecommendation = /^Security Arbiter recommends severity: (Critical|High|Medium|Low)[.]$/.exec(value);
  if (severityRecommendation) {
    const labels = { Critical: "严重", High: "高危", Medium: "中危", Low: "低危" } as const;
    return `安全仲裁者建议严重程度：${labels[severityRecommendation[1] as keyof typeof labels]}。`;
  }
  return chineseProtocolValues[value] ?? value;
}
export function translateUiError(message: string) {
  if (message.includes("Duplicate claim detected")) return zh.errors.duplicateClaim;
  if (message.includes("Initial state is invalid")) return zh.errors.invalidInitialState;
  if (message.includes("was not broken")) return zh.errors.invariantNotBroken;
  if (message.includes("Leo proof execution failed") || message.includes("Leo execution is unavailable")) {
    return zh.errors.leoFailed;
  }
  return message;
}
