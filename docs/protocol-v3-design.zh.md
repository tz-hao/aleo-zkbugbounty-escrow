# zkBugBounty Protocol V3 设计与实现

## 目标

V3 将“白帽证明、公开收据、托管资金”升级为可审计的责任披露闭环。它不把零知识收据伪装成真实漏洞或修复结论：收据只作为项目方审核与奖励预留的前置资格。

## 当前状态

Testnet 的 Edition 2 与 Edition 3 是历史 V3 部署证据；当前 Testnet 已公开核验为 Edition 4。Edition 4 包含通用 SLA、可重复开启的争议轮次、项目方等级锁款、披露包承诺一致性、完整 Program SHA-256 校验，以及 REMEDIATION 争议在裁决期无 quorum 时回到 `ReproductionConfirmed` 的活性规则。Vercel 前端部署不替代合约升级，钱包写入仍必须通过公开 Edition、交易和源码哈希核验。

## 不可改变的隐私边界

- 链上不保存 Private Witness、漏洞利用、PoC、触发参数、解密私钥或报告明文。
- 项目方在创建赏金时公布专用披露公钥的 `field` 承诺，而不是钱包私钥。
- 白帽将报告加密给项目方；链上仅保存密文包哈希、接收方密钥承诺和交付时间。
- 发生争议时，白帽只向该赏金创建时锁定的仲裁面板成员重新加密分享报告。

## 公开收据的作用

收据能够确认：

- Claim 与 Bounty、Scope Hash、规则和报告钱包的链上归属；
- 私有输入满足已部署的证明电路；
- Claim Hash、Witness Commitment、Nullifier 和建议严重程度已写入链上。

收据不能确认：真实目标系统存在漏洞、报告是否重复或在范围内、能否复现、修复是否有效。因此它只能解锁 `OwnerReviewing` 和 `RewardLocked`，不能直接付款。

## Bounty 配置

每个 V3 Bounty 在创建时固定以下公开策略：

| 字段 | 作用 |
| --- | --- |
| `disclosure_key_commitment` | 项目方独立披露公钥的承诺：前端从规范化 ECDH 公钥的域分隔 SHA-256 前 31 字节导出非零 field；白帽加密和项目方解密前都会重新核对。 |
| `target_system_commitment` | 赏金目标系统承诺，Claim 必须与之匹配。 |
| `target_code_hash` | 被审核代码或版本的哈希边界，Claim 必须与之匹配。 |
| `panel_id` | 仲裁面板标识。 |
| `arbiter_one..three` | 三个不同且不能等于项目方的仲裁员 Aleo 地址。 |
| `quorum` | `2/3` 或 `3/3`，创建后不可修改。 |
| `review_window_blocks` | 项目方受理或提出结论的时限。 |
| `decision_window_blocks` | 争议进入面板投票后的时限。 |
| `payment_condition` | 复现确认付款，或白帽接受修复后付款。 |
| `arbitration_fee_microcredits` | 发起争议时实际转入合约的保证金；按裁决退给白帽或转给项目方。 |

这替代了 V2 中写死的 Program Admin。项目方不能在收到 Claim 后更换对自己有利的仲裁员；白帽提交前即可核对整套规则。

## 状态机

```text
Submitted
  -> OwnerReviewing
     -> Accepted -> RewardLocked
     -> OwnerRejected -> Disputed | Rejected
RewardLocked
  -> DisclosureDelivered -> DisclosureAcknowledged
  -> ReproductionConfirmed -> PatchProposed -> PatchAccepted -> Paid
  -> ReproductionRejected -> Disputed | Rejected

受 SLA 约束的拖延节点 -> Disputed
Disputed
  -> 面板接受/白帽胜出超时 -> RewardLocked 或 Paid
  -> 面板驳回/项目方胜出超时 -> Rejected
  -> REMEDIATION 无 quorum 超时 -> ReproductionConfirmed（奖励继续锁定，项目方可提交新修复）
```

所有状态均记录区块高度和操作承诺。`OwnerRejected` 和 `ReproductionRejected` 是可申诉状态，异议期届满才由任何人结算为终态 `Rejected`；`Paid` 与 `Rejected` 均不可再次推进。

## 角色权限

