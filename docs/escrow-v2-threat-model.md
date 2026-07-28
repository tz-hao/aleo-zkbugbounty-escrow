# Escrow v2 Threat Model

## 保护资产

- Bounty Owner 存入 Program 控制地址的公开 Credits
- Whitehat 的公开奖励权益
- Claim Receipt、Reporter、Triage 与 Payout Mapping 的一致性
- 未解决 Claim 计数与可退款余额
- Private Witness、Reporter Secret 和加密披露明文

## 信任与权限

- Bounty Owner：充值、锁奖、请求披露、标记修复、支付和退款
- Claim Reporter：只可为自己的 Claim 登记加密包 Hash
- 固定 Arbiter：可在允许阶段拒绝 Claim
- Public User：只读 Mapping
- Wallet：提供 `self.signer`；前端角色或 UI 状态不具备授权能力

## 核心不变量

1. 只有 protocol v2 Bounty/Claim 可进入 Escrow。
2. 支付路径只能是 `RewardLocked -> DetailsRequested -> EncryptedDetailsShared -> Patched -> Paid`。
3. Reward 由 Receipt Severity 与 Bounty 公开 tier 精确决定。
4. 收款地址必须等于 `claim_reporters[claim_hash]`。
5. `available + locked + paid + refunded == total_funded`，算术失败必须使 Final 整体失败。
6. 每个 Claim 只能进入一次 Paid 或 Rejected 终态，未解决计数只减少一次。
7. Refund 只允许关闭、过期、无未解决 Claim、无锁定金额的 v2 Bounty，并一次退回全部 available balance。
8. 八类经济/披露操作使用域分离、上下文绑定的派生 Marker 防重放。

## 攻击面与缓解

| 风险 | 缓解 |
|---|---|
| 给历史 v1 Bounty 充值导致资金锁死 | fund/release/refund 与 lock 均检查 protocol v2 |
| Owner 少付或多扣 | Final 从 Severity 计算 expected reward，并要求输入金额精确相等 |
| 伪造 Whitehat 地址 | 地址从 `claim_reporters` 读取并与 transition hint、Payout、Receipt 逐项核对；UI 无手填收款人 |
| 跳过披露阶段直接支付 | 每一步要求前一 `claim_triage_states.status`，release 只接受 Patched |
| Paid 后 Reject 或重复 Paid | Payout/Triage 终态不满足入口状态，且 Marker/未解决计数再次检查 |
| Rejected 后支付 | Rejected Payout 与 Triage 为终态；release 要求 Locked + Patched |
| 重放交易 | Marker 派生绑定 domain、bounty、claim、caller、recipient、amount 与 nonce，并在 Final 原子记为 used |
| 有效 Claim 存在时恶意退款 | Refund 要求 unresolved count 和 locked amount 都为零 |
| 部分退款后重复调用 | Refund 必须等于全部 available balance，完成后 escrow status 变为 Refunded |
| Credits 调用失败但 Mapping 显示成功 | transfer Final 与 Mapping writes 属于同一 Final；任一失败使状态不提交 |
| Endpoint 故障误开钱包操作 | Capability 同时核验 source 与 latest edition，失败即禁用 |
| UI 本地状态伪造 Paid | Real Mode 只读取 Confirmed Transaction 与公开 Mapping |
| 私密输入外泄 | Server proof API 返回 410；公开对象通过 privacy guards；无日志、URL 或持久化路径 |

## 剩余风险

- 固定 Arbiter 是中心化治理点，地址轮换需要后续 Upgrade。
- `release_reward` 因 Leo transition 在 Final 前不能读取 Mapping，必须接收 recipient/amount hint；Final 会从 Mapping 与公开 tier 重新核对，不能信任前端值。
- 本地 Leo 4.0.2 可编译 Credits 调用，但现有项目没有可执行的 devnet Mapping seed/E2E harness。
- 未完成真实 Credits E2E 前，无法证明运行时转账来源、余额变化与 Mapping 原子性。
- Program Upgrade 无链上 rollback，错误 edition 只能通过后续升级修复。
- 加密披露的跨设备 ciphertext delivery 仍依赖未配置的外部服务。

当前未发现已知 P0/P1 源码漏洞，但缺失真实 Credits E2E 是阻止 Upgrade Preview 的技术验收项。