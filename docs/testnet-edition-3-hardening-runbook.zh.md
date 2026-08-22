# 历史归档：Protocol V3 / Aleo Testnet Edition 3 加固操作手册

> Edition 3 是历史公开版本，当前 Testnet 已公开核验为 Edition 4。本文件仅保留历史升级证据，不能再作为当前发布步骤执行；请阅读 [Edition 4 修复部署记录](protocol-v3-edition-4-remediation-hardening.zh.md)。

## 历史上线前置条件

- 不要向任何人、聊天、环境文件或命令行参数提供管理员私钥；脚本只在隐藏交互提示中读取它。
- 确认当前 Testnet `latest_edition` 为 `2`。不是 `2` 时停止，先读取公开 Program 与交易，绝不重播。
- 本历史记录不决定合约与前端的真实写入能力；当前能力以 Edition 4 的公开证据为准。

## 1. 本地验证

在 WSL 项目根目录执行：

~~~bash
npm test
npm run lint
npm run build
LEO_BIN=/home/milli/.local/leo-toolchains/4.4.0/bin/leo npm run leo:build
npm run verify:testnet-edition-2
~~~

Leo 编译会产生 `build/zkbugbounty_7f3c92/zkbugbounty_7f3c92.aleo` 与 ABI。若任一步失败，停止升级。

## 2. 无广播预演

~~~bash
HTTPS_PROXY=http://127.0.0.1:18080 \
https_proxy=http://127.0.0.1:18080 \
LEO_BIN=/home/milli/.local/leo-toolchains/4.4.0/bin/leo \
# 历史记录：Edition 3 已升级完成；当前仓库不再公开升级命令。
~~~

该预演只读取公开链上信息：当前 Edition、Program 管理员公开地址与余额、保留的历史接口，并编译检查 13 个 V3 函数、13 个 V3 Mapping 与三项 SHA-256。它不会请求管理员私钥、不会构造签名、不会广播交易；Leo 4.4.0 当前没有无签名的精确升级费用估算接口，因此费用会明确显示为 `UNAVAILABLE`。

## 3. 管理员人工广播

只有已审查预演、费用和编译哈希后，管理员本人执行：

~~~bash
HTTPS_PROXY=http://127.0.0.1:18080 \
https_proxy=http://127.0.0.1:18080 \
LEO_BIN=/home/milli/.local/leo-toolchains/4.4.0/bin/leo \
bash scripts/upgrade-aleo-testnet-v3.sh --broadcast
~~~

在隐藏提示中输入管理员私钥后，必须准确输入：

```text
UPGRADE EDITION 3
```

广播路径只会把经过脱敏的 Leo 输出写入临时日志和终端；任何 `Private Key`、View Key、签名或签名载荷形态的输出都会被替换，且不会进入公开 evidence 文件。

广播成功只表示请求已提交；等待索引，不要因未立即显示而重复广播。

## 4. 记录公开证据并复核

从脚本输出或 Explorer 记录以下**公开**值：升级交易 ID、费用交易 ID、`Compiled Program SHA256`。把它们填入 [`lib/aleo-program.ts`](../lib/aleo-program.ts) 的 `ALEO_TESTNET_V3_UPGRADE_EVIDENCE`：

```ts
{
  transactionId: "at1...",
  feeTransactionId: "at1...",
  compiledProgramSha256: "本地 Leo 编译产物的 64 位小写十六进制哈希",
  onChainProgramSourceSha256: "Testnet 公共 Program 文本的 64 位小写十六进制哈希",
  expectedEdition: ALEO_TESTNET_V3_EXPECTED_EDITION,
}
```

不要记录私钥、签名载荷、证明载荷或加密报告。随后运行：

~~~bash
npm run verify:testnet-edition-3
~~~

只有 `Observed edition: 3`、`Upgrade status: confirmed`、`On-chain Program source SHA-256 match: PASS` 和 `Overall verification: PASS` 全部出现，前端才会允许 V3 钱包操作。本地 Leo 编译产物与 Testnet 返回的公开 Program 文本属于不同序列化表示，分别保存，不能互相直接比较。

## 5. 前端验收

重新执行 `npm test && npm run lint && npm run build`，部署 Vercel Preview 后访问 `/api/aleo/v3`。确认：

- `status: "Available"`
- `currentEdition: 3`
- `upgradeEvidenceVerified: true`
- `programHashVerified: true`
- `walletRequestEnabled: true`

再由各角色在 Testnet 用小额、公开测试数据人工走查。任一校验失败时停止，不要绕过失败关闭机制。
