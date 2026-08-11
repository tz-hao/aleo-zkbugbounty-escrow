# zkBugBounty 操作手册

本手册对应当前 Aleo Testnet Edition 1 前端。它描述公开协议操作与页面填写方式，不要求、收集或保存 Private Key、Seed Phrase、View Key、Private Witness、Exploit、PoC 或触发参数。

## 0. 使用前检查

1. 打开站点后，右上角默认显示中文；需要英文时选择 `EN`，URL 会保留为 `?lang=en`。语言偏好不会写入 localStorage。
2. 对真实链上操作，使用已解锁的 Leo Wallet，并确认网络为 `Aleo Testnet / testnetbeta`。
3. 确认公开 Program ID 为 `zkbugbounty_7f3c92.aleo`，且页面网络状态可读取 Testnet 高度。
4. 只在 Wallet 弹窗内人工确认交易。页面中的 `Wallet Submitted`、`Transaction Confirmed`、`Mapping Verified` 是三个不同状态。
5. 在任何公开字段中都不要填入漏洞利用细节、PoC、触发参数、Private Witness、隐藏增量或 Reporter Secret。

## 1. 首页 `/`

首页只说明协议边界：**zkBugBounty lets whitehats prove a bug exists without leaking the exploit.**

- 点击 `进入协议 / Enter protocol` 进入 `/submit-proof`。
- 右上角语言切换可在中文与英文界面之间切换。
- 首页不连接钱包、不生成 Proof、不写入链上。

## 2. 创建 Bounty `/create-bounty`

此页有两个完全隔离的模式：默认的 `Aleo Testnet` 是真实链上流程；`本地演示 / Demo Local` 仅用于 UI 与状态机演示，不会创建链上交易。

### 2.1 Aleo Testnet 模式的填写顺序

1. 在顶部连接 Leo Wallet，并确认 `Aleo Testnet`。
2. 等待网络徽章显示 Testnet 当前高度；不可用时先重试，不要生成交易。
3. 选择安全规则，填写 Scope、奖励档位、有效期和公开交易费。
4. 点击 `生成公开标识 / Generate public identifiers`。
5. 逐项确认生成的 `Bounty ID` 与 `Scope Hash`，然后点击 `生成 Transaction Preview`。
6. 核对 Preview 的 Program、Function、8 个公开输入和 Fee。
7. 点击 `请求 Wallet 签名 / Request Wallet signature`，仅在 Leo Wallet 弹窗中人工确认。
8. 跳转 `/create-bounty/result` 后，用公开 Transaction ID 与 Bounty ID 完成确认和 Mapping 验证。

### 2.2 字段说明

| 页面字段 | 如何填写 | 链上作用与限制 |
| --- | --- | --- |
| 安全规则（Public） | 从四条预设 Invariant 中选择与项目边界匹配的一条。 | 写入公开 `rule_id`，创建后不可修改。 |
| Scope | 用一句不敏感的模块/边界描述，例如 `Vault accounting logic`。 | 原文不保存、不上链；浏览器只生成公开 `Scope Hash`。禁止填写 Exploit、PoC、触发参数或私密材料。 |
| Bounty ID | 不手填。点击生成公开标识后由浏览器安全随机生成。 | 公共主键，必须在 Transaction Preview 中核对。 |
| Scope Hash | 不手填。规则与 Scope 改动后重新生成。 | SHA-256/128 field commitment，作为公开输入。 |
| Critical / High / Medium 奖励 | 填整数 microcredits。 | 必须满足 `Critical >= High >= Medium > 0`。`1 credit = 1,000,000 microcredits`。 |
| Low Reward | 固定为 `0`。 | Low impact Proof 不可验证且不可支付，不能配置。 |
| 有效期（Blocks） | 填从当前高度开始的区块数量，最少 `100`。 | 页面计算最终 `Disclosure Deadline Height`；到期后 Claim 不能提交。 |
| 交易 Fee（microcredits） | 填本次 create_bounty 的网络执行费。 | 是网络费，不是 Bounty 奖励，不进入 Escrow。 |

### 2.3 四条规则

| rule_id | 规则 | 公开 Invariant |
| --- | --- | --- |
| `1field` | Vault Accounting Safety | `vaultBalance >= totalClaims` |
| `2field` | Claims vs Deposits Safety | `totalClaims <= totalDeposits` |
| `3field` | Reward Reserve Safety | `reservedRewards <= vaultBalance` |
| `4field` | Withdrawal Limit Safety | `requestedWithdrawAmount <= withdrawLimit && requestedWithdrawAmount <= userBalance` |

### 2.4 奖励与 Escrow 的边界

`create_bounty` 只登记奖励档位和公开 Bounty 状态，**不会转入 Credits**。创建确认后，Project Owner 需要在适用的链上流程中通过 `fund_bounty_v2` 向 Escrow 注入 Testnet Credits。未 funding 的 Bounty 不应被视为已具备可支付奖励。

## 3. 创建验收 `/create-bounty/result`

