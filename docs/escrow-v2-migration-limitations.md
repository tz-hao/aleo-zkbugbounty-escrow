# Escrow v2 Migration Limitations

## v1 数据

- 历史 Bounty、Claim Receipt、Nullifier 继续从原 Mapping 读取。
- 历史 Bounty 缺少 `bounty_protocol_versions` 时按 v1 处理。
- v1 Bounty 不能 fund、lock、release 或 refund。
- v1 Claim 不会自动创建 Reporter、Payout、Triage 或 Escrow Mapping。
- 不提供历史 Bounty/Claim 的批量链上迁移。

## v2 数据

- 只有 Upgrade 后新建的 Bounty 自动写 protocol v2。
- 新 Bounty 的 Low reward 必须为零，Low Claim 不进入支付流程。
- `bounty_claim_counts` 是未解决 Claim 数；Paid 或 Rejected 各减少一次。
- Pre-lock Rejected Claim 写入 reward `0u64` 的 Rejected Payout，以保持公开状态一致。
- Refund 为一次性全额退回 available balance，不支持部分退款。

## Marker

- ABI 中的 marker 参数是 nonce。
- Program 以 domain、bounty、claim、caller、recipient、amount 与 nonce 派生实际 Mapping key。
- UI Preview 中的 marker input 不等于 `last_*_marker` 中保存的派生值。

## 部署与回滚

- 当前链上 edition 为 0，候选目标 edition 为 1。
- Upgrade 尚未广播，线上仍必须返回 ProgramUpgradeRequired。
- Aleo Program Upgrade 没有恢复到旧 edition 的 rollback 路径。
- 若 edition 1 产生错误，只能发布兼容的后续 edition；已有 Mapping 数据不能删除或改型。
- 在真实 devnet Credits E2E 完成前，不生成 Upgrade Preview、费率估算或广播命令。

## 非目标

- 当前 Proof 是 DemoVault 数学不变量证明，不是任意合约 State Root 证明。
- 不保存真实 exploit、PoC、Private Witness 或 Reporter Secret。
- 不提供跨设备密文托管；仅公开 package hash 与状态。