# Escrow v2 Upgrade Compatibility

## 结论

- Program ID：`zkbugbounty_7f3c92.aleo`
- 当前链上 edition：`0`
- 候选目标 edition：`1`
- 广播状态：未广播
- Source compatibility：通过
- Runtime Credits acceptance：`BLOCKED_TECHNICAL_VALIDATION`
- Upgrade Preview：禁止生成

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

- `fund_bounty`
- `lock_reward`
- `request_disclosure`
- `attest_encrypted_details`
- `mark_patched`
- `release_reward`
- `reject_claim`
- `refund_bounty`

## 版本隔离

`create_bounty` 在升级后创建的 Bounty 写入 `bounty_protocol_versions = 2u8`。`submit_claim` 从该 Mapping 读取协议版本；历史 Bounty 缺少 Mapping 时使用 `1u8`，因此历史 Receipt 继续可读。

`fund_bounty`、`lock_reward`、`release_reward` 与 `refund_bounty` 均要求 protocol v2。历史 v1 Bounty/Claim 不能进入 Escrow，避免给无法结算的旧 Bounty 充值。

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
- 真实 Credits transfer 与 Mapping 原子性尚未在本地 devnet 完成 E2E 验收，因此当前不能进入 Upgrade Preview。