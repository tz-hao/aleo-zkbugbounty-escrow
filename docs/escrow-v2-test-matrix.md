# Escrow v2 Test Matrix

## 当前结果

- Node tests：`264/264 passed`
- Leo 4.0.2 build：passed
- Program size：`38.36 KB / 500 KB`
- `leo test --offline`：编译通过，但输出 `No tests run`
- Real Credits E2E：`COMPLETED_LOCAL_DEVNODE`

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
| New Claim count +1 | `submit_claim_v2` Final | 通过源码验证 |
| Paid / Rejected count -1 | release/reject Final + model test | 通过 |
| mixed terminal Claims reaches zero | terminal accounting test | 通过模型验证 |
| eight operation Marker domains | domains 201-208 + eight atomic Mapping writes | 通过 |
| source + edition capability gate | public source/latest_edition tests | 通过 |
| private fields absent from API/UI/store | privacy suite | 通过 |

## 已完成的真实 Credits E2E

已在隔离的 fresh-ledger Local Devnode 验证：

1. Owner 初始 Credits；
2. fund 后 Owner 减少、Program 增加；
3. release 后 Program 减少、Whitehat 增加；
4. refund 后 Program 减少、Owner 增加；
5. Mapping 与 Credits 同步变化；
6. 每个 invalid path 被真实 Final 拒绝；
7. 总量守恒，Fee 单独核算。

Leo 4.0.2 的 `@test fn` 仍不能替代 Credits E2E；运行时验收由独立 Devnode Harness 完成。辅助编译边界检查命令为：

```powershell
wsl bash -lc 'cd /mnt/c/Users/71546/Desktop/aleo/leo/bug_proof && leo build && leo test --offline'
```

预期：build 成功，随后 `No tests run`。这条命令不是 Credits E2E；真实 Credits 验收以 `npm run test:escrow-devnode` 的完整 Local Devnode Harness 为准，已确认 Credits conservation delta 为 0。
