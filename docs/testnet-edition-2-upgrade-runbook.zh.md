# Protocol V3 / Aleo Testnet Edition 2 升级操作手册

> Protocol V3 是应用协议版本；对当前 Testnet Program 来说，下一次链上升级是 Program Edition 2，不是 Edition 3。

## 安全边界

- 管理员私钥只在本机 WSL 交互终端中输入，不写入环境文件、命令行参数、仓库、日志或聊天。
- npm run preview:testnet-edition-2 默认调用 leo upgrade --print，只生成升级预演，不广播。
- 只有显式执行带 --broadcast 的脚本，并再次输入 UPGRADE EDITION 2，脚本才会请求广播。
- 广播后不得因为索引延迟重复广播。先读取 Program latest_edition 和公开交易。
- V3 钱包能力采用失败关闭：Edition 2、13 个 V3 函数、9 个 V3 Mapping、升级交易和费用交易证据任一缺失，前端都保持禁用。

## 1. 打开管理员本机 WSL

~~~bash
wsl -d PrivateResume-Ubuntu
cd /mnt/c/Users/71546/Desktop/aleo
~~~

确认当前目录是项目根目录，并确认管理员正在使用与 Program 构造器地址对应的钱包。

## 2. 本地最终验证

~~~bash
npm run leo:build
npm test
npm run lint
npm run build
~~~

预期：

- Leo 版本为 4.4.0。
- ABI 与编译产物位于：
  - leo/bug_proof/build/zkbugbounty_7f3c92/abi.json
  - leo/bug_proof/build/zkbugbounty_7f3c92/zkbugbounty_7f3c92.aleo
- V1/V2 升级兼容性检查通过。
- V3 ABI 包含 13 个函数和 9 个 Mapping。
- 测试、Lint 与 Next.js 构建全部通过。

如果任何一步失败，停止升级。

## 3. 只做升级预演

~~~bash
npm run preview:testnet-edition-2
~~~

脚本会：

1. 核验 Testnet 上当前 Program 必须存在且 latest_edition 必须等于 1。
2. 扫描项目内潜在私钥字面量。
3. 重新编译 Program。
4. 核验管理员构造器、13 个 V3 函数和 9 个 V3 Mapping。
5. 计算源代码、编译 Program 和 ABI 的 SHA-256。
6. 在不回显的交互提示中读取管理员私钥。
7. 执行 leo upgrade --print。
8. 仅把不含签名载荷和私钥的摘要写入 local-upgrade-results/。

看到 Preview complete. No transaction was broadcast. 才表示预演路径结束。预演不产生可上链使用的交易 ID。

## 4. 管理员人工广播

只有在预演、代码审查和费用确认完成后执行：

~~~bash
bash scripts/upgrade-aleo-testnet-v3.sh --broadcast
~~~

操作时：

1. 在隐藏输入提示中输入管理员私钥。
2. 阅读 Leo 显示的费用与升级内容。
3. 脚本要求时输入完整确认词：UPGRADE EDITION 2。
4. 在钱包或 Leo 的最终确认处由管理员本人决定是否继续。

脚本不会传入 --yes，也不会跳过部署证书。成功返回后，它只记录公开字段：

- Upgrade Transaction ID
- Fee Transaction ID（若 Leo 返回）
- 源代码、编译 Program、ABI 哈希
- Git commit
- 状态 BROADCAST_UNVERIFIED

原始 Leo JSON 仅位于权限受限的临时目录，脚本退出时删除。

## 5. 验证链上 Edition 2

不要立即重复广播。使用脚本返回的两个公开 ID：

~~~bash
npm run verify:testnet-edition-2 -- \
  --upgrade-transaction-id at1... \
  --fee-transaction-id at1...
~~~

必须看到：

- Observed edition: 2
- Deployment edition: 2
- Owner address match: PASS
- Upgrade status: confirmed
- Overall verification: PASS

如果费用交易暂未被索引，可以等待后重新验证；这不是重复广播的依据。

## 6. 记录公开证据并启用前端

确认验证通过后，编辑 lib/aleo-program.ts 中的 ALEO_TESTNET_V3_UPGRADE_EVIDENCE：

~~~ts
export const ALEO_TESTNET_V3_UPGRADE_EVIDENCE = {
  transactionId: "at1...",
  feeTransactionId: "at1...",
  expectedEdition: ALEO_TESTNET_V3_EXPECTED_EDITION,
};
~~~

只填写公开交易 ID，不填写签名载荷、证明载荷或任何凭据。

随后再次运行：

~~~bash
npm test
npm run lint
npm run build
~~~

检查 /api/aleo/v3 必须同时返回：

- status: Available
- currentEdition: 2
- walletRequestEnabled: true
- upgradeEvidenceVerified: true

最后再部署 Vercel Preview，人工验证创建赏金、白帽提交、项目方审核、锁款、披露确认、复现修复、仲裁投票和自动结算。Preview 验证完成前不要提升到 Production。

## 7. ABI 和前端接通点

- Edition 2 ABI：leo/bug_proof/build/zkbugbounty_7f3c92/abi.json
- V3 能力门与 13 个构建器：lib/aleo-protocol-v3.ts
- V3 严格 Mapping 解析：lib/aleo-v3-registry.ts
- V3 只读 API：app/api/aleo/v3/
- Leo Wallet 请求：components/aleo-wallet-provider.tsx
- 三角色工作台：components/protocol-v3-workbench.tsx

钱包操作只在浏览器调用 Leo Wallet Adapter。服务器 API 只读公开链状态，POST 提交会返回 405。

## 故障处理

- 链上仍是 Edition 1：停止，V3 前端保持禁用。
- 链上已是 Edition 2、但脚本没有解析出 ID：不要重播；先查公开 Program 与交易。
- 交易 ID 已有、验证失败：不要写入能力门常量；核对 Program ID、管理员地址、Edition 和源码。
- ABI 哈希变化：重新完成本地编译、测试、审查和预演。
- 钱包提示网络错误：确认 Leo Wallet 位于 Aleo Testnet。
- 任何私钥疑似落盘：停止操作，隔离文件并按钱包安全流程轮换凭据。
