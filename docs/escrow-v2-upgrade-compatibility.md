# Escrow v2 Upgrade Compatibility

## 结论

- Program ID：`zkbugbounty_7f3c92.aleo`
- 当前链上 edition：`0`
- 候选目标 edition：`1`
- 广播状态：未广播
- Source compatibility：通过
- Runtime Credits acceptance：`COMPLETED_LOCAL_DEVNODE`
- Upgrade Preview：允许仅打印、不广播的 `leo upgrade --print`

## Public Preview 摘要

- Preview：通过，仅 `leo upgrade --print`，未广播。
- Preview Transaction ID：`at14av4ja5q9j4pzt9dtzshju0z6pcqs3jw0fuxnvjenkvek4y9xuqs7gw6vk`
- Estimated fee：`38.166340 credits`
- 完整 Preview JSON、owner signature 与 verifying keys 未保存到仓库。

## 保持不变的 v1 边界

以下 structs 字段、顺序和类型保持不变：

- `BountyState`
- `ClaimReceiptState`
- `ProofResult`

以下 mappings 保持不变：

- `bounties: field => BountyState`
- `nullifiers: field => field`
- `claim_receipts: field => ClaimReceiptState`

以下 public entry signatures 保持不变：

- `prove_vault_invariant_break`
- `submit_claim`
- `create_bounty`
- `pause_bounty`
- `close_bounty`

Program 不包含 record，因此不存在 record schema 迁移。

## 新增 v2 边界

新增 structs：

- `BountyEscrowState`
- `ClaimPayoutState`
- `ClaimTriageState`

新增 mappings：

- `bounty_escrows`
- `claim_payouts`
- `bounty_claim_counts`
- `claim_reporters`
- `claim_triage_states`
- `bounty_protocol_versions`
- `escrow_operation_markers`

新增 functions：

- `fund_bounty`（fail-closed legacy compatibility boundary）
- `lock_reward`（fail-closed legacy compatibility boundary）
- `release_reward`（fail-closed legacy compatibility boundary）
- `refund_bounty`（fail-closed legacy compatibility boundary）
- `submit_claim_v2`
- `fund_bounty_v2`
- `lock_reward_v2`
- `request_disclosure`
- `attest_encrypted_details`
- `mark_patched`
- `release_reward_v2`
- `reject_claim`
- `refund_bounty_v2`

## 版本隔离

`create_bounty` 在升级后创建的 Bounty 写入 `bounty_protocol_versions = 2u8`。链上 edition 0 的 `submit_claim` 保留原有 ABI 与 v1 Receipt 语义；`submit_claim_v2` 才读取协议版本并只接受 `2u8`。历史 Bounty 缺少该 Mapping 时继续通过旧入口保持可读，不能意外进入 v2 Escrow 状态。

`fund_bounty_v2`、`lock_reward_v2`、`release_reward_v2` 与 `refund_bounty_v2` 均要求 protocol v2。历史同名经济入口仅为 Upgrade ABI 兼容而保留，并在任何 Credits 调用前 fail-closed。

升级后新建 Bounty 的 Low reward 必须为 `0u64`；Critical、High、Medium 仍按公开 tier 递减且 Medium 必须大于零。该变化不修改 `create_bounty` ABI，但会拒绝旧客户端提交的非零 Low reward。

## Capability Gate

前端只有在以下公开证据同时成立时才启用 Wallet Actions：

1. Program source 包含全部八个新增 function；
2. Program source 包含全部七个新增 mapping；
3. `latest_edition >= 1`；
4. source 与 edition 证据一致。

Endpoint 不可用、Program ID 不匹配、edition 无效或证据不一致时，Wallet Actions 保持禁用，不回退 Mock。

## 兼容风险

- Aleo Mapping 不支持批量迁移；v1 数据不会自动回填 v2 version、escrow 或 triage 状态。
- `bounty_claim_counts` 表示未解决 Claim 数，不是历史累计总数。
- v2 Marker Mapping 使用派生 operation marker；原始 nonce 只作为 public input，不等于 Mapping key。
- Upgrade 不提供链上 rollback。若 edition 1 行为有误，只能继续升级修复，不能恢复 edition 0 状态。
- 真实 Credits transfer、Mapping 原子性、replay protection 和 Credits conservation 已在 fresh-ledger Local Devnode 完成 E2E 验收；当前可进入无广播 Upgrade Preview，但仍不得广播 Testnet upgrade。