此页用于公开验收，不依赖 localStorage。

1. 填写 `Public Transaction ID`，格式为 `at1...`。
2. 填写或确认 `Bounty ID`，格式为十进制 Aleo field literal，例如 `123field`。
3. 点击 `验证公开链上状态`。

验收标准：

- `Wallet Submitted`：钱包已接收请求，不能证明已广播或确认。
- `Transaction Confirmed`：公开 Transaction 可读取，仍不能单独证明 Final Mapping 写入。
- `Mapping Verified`：`bounties` Mapping 存在，且 owner、Bounty ID、Scope Hash、Rule、奖励档位、Deadline 与公开输入一致。这才是创建完成。

若 Transaction 已确认但 Mapping 未找到，页面会明确显示 `Mapping Missing`，不得把它写成创建成功。

## 4. 提交 Private Proof `/submit-proof`

### 4.1 模式选择

- `Aleo Testnet`：真实链上 submit_claim 准备流程。必须先从公开 `bounties` Mapping 读取 Bounty；不会回退到 Mock 或 localStorage；不会调用服务端 Proof API。
- `Local Demo`：本地状态机与 Mock Invariant Engine 演示。它不代表 Network Confirmed，也不占用链上 Nullifier。

### 4.2 Aleo Testnet 模式

1. 填入已确认的 `On-chain Bounty ID`，例如 `257640041950318553814753415615134947371field`。
2. 点击 `验证链上 Bounty`。页面必须同时读取 Bounty Mapping 与最新 Testnet 高度。
3. 核对显示的 `Status`、`Rule`、`Scope Hash`、`Owner`、`Deadline`、`Current Height`。仅 `Active` 且未过期的 Bounty 可继续。
4. 确认连接钱包的公开地址会作为 `Whitehat / Reporter`。
5. 根据已验证的 Rule 输入**虚构 DemoVault 测试数据**。不要使用真实漏洞、真实 Exploit 或真实 PoC。
6. 填入 `reporterSecret`。它仅在当前设备内存和 Wallet 请求边界内使用，提交结束后清空；不要在任何公开字段或文档中记录它。
7. 填入 `Public Fee (microcredits)`，点击 `请求 Wallet 签名`。核对 Wallet 弹窗中的 Program、函数 `submit_claim`、Bounty ID、Claim Hash、Nullifier 与 Fee 后再人工签名。

### 4.3 按规则显示的 Private Witness 数值

这些输入不会进入公开 Claim metadata、URL、store、日志或公开 UI。

| 规则 | 仅设备端临时输入 |
| --- | --- |
| Vault Accounting Safety | `vaultBalance`、`totalClaims`、`hiddenDeltaBalance`、`hiddenDeltaClaims` |
| Claims vs Deposits Safety | `totalDeposits`、`totalClaims`、`hiddenDeltaClaims` |
| Reward Reserve Safety | `vaultBalance`、`reservedRewards`、`hiddenDeltaBalance`、`hiddenDeltaReservedRewards` |
| Withdrawal Limit Safety | `withdrawLimit`、`userBalance`、`requestedWithdrawAmount`、`hiddenDeltaWithdrawAmount`、`hiddenDeltaUserBalance` |

数值必须是非负 `u64` 范围内的纯测试数值。若 Bounty 到期、Mapping 不存在、网络不正确、钱包拒签或已有待确认交易，停止并先处理对应错误；不要重复广播。

### 4.4 提交后验收

1. 区分 Wallet Request ID 与公开 `at1...` Transaction ID。
2. 查询 Transaction 状态、Block Height、Block Hash 和可能的拒绝原因。
3. 只有 Transaction confirmed 后，再查询 `nullifiers` Mapping 与 `claim_receipts` Mapping。
4. 两个 Mapping 都找到且字段对应，才能显示为有效公开 Claim。
5. 同一个 Nullifier 的第二笔交易预期被 Final 拒绝；不要把这种测试当作正常提交流程。

## 5. Triage `/triage`

页面默认展示 `Aleo Testnet` 数据源，真实权限由 Wallet signer 和 Program Mapping 控制。`本地流程演示` 仅用于演示四个角色的前端状态机，切换 Demo Preview 不会改变钱包或链上权限。

### 5.1 可见信息与隐私边界

公开摘要可显示：Bug Type、Severity、Proof Status、Receipt ID、Claim Hash、Witness Commitment、Nullifier、Rule、Scope Hash、公开的 Disclosure/Payout 状态。

不能显示或读取：Private Witness、hidden delta、Reporter Secret、Private Call Sequence、Private State Values、Exploit Path、PoC、触发参数。

`Triage Copilot` 只依据公开 metadata 和公开 triage note 给出风险摘要与下一步建议；它不读取加密披露包正文或任何私密输入。

### 5.2 Responsible Disclosure 状态顺序

`Verified -> RewardLocked -> DetailsRequested -> EncryptedDetailsShared -> Patched -> Paid`

