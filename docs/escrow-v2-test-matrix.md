# Escrow v2 Test Matrix

## 当前结果

- Node tests：`215/215 passed`
- Leo 4.0.2 build：passed
- Program size：`29.47 KB / 500 KB`
- `leo test --offline`：编译通过，但输出 `No tests run`
- Real Credits E2E：`BLOCKED_TECHNICAL_VALIDATION`

Node 状态模型和源码断言用于回归保护，不等同于真实 Credits 验收。

## 功能矩阵

| 场景 | 覆盖 | 结果 |
|---|---|---|
| fund v2 active/paused Bounty | Leo guard + Builder/Node test | 通过 |
| fund v1 / expired / closed | Leo protocol/status/deadline guard + source test | 通过静态与模型验证 |
| duplicate funding marker | 派生 Marker Mapping guard | 通过源码验证 |
| lock exact Critical/High/Medium reward | Leo expected reward + ABI/model test | 通过 |
| lock Low / wrong amount / insufficient balance | Leo guard + model test | 通过 |
| lock wrong reporter / duplicate lock | Reporter Mapping + Payout/Triage absence checks | 通过 |
| request after RewardLocked | Triage status `1 -> 2` | 通过 |
| share before request / wrong reporter | Reporter signer + status `2` | 通过 |
| patch before share | status `3` + nonzero package hash | 通过 |
| release before patch / wrong recipient | Patched + reporter/payout equality | 通过 |
| duplicate release / reject paid | terminal status + Marker + count guards | 通过 |
| non-Arbiter reject | fixed signer check | 通过 |
| reject before lock | writes zero-value Rejected Payout + Rejected Triage | 通过 |
| duplicate reject | terminal triage + Marker + count guard | 通过 |
| refund active / before deadline / v1 | status/deadline/protocol guards | 通过 |
| refund with unresolved claim / locked amount | count + locked guards | 通过 |
| partial / duplicate refund | exact available amount + Refunded status | 通过 |
| New Claim count +1 | `submit_claim` Final | 通过源码验证 |
| Paid / Rejected count -1 | release/reject Final + model test | 通过 |
| mixed terminal Claims reaches zero | terminal accounting test | 通过模型验证 |
| eight operation Marker domains | domains 201-208 + eight atomic Mapping writes | 通过 |
| source + edition capability gate | public source/latest_edition tests | 通过 |
| private fields absent from API/UI/store | privacy suite | 通过 |

## 尚缺的真实 Credits E2E

仍需在隔离的本地 devnet 中验证：

1. Owner 初始 Credits；
2. fund 后 Owner 减少、Program 增加；
3. release 后 Program 减少、Whitehat 增加；
4. refund 后 Program 减少、Owner 增加；
5. Mapping 与 Credits 同步变化；
6. 每个 invalid path 被真实 Final 拒绝；
7. 总量守恒，Fee 单独核算。

当前 Leo 4.0.2 的 `@test fn` 不允许写外部 Mapping、执行外部 Final 或注入 `credits.aleo/account`，项目也没有 devnode seed harness。安全复现当前工具边界的 WSL 命令为：

```powershell
wsl bash -lc 'cd /mnt/c/Users/71546/Desktop/aleo/leo/bug_proof && leo build && leo test --offline'
```

预期：build 成功，随后 `No tests run`。这条命令不是 Credits E2E；在新增独立 devnet harness 之前，不得把候选标记为 Ready for upgrade preview。