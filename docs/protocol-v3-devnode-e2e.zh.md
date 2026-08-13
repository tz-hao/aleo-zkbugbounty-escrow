# Protocol V3 Devnode：开发循环与最终认证

所有命令都只允许连接 `127.0.0.1:3030` 的 Leo Devnode。它们不会使用 Testnet 钱包、管理员私钥或创建 Program Edition。生产协议 [`leo/bug_proof/src/main.leo`](../leo/bug_proof/src/main.leo) 不属于本测试体系的可修改范围。

## 命令

```bash
# 完全离线；不提示私钥、不启动 Devnode
npm run v3:preflight

# 只跑一个 V3 场景，默认不再重跑完整 V1/V2
npm run v3:e2e -- reproduction
npm run v3:e2e -- dispute-types
npm run v3:e2e -- quorum-2
npm run v3:e2e -- quorum-3
npm run v3:e2e -- non-arbiter
npm run v3:e2e -- duplicate-vote
npm run v3:e2e -- settlement-replay
npm run v3:e2e -- refund-replay
npm run v3:e2e -- atomicity

# 仅开发时：根据测试/Harness 差异选择最小场景
npm run v3:e2e:changed

# 仅最终 Candidate 认证：全量 V1/V2/V3，fresh ledger，禁止缓存/快照
npm run v3:e2e:final
```

`legacy` 也是单独场景：`npm run v3:e2e -- legacy`。它运行完整旧版兼容路径；普通 V3 场景不隐式执行它。

## 四层语义

| 模式 | 行为 | 可复用内容 |
| --- | --- | --- |
| `v3:preflight` | Candidate、源码哈希、工作树、测试、lint、Bash、fixture、ABI 与 helper 参数数量检查 | 静态 PASS marker（输入变化自动失效） |
| `v3:e2e` | 只执行明确指定的一个场景 | Common bootstrap ledger snapshot |
| `v3:e2e:changed` | 根据 Harness/fixture 的本地差异选择场景 | 同上；不能作为最终认证 |
| `v3:e2e:final` | 全部静态门禁、完整 V1/V2 兼容、全部 V3 动态覆盖 | 无；强制 fresh ledger |

静态缓存键包含根 HEAD、相关工作区差异、冻结 Candidate SHA、Leo 版本、测试/Harness 内容、baseline fixture、ABI manifest。公共快照还绑定三位本地角色的派生公开地址；角色变更不会复用旧账本。

## 本地凭据与账本

场景和最终模式均会在启动 Devnode、部署或第一笔交易前，在可见终端一次性隐藏输入 Owner、Whitehat、Arbiter 1 的**本地专用**私钥。Harness 随后使用 Leo 派生公开地址，校验格式、地址有效性和三种身份互异；任何失败均发生在启动 Devnode 前。

不要把私钥发给 Codex，也不要粘贴浏览器钱包或 Testnet 管理员密钥。密钥只在当前进程及其本地 Leo 子进程内使用，退出时 `unset`。

开发与 final 账本默认在 WSL 文件系统：

```text
~/.cache/zkbb/devnode/
├── static-gates/
├── snapshots/
├── runs/
│   └── <cache-key>/<scenario>/run-*/
│       ├── ledger/
│       ├── workspaces/       # 本轮 baseline / Candidate 的 Leo 执行副本
│       └── runtime/          # Devnode 日志、脱敏诊断与报告
└── final-run.*/
    ├── ledger/
    ├── workspaces/           # 本轮 baseline / Candidate 的 Leo 执行副本
    └── runtime/              # Devnode 日志、脱敏诊断与报告
```