- Project Owner：锁定奖励、请求加密细节、标记修复、释放 Bounty、拒绝 Claim。
- Whitehat：仅在 `DetailsRequested` 后可分享加密细节的公开 package hash。
- Triage Arbiter：添加不会泄露 Exploit 的公开备注与 Severity 建议。
- Public User：只读，无 Triage 操作权限。

加密细节仅面向 Project Owner；系统只记录 package hash、接收方标识与公开交付状态，不保存真实 Exploit 内容。

## 6. Public Registry `/public-claims`

此页可以在无钱包、清空 localStorage 的浏览器中使用。它有四类公开查询：

1. `公开链上索引`：按 `Bounties` 或 `Claims` 分页发现公开 Transaction，并再次检查 Mapping。`Transaction Accepted` 不等于 `Mapping Verified`。
2. `部署核验`：读取 Program、部署 Transaction、公开 edition 与 Escrow 能力。Endpoint 不可用会单独标识，不能被解释为 Program 未部署。
3. `查询链上 Bounty 状态`：填 `Bounty ID` field，读取 `bounties` Mapping。
4. `独立核验链上 Claim Receipt`：填 `Claim Hash` field，读取 `claim_receipts` Mapping。

页面只展示 project/rule 公开信息、Bug Type、Severity、Proof Status、Disclosure Status、Payout Status、patched/paid 状态与公共承诺。固定边界为：

- `Exploit Details: Hidden`
- `Private Witness: Never Stored`
- `Proof: Publicly Verifiable`

## 7. 单条 Claim Receipt `/public-claims/[registryKey]`

使用 Registry Key 打开公开 Receipt。核对 Claim Hash、Bounty ID、Scope Hash、Rule、Severity、Witness Commitment、Reporter Commitment、Nullifier、Proof Status、Protocol Version 与 Verification Level。

Verification Level 必须被区分：`Mock Simulation`、本地 Leo 开发执行与 `Network Confirmed` 不能互相替代。公开 Receipt 不包含任何 Private Witness 或 Exploit 细节。

## 8. 单条 Bounty `/bounties/[bountyId]`

使用 Bounty ID 打开单条 Bounty 的公开视图。应核对 Owner、Rule、Scope Hash、奖励档位、Deadline、Bounty Status、Escrow 相关公开状态和关联 Claim。所有链上状态以实时 Mapping 查询为准，不以页面缓存为准。

## 9. 钱包诊断与常见问题

右上角 Wallet 状态详情只展示公开诊断：adapter 是否检测到、连接地址、Wallet network、预期 network、连接拒绝、锁定、网络错误与 Transaction Preview 状态。

| 现象 | 处理方式 |
| --- | --- |
| Wallet extension unavailable | 安装并解锁 Leo Wallet，然后刷新页面。 |
| Wrong network | 在 Wallet 中切换到 `Aleo Testnet / testnetbeta`，再重新连接。 |
| Connection rejected | 在 Connected sites 移除本站后重新授权；不需要也不应输入私钥到网页。 |
| Wallet locked | 解锁扩展后重新连接。 |
| Endpoint unavailable | 保持未确认状态，稍后重试公开查询；不回退 Demo 或 localStorage。 |
| Transaction pending | 等待公开状态或 Mapping 变化，不重复提交相同操作。 |
| Mapping missing | 继续检查 Final 是否执行、key 编码、ABI 和交易实际状态；不要把它标为成功。 |

## 10. Duplicate Nullifier 安全测试 `/security-tests/duplicate-nullifier`

这是受控的 Testnet 安全验收页面，不是正常 Claim 提交通道。它只用于对已确认的公开 Nullifier 构造第二笔预览，以验证链上 `nullifiers` Mapping 的 Final 拒绝保护。

1. 只使用页面预置的公开、受控测试向量；不要录入真实漏洞或私密输入。
2. Preview 必须显示相同的 Existing Nullifier，以及新的测试 Claim Hash、Witness Commitment、Reporter Commitment。
3. 页面会明确说明这笔交易预期被拒绝，且可能仍消耗 Testnet Fee。
4. 只有用户在 Wallet 弹窗中人工签名后才可能广播；取消签名不会创建新 Claim。
5. 验收后查询原 Nullifier 与原 Receipt 均未改变，新 Claim Hash 没有有效 Receipt，Public Claims 数量不增加。

## 11. 安全操作清单

- 私钥只在用户自己的 Wallet 或 WSL 交互终端中输入；不写入网页、`.env`、脚本、日志、截图或工单。
- 每次 Wallet 签名都重新核对 Program ID、Function、Network、公开输入与 Fee。
- 不使用真实漏洞、真实 Exploit、真实 PoC 或敏感生产数据做 DemoVault 测试。
- 不把 `Private Witness`、hidden delta、Reporter Secret、Exploit Path、PoC 或触发参数放入 Scope、公开备注、Claim metadata、URL 或截图。
- 线上验收以 Testnet Mapping 为准；UI 的 Demo 状态、缓存和 Preview 都不是链上成功证明。
