# zkBugBounty

zkBugBounty lets whitehats prove a bug exists without leaking the exploit.

zkBugBounty 是运行在 Aleo Testnet 上的隐私漏洞披露协议原型。当前链上 Program `zkbugbounty_7f3c92.aleo` 为 edition `0`，已验收 Wallet-signed Bounty、Claim Receipt、Nullifier Registry 与重复 Nullifier 拒绝。

## 当前边界

- Proof 证明的是 DemoVault 数学不变量，不是任意真实合约 State Root 漏洞证明。
- Private Witness 只在设备内存与 Wallet 执行边界内使用，不进入 API、store、URL、日志或公开 Mapping。
- `/api/aleo/prove` 保持 HTTP `410`，Real Mode 不回退 Mock 或 localStorage。
- Escrow v2 是目标 edition `1` 的 Upgrade Candidate，尚未广播；线上 Wallet Escrow/Triage Actions 必须保持禁用。
- v1 Bounty 与 Claim 继续只读，不参与 v2 Credits Escrow。

## Escrow v2 Candidate

候选版本新增真实 Credits 充值、严格披露状态机、Severity 奖励绑定、Reporter 绑定、未解决 Claim 计数、一次性退款和八类上下文绑定 Marker。现有 v1 structs、mappings 与 public entry signatures 保持不变。

当前候选已通过 Node 测试、ESLint、Next.js build 与 Leo 4.0.2 build。Leo 4.0.2 的 `leo test` 无法在 `@test fn` 中注入外部 Mapping 或执行 Final，因此真实 devnet Credits E2E 尚未完成，候选状态为 `BLOCKED_TECHNICAL_VALIDATION`，不得进入 Upgrade Preview。

## 验证

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd run leo:build
```

## 审计资料

- [Upgrade compatibility](docs/escrow-v2-upgrade-compatibility.md)
- [Threat model](docs/escrow-v2-threat-model.md)
- [Test matrix](docs/escrow-v2-test-matrix.md)
- [Migration limitations](docs/escrow-v2-migration-limitations.md)