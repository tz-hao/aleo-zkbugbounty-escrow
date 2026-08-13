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

合约只接受 `1u8..6u8`。每次争议在 `claim_v3_dispute_metadata` 固化 `bounty_id`、`claim_hash`、`dispute_type`、`dispute_commitment`、发起人、时间、请求等级和终局等级。映射只能首次写入；面板和门槛始终从不可变的 `bounty_v3_configs` 推导。

`dispute_commitment` 仍为隐私边界：它是证据/理由/文档的承诺，不含漏洞明文、PoC 或密文内容。

## Authorization Matrix

| 类型 | 触发状态与先前决定 | 谁可发起 | 不可发起者 | 合法裁决 | 结算效果 |
| --- | --- | --- | --- | --- | --- |
| REJECTION | `OwnerRejected(13)` + project decision `Rejection(2)` | Whitehat | Project、仲裁员、任意第三方 | `0` 或收据等级 | `0`：驳回、解锁奖励、保证金给项目方；收据等级：先锁对应奖励并退还保证金 |
| DUPLICATE | `OwnerRejected(13)` + `Duplicate(3)` | Whitehat | Project、仲裁员、任意第三方 | `0` 或收据等级 | 同 REJECTION；只有推翻“重复”才可进入付款流程 |
| SCOPE | `OwnerRejected(13)` + `OutOfScope(4)` | Whitehat | Project、仲裁员、任意第三方 | `0` 或收据等级 | 同 REJECTION；只有确认范围内才可进入付款流程 |
| SEVERITY | `Accepted(3)` 或 `OwnerRejected(13)` + `Severity(5)` | Whitehat | Project、仲裁员、任意第三方 | `0..receipt.severity` | 最终等级为 0 时驳回；非 0 时按最终等级锁款，随后按该等级结算，调用方不能替换等级 |
| REPRODUCTION | `ReproductionRejected(8)` + `CannotReproduce(6)` | Whitehat | Project、仲裁员、任意第三方 | `0` 或收据等级 | `0`：驳回、解锁、保证金给项目方；正向：复现即付模式直接付款并退还保证金，修复确认付款模式回到 `ReproductionConfirmed(7)` |
| REMEDIATION | `PatchProposed(9)` + `RemediationProposed(7)`，且修复审核窗口已过 | Project | Whitehat、仲裁员、任意第三方 | `0` 或收据等级 | `0`：回到 `ReproductionConfirmed(7)`，保证金给白帽；正向：进入 `PatchAccepted(10)`，保证金返还项目方，付款仍遵守付款条件 |

说明：SEVERITY 的 `requested_severity` 必须大于项目方已记录等级、且不超过收据等级。其它类型的 `requested_severity` 必须是 0。

## Settlement Matrix

| 类型 | 投票限制 | 门槛 | 终局入口 | 禁止路径 |
| --- | --- | --- | --- | --- |
| REJECTION / DUPLICATE / SCOPE | 仅 `0` 或收据等级 | Bounty 固定 2/3 或 3/3 | 正向：`finalize_arbitration_prelock_v3`；负向：`finalize_rejection_v3` | 不能用任意等级直接付款 |
| SEVERITY | `0..receipt.severity` | Bounty 固定 2/3 或 3/3 | 正向：`finalize_arbitration_prelock_v3`，再按 `final_severity` 付款；负向：`finalize_rejection_v3` | 不能由调用者传入任意金额或替换终局等级 |
| REPRODUCTION | 仅 `0` 或收据等级 | Bounty 固定 2/3 或 3/3 | 负向：`finalize_rejection_v3`；正向：`settle_reward_v3` 或先回到修复阶段 | 修复确认付款模式不得在复现裁决后提前付款 |
| REMEDIATION | 仅 `0` 或收据等级 | Bounty 固定 2/3 或 3/3 | `finalize_rejection_v3` 的 remediation 分支 | 不能直接走任意奖励转账 |

每个投票键由 `(bounty_id, claim_hash, signer)` 推导；重复投票、非面板投票、复用操作 marker 均会被拒绝。所有 Credits Final 都先写状态、保证金和 marker，再执行 Credits 转账。

## 发布边界

- Testnet 已确认 Program Edition 2；前端已记录公开升级证据，但每次钱包操作仍须同时验证当前 Edition、V3 ABI 与证据交易，任一失败即关闭 V3 能力。
- Protocol V3 pre-candidate `a0434764669102ba636ac4cf07be377ddd0270a7` 在最终 E2E 覆盖审计中被作废：当时六类争议没有成为明确、可验证的链上状态。该提交从未部署到 Testnet。
- 本地 Devnode 验证不构成 Testnet Edition 2 升级授权。
