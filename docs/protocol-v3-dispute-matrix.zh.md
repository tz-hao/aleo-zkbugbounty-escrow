# Protocol V3 争议授权与结算矩阵

本文是 Protocol V3 的链上路由规范。它只记录公开的最小元数据；漏洞正文、PoC、加密报告和修复细节始终留在链下加密边界。

## 固定公开类型

| 代码 | 类型 | 公开含义 |
| --- | --- | --- |
| 1 | REJECTION | 项目方拒绝 Claim 的决定 |
| 2 | DUPLICATE | 项目方标记重复报告的决定 |
| 3 | SCOPE | 项目方标记超出范围的决定 |
| 4 | SEVERITY | 项目方评估的严重程度 |
| 5 | REPRODUCTION | 项目方记录无法复现 |
| 6 | REMEDIATION | 项目方提出的修复是否充分 |
| 7 | SLA_TIMEOUT | 一方在适用审核窗口内未推进状态 |

合约只接受 `1u8..7u8`。每次争议会由 `(bounty_id, claim_hash, round)` 派生独立 `dispute_id`，并在 `claim_v3_dispute_metadata` 固化 `bounty_id`、`claim_hash`、`dispute_type`、`dispute_commitment`、发起人、时间、请求等级和终局等级。`claim_v3_active_disputes` 指向当前轮次，`claim_v3_dispute_rounds` 记录下一轮；因此一个 Claim 结案后可在后续有效阶段再次进入争议。面板和门槛始终从不可变的 `bounty_v3_configs` 推导。

`dispute_commitment` 仍为隐私边界：它是证据/理由/文档的承诺，不含漏洞明文、PoC 或密文内容。

## Authorization Matrix

| 类型 | 触发状态与先前决定 | 谁可发起 | 不可发起者 | 合法裁决 | 结算效果 |
| --- | --- | --- | --- | --- | --- |
| REJECTION | `OwnerRejected(13)` + project decision `Rejection(2)` | Whitehat | Project、仲裁员、任意第三方 | `0` 或收据等级 | `0`：驳回、解锁奖励、保证金给项目方；收据等级：先锁对应奖励并退还保证金 |
| DUPLICATE | `OwnerRejected(13)` + `Duplicate(3)` | Whitehat | Project、仲裁员、任意第三方 | `0` 或收据等级 | 同 REJECTION；只有推翻“重复”才可进入付款流程 |
| SCOPE | `OwnerRejected(13)` + `OutOfScope(4)` | Whitehat | Project、仲裁员、任意第三方 | `0` 或收据等级 | 同 REJECTION；只有确认范围内才可进入付款流程 |
| SEVERITY | `Accepted(3)` 或 `OwnerRejected(13)` + `Severity(5)` | Whitehat | Project、仲裁员、任意第三方 | `0..receipt.severity` | 最终等级为 0 时驳回；非 0 时按最终等级锁款，随后按该等级结算，调用方不能替换等级 |
| REPRODUCTION | `ReproductionRejected(8)` + `CannotReproduce(6)` | Whitehat | Project、仲裁员、任意第三方 | `0` 或收据等级 | `0`：驳回、解锁、保证金给项目方；正向：复现即付模式直接付款并退还保证金，修复确认付款模式回到 `ReproductionConfirmed(7)` |
| REMEDIATION | `PatchProposed(9)` + `RemediationProposed(7)`，且修复审核窗口已过 | Project | Whitehat、仲裁员、任意第三方 | `0` 或收据等级 | `0`：回到 `ReproductionConfirmed(7)`，保证金给白帽；正向：进入 `PatchAccepted(10)`，保证金返还项目方，付款仍遵守付款条件；Edition 4 中若裁决期无 quorum，则默认按 `0` 回到 `ReproductionConfirmed`，不会永久锁死 |
| SLA_TIMEOUT | 白帽未在 `RewardLocked(4)` 交付，或项目方在 `Submitted(1)`、审核、披露、复现/修复阶段超出 `review_window_blocks` | 被对方拖延的一方 | 仲裁员、任意第三方 | `0` 或收据等级 | 白帽拖延：默认驳回并解锁；项目方拖延：面板可恢复锁款或在已锁款付款阶段按既有保留额结算 |

说明：SEVERITY 的 `requested_severity` 必须大于项目方已记录等级、且不超过收据等级。其它类型的 `requested_severity` 必须是 0。

## Settlement Matrix

| 类型 | 投票限制 | 门槛 | 终局入口 | 禁止路径 |
| --- | --- | --- | --- | --- |
| REJECTION / DUPLICATE / SCOPE | 仅 `0` 或收据等级 | Bounty 固定 2/3 或 3/3 | 正向：`finalize_arbitration_prelock_v3`；负向：`finalize_rejection_v3` | 不能用任意等级直接付款 |
| SEVERITY | `0..receipt.severity` | Bounty 固定 2/3 或 3/3 | 正向：`finalize_arbitration_prelock_v3`，再按 `final_severity` 付款；负向：`finalize_rejection_v3` | 不能由调用者传入任意金额或替换终局等级 |
| REPRODUCTION | 仅 `0` 或收据等级 | Bounty 固定 2/3 或 3/3 | 负向：`finalize_rejection_v3`；正向：`settle_reward_v3` 或先回到修复阶段 | 修复确认付款模式不得在复现裁决后提前付款 |
| REMEDIATION | 仅 `0` 或收据等级 | Bounty 固定 2/3 或 3/3；Edition 4 到期无 quorum 默认 `0` | `finalize_rejection_v3` 的 remediation 分支 | 不能直接走任意奖励转账，也不能在超时后永久停在 `Disputed` |
| SLA_TIMEOUT | 仅 `0` 或收据等级 | Bounty 固定 2/3 或 3/3 | 锁款前走 `finalize_arbitration_prelock_v3`，锁款后走 `settle_reward_v3` 或 `finalize_rejection_v3` | 不可绕过保留额或支付条件 |

每个投票键由 `(bounty_id, dispute_id, signer)` 推导；重复投票、非面板投票、复用操作 marker 均会被拒绝。所有 Credits Final 都先写状态、保证金和 marker，再执行 Credits 转账。锁款时的项目方等级决定保留额；锁款后任何付款必须严格等于该保留额。

## 发布边界

- Testnet 的 Edition 2 与 Edition 3 仅作历史证据；Edition 4 已公开核验并作为当前 V3 钱包能力依据。REMEDIATION timeout 规则已生效。
- Protocol V3 pre-candidate `a0434764669102ba636ac4cf07be377ddd0270a7` 在最终 E2E 覆盖审计中被作废：当时六类争议没有成为明确、可验证的链上状态。该提交从未部署到 Testnet。
- 本地 Devnode 验证不构成任何 Testnet Edition 升级授权。
