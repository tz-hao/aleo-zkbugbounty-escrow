# Protocol V3 / Aleo Testnet Edition 4 修复部署记录

> Edition 4 已在 Aleo Testnet 公开确认。本文只记录公开交易、哈希和流程边界；不包含私钥、签名载荷或任何披露明文。

## 已部署公开证据

- 当前 Program Edition：`4`
- 升级交易：`at12g0pckphn4lwhyd9lezpfgme32lv68d7gkqvhdpydsy0l0a57vqs26he6w`
- 费用交易：`at1vdzjqc8r0eecqpyhrnnuqe4yyrehdle79yjm5u3vsz7ju0snys9squkc4z`
- 本地编译 Program SHA-256：`4cc94027c34ba6bf59caf5a4bae26406f92fee268ae3df02d00001a5d09aada2`
- 链上 Program source SHA-256：`42a71e17a7c9fc6221de99bfb053e363e1c09f44e3891af2ae070dacb7336a71`

公开 `latest_edition`、Edition 4 Program 与升级交易端点均已独立返回成功。前端必须继续同时核验 Edition、升级交易、费用交易和链上源码哈希，任一项不匹配即关闭钱包写入。

## 修复目标

Edition 3 的 `REMEDIATION` 争议要求仲裁面板达到固定 quorum 才能结案。若投票窗口结束仍未达到门槛，后续投票被拒绝，而奖励和争议保证金仍会停留在 `Disputed`。Edition 4 增加唯一的到期默认规则：

```text
REMEDIATION + decision window expired + no quorum + verdict 0
  -> ReproductionConfirmed
  -> 奖励继续锁定
  -> 争议保证金支付给白帽
  -> 项目方可提交新的修复承诺
```

它不自动支付奖励、不解锁奖励、不改变严重程度，也不允许调用方任意选择接收方。`verdict = receipt.severity` 仍必须由面板 quorum 支持。

## 不变条件

- `finalize_rejection_v3` 的 ABI 与所有已有 Mapping 保持不变。
- 先写状态、争议元数据、保证金和 replay marker，再执行 Credits `transfer.run()`。
- 到期前，未达 quorum 的结算仍必须失败。
- 默认路径只适用于类型 `6u8` 的 REMEDIATION，且只能使用 `0u8`。
- 结案后回到 `ReproductionConfirmed(7)`，不会减少 unresolved claim count 或改变锁定奖励。

## 已冻结 ABI 的 WCEI 提示

`fund_bounty` 是 Testnet 早期版本留下的冻结入口。它在 transition 中同时要求
`amount == 0` 与 `amount != 0`，没有有效证明能够进入其 finalizer；实际资金路径为
`fund_bounty_v2` 与 `fund_bounty_v3`。

Leo 仍会对该历史 finalizer 报告 WCEI 提示，因为 Credits future 必须位于 finalizer
的第一个输入以保持已上线 ABI。将 `transfer.run()` 下移虽然能消除提示，却会改变
finalizer 输入顺序并使 Program Edition 无法升级。因此该提示被保留、未被抑制；回归
测试同时锁定其 fail-closed 约束和 future-first ABI。可用 V2/V3 资金入口保持
Checks-Effects-Interactions 顺序。

## 本地验证门禁

```bash
npm test
npm run lint
npm run build
LEO_BIN=/path/to/leo-4.4.0 npm run leo:build
```

还应运行包含 REMEDIATION 的独立 Devnode shard，并至少覆盖：

1. 到期前无 quorum 的 `finalize_rejection_v3` 被拒绝且 Mapping 不变。
2. 到期后以 `0u8` 结算成功，状态恢复 `ReproductionConfirmed`。
3. 到期后以非零 verdict 仍被拒绝。
4. 保证金接收方只能是白帽，奖励 escrow 仍保持锁定。

## 已完成的 Testnet 发布边界

1. 读取 Edition 3 的公开 Program 和接口，执行 ABI 兼容检查。
2. 对 Edition 4 候选执行无密钥、无签名、无广播 preview，记录源码、编译产物和 ABI 哈希：

   ```bash
   LEO_BIN=/home/milli/.local/leo-toolchains/4.4.0/bin/leo \
   # 历史记录：Edition 4 已部署；当前仓库不再公开升级命令。
   ```

   该命令只读取公开 Testnet 信息；它不会请求、读取或保存管理员私钥，也不会签名或广播。
3. Program Admin 已在自己的交互终端审阅费用与结果后广播。

   当时使用固定入口，避免脚本默认的历史 `2 -> 3` 版本边界：

   ```bash
   LEO_BIN=/home/milli/.local/leo-toolchains/4.4.0/bin/leo \
   # 不要重放历史广播；使用 npm run verify:testnet-edition-4 只读核验当前状态。
   ```

   管理员私钥仅在该终端的隐藏提示中输入。成功或无法解析交易 ID 时都不要重复广播，应先查询公开链上状态。
4. 已记录升级交易 ID、费用交易 ID、Edition 和链上 Program SHA-256。
5. 前端已切换到 Edition 4 能力门禁；不得再把 Edition 4 描述为候选规则。