| 角色 | 可做操作 |
| --- | --- |
| 项目方 | 开始审核、受理或提出可申诉拒绝、单独锁款、签名确认收到密文、记录复现结论、提交修复承诺。 |
| 白帽 | 提交证明、交付密文、确认修复、对拒绝或项目方超时发起争议。 |
| 仲裁面板成员 | 只在 `Disputed` 时投票；每个成员对同一争议轮次只能投一次。 |
| 任何人 | 在已满足付款条件、仲裁门槛或 SLA 默认规则后触发锁款、付款或驳回结算。 |

仲裁结论只允许 `Reject`、维持建议等级或下调到赏金既有档位；不允许任意金额，也不允许高于电路输出的等级。

## 链上入口与映射

受 Leo 最多 31 个 Entry Function 限制，V3 将同一角色、同一阶段的动作合并为受限 action code。已经实现 13 个 V3 入口：

```text
create_bounty_v3
submit_claim_v3
fund_bounty_v3
review_claim_v3
lock_reward_v3
disclosure_action_v3
resolution_action_v3
dispute_claim_v3
cast_arbitration_vote_v3
settle_reward_v3
finalize_arbitration_prelock_v3
finalize_rejection_v3
refund_bounty_v3
```

`resolution_action_v3` 的 action 5 专门处理白帽在异议期内未申诉的项目方拒绝，不创建 Credits Final；`finalize_rejection_v3` 只处理已经缴纳保证金的仲裁驳回，并在所有成功路径执行保证金结算。

已经实现的 V3 映射：

```text
bounty_v3_configs
claim_v3_evidence
claim_v3_states
claim_v3_payouts
claim_v3_arbitration_tallies
claim_v3_arbitration_votes
v3_operation_markers
claim_v3_acknowledgements
claim_v3_dispute_bonds
claim_v3_project_decisions
claim_v3_dispute_metadata
claim_v3_dispute_rounds
claim_v3_active_disputes
```

V2 入口和历史映射保持只读兼容；不能把 V2 Claim 伪装为 V3 Claim。前端必须根据已部署 Program Edition 与 ABI 启用 V3 钱包操作，不可回退到浏览器状态。

## 真实目标绑定

V3 Claim 已绑定 Bounty 的目标系统承诺和目标代码哈希，并额外提交目标状态、执行记录和报告承诺。但当前 DemoVault 电路不会自行验证这些外部事实是否真实；生产化仍需接入可验证状态根、受认证测试执行记录或目标链执行证明。完成前，界面必须持续标记为 `DemoVault constraint proof`。

## 发布顺序

1. 在本地 Devnode 完成 V3 的所有正常与恶意路径测试。
2. 审核 Leo ABI 和 Credits 结算边界。
3. 当前公开 Edition 4 已通过升级交易、费用交易和完整 Program SHA-256 核验。
4. Edition 4 已完成 ABI、Credits、Devnode E2E 和无密钥 preview 后，由 Program Admin 使用 Testnet 钱包签名升级并支付手续费。
5. 已记录并独立验证 Edition 4 升级交易 ID、费用交易和完整 Program SHA-256；前端以 Edition 4 链上能力为准。
6. 部署 Vercel Preview 并完成钱包人工验收后，才可提升到 Production。

仅部署 Vercel 不会更新 Aleo Program；前端必须继续以链上探测结果为准，不可回退到浏览器状态。


## R2 争议模型更新

本设计的争议部分以 [V3 争议授权与结算矩阵](protocol-v3-dispute-matrix.zh.md) 为准。它取代本页早期“仅拒绝/超时”的简化描述。

新增的公开映射为：

```text
claim_v3_project_decisions
claim_v3_dispute_metadata
```

Edition 3 引入且 Edition 4 保持的 V3 专用公开映射总数为 13。项目方的 adverse decision、公开 dispute type、开立人、状态、请求等级与最终等级均成为可验证链上状态；每个 Claim 的 active dispute ID 与下一个轮次也可验证。`dispute_commitment` 保留为私有证据的承诺，不公开报告内容。Edition 4 不新增公共函数或 Mapping，只增加 REMEDIATION 到期无 quorum 的确定性默认结论。

对于 `payment_condition = OnPatchAcceptance`，REPRODUCTION 仲裁的正向结果只恢复到 `ReproductionConfirmed` 并继续修复流程；不会在修复确认前支付奖励。