进入动态 V3 运行前，Harness 先对 Windows 工作区中的 Candidate 做 Git HEAD、干净状态与 `main.leo` 哈希校验；随后仅复制 `main.leo` 与 `program.json` 到本轮专属的 WSL 执行副本，并逐字节比对。Baseline 也在同一位置物化。因此每笔 `leo build/execute`、Devnode ledger 与 Devnode 日志都不会反复读写 `/mnt/c/...`；运行期间原始 baseline/Candidate 工作区不会被本地管理员地址补丁修改。执行副本只在本轮退出清理，原始工作区仍是唯一的 Candidate 证据来源。

Baseline 部署和 Candidate upgrade 仍由经过校验的本地源码产生；部署完成后的动态交易统一使用 Leo `--no-local` 从本地 Devnode 读取已部署字节码，避免每笔交易重新构建大型源码包。最终六类争议矩阵已经覆盖接受、拒绝、复现和修复路线，因此 final 只执行一次该矩阵，不再先重复旧的两路线 V3 样例。手续费守恒直接复用已确认交易的内存响应；Devnode 的独立 fee 查询只作为有界回退，单次 HTTP 500 不会再让整轮末尾误失败。

Harness 对删除、克隆、执行副本和 final ledger 都有固定前缀校验；拒绝 `/mnt/c/...`、任意已有 final ledger、任意 snapshot/resume final。`--from-bootstrap` 仅对开发场景有效，且只能从已验证的公共 bootstrap clone，不能从业务中间状态继续。

## 快照边界与日志

首次开发场景会完成 Devnode 启动、credits bootstrap、edition 0 部署、Candidate 本地 upgrade 后创建公共 snapshot；每次场景从其 clone 启动。任何 Candidate、主源码、Leo、fixture、ABI 或 Harness/test 输入变化都会生成不同 cache key。

正常终端输出只保留阶段、交易 ID、确认/拒绝、关键断言和耗时。完整 CLI/交易错误写到 `local-devnode/logs/` 的脱敏诊断文件；私钥、View Key、seed 与 auth 不会写入。

最终认证阶段会输出 `bootstrap`、`legacy`、`v3-reproduction` 与最终动态覆盖的时间摘要；最终成功的唯一认证标记仍是：

```text
Protocol V3 R2 FINAL DYNAMIC COVERAGE: PASS
```

最后还必须显示：

```text
Testnet transactions broadcast by Codex: 0
```

## 并行最终覆盖

机器资源允许时，使用一条命令运行分片后的最终覆盖：

```bash
npm run v3:e2e:final:parallel
```

该命令先运行一次静态门禁，然后在当前终端隐藏读取三把本地专用角色密钥。密钥仅保存在父 Shell 内存中，并通过匿名管道传给 worker；不会导出为环境变量、写入文件、进入命令行参数或日志。默认最多同时运行 3 个 worker，可按机器资源调整：

```bash
ZKBB_PARALLEL_WORKERS=4 npm run v3:e2e:final:parallel
```

每个 worker 使用独立的 localhost 端口、fresh ledger、执行工作区、日志和报告。最终覆盖拆分为 `legacy`、`two-core`、`duplicate-scope`、`severity`、`reproduction-remediation`、`three-of-three` 六个 shard；只有全部 shard 成功，聚合器才输出最终 `PASS`。串行 `npm run v3:e2e:final` 仍保留，作为单 ledger 的兼容入口。

若并行运行只有少数 shard 失败，可复用该次运行目录中经过严格校验的 PASS 日志，只为失败或缺失的 shard 创建 fresh ledger 并重跑。例如：

```bash
ZKBB_PARALLEL_RESUME_ROOT=/home/milli/.cache/zkbb/devnode/parallel-final.dConJH \
ZKBB_PARALLEL_WORKERS=1 \
npm run v3:e2e:final:parallel
```

恢复入口会重新执行静态门禁，并逐个校验 Candidate HEAD、`main.leo` 未改变、源码完整性、Testnet 交易数为 0 和 shard 专属完成标记；校验不完整的日志不会被复用。失败 shard 的旧日志会被该次重跑日志覆盖，因此可以继续使用同一个恢复目录重试。
