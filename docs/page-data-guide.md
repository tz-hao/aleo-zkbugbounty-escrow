# zkBugBounty 页面数据填写说明

本文按当前版本的实际页面和数据边界编写。项目同时包含 Aleo Testnet Real Mode 与 Local Demo Mode；两者不能混用。

## 先区分三类数据

| 分类 | 可以出现的位置 | 示例 | 是否上链 / 持久化 |
| --- | --- | --- | --- |
| 公开协议数据 | Testnet 交易、Mapping、公开 Registry、Receipt | `bounty_id`、`scope_hash`、`rule_id`、奖励档位、`claim_hash`、`nullifier` | 可以公开查询 |
| 设备端临时输入 | `/submit-proof`、加密披露工作台的当前组件内存 | DemoVault 数值、随机 `reporterSecret`、本地明文报告 | 不写入 Store、URL、localStorage、sessionStorage 或服务端日志 |
| 永不填写 | 任何网页表单、脚本、配置文件 | Private Key、Seed Phrase、View Key、真实 Exploit、真实 PoC、生产触发参数 | 禁止 |

`Witness Commitment`、`Claim Hash`、`Nullifier` 是公开承诺值，不是 Private Witness 本身；它们可以出现在 Receipt 和 Mapping 中。

## 首页 `/`

无需填写数据。首页只提供协议入口和导航：

- `Aleo Testnet · Network confirmed`：公开网络状态，不是钱包地址，也不是连接凭据。
- `进入协议`：前往 `/submit-proof`，不会创建交易。

首页不显示钱包连接、安装钱包或钱包诊断。需要签名时，请在创建 Bounty 或提交 Claim 的实际流程中连接钱包。

## 创建 Bounty `/create-bounty`

页面顶部可以选择两种模式。

### Aleo Testnet：真实创建预览与钱包签名

只有该模式会构造 `create_bounty` 的链上交易。钱包地址由 `self.signer` 自动成为 Owner，用户不需要、也不应填写 Owner 地址或任何私钥。

| 页面字段 | 对应协议数据 | 填写方式 | 公开性 / 说明 |
| --- | --- | --- | --- |
| 安全规则 | `rule_id` | 从四个 DemoVault 规则中选择 | 公开。决定后续 Proof 的不变量与输入集合。 |
| Scope | 用于计算 `scope_hash` | 用简短、可审计的模块范围描述，例如 `Vault accounting logic` | Scope 原文仅在当前浏览器用于计算；不上链。不要填写真实漏洞细节。 |
| Bounty ID | `bounty_id` | 点击“生成公开标识”后自动生成 | 公开 Aleo `field`，不可重复；不手填。 |
| Scope Hash | `scope_hash` | 由 Scope 与规则自动生成 | 公开 `field` commitment；不手填。修改 Scope 或规则后必须重新生成。 |
| Critical / High / Medium / Low Reward | 四个奖励档位 | 填写非负整数，单位是 `microcredits` | 公开。当前部署版本只登记奖励档位，**不会锁定或托管 Credits**。 |
| 有效期（Blocks） | 相对区块数 | 填写至少 `100` 的整数 | 页面根据当前 Testnet 高度计算 `disclosure_deadline`。 |
| Disclosure Deadline Height | `disclosure_deadline` | 自动计算 | 公开绝对区块高度，不手填。 |
| 预计 Public Fee | Wallet Fee | 填写正整数 `microcredits` | 公开交易手续费；签名钱包自行确认最终收费。 |

提交顺序：检查 Testnet → 生成 `bounty_id` 与 `scope_hash` → 生成 Transaction Preview → 人工确认钱包签名。`Submitted`、`Confirmed` 与 `Mapping Verified` 是三个不同状态；只有 Mapping Verified 才说明公开 Bounty 映射已写入并与交易参数一致。

### Demo Local：本地演示 Bounty

此模式不会创建 Aleo transaction，也不会写入 Testnet。

| 字段 | 用途 | 注意事项 |
| --- | --- | --- |
| 项目名称 | 本地演示卡片标题 | 仅本地 Demo。 |
| 披露截止说明 | 本地工作流说明 | 这是文本，不是 Testnet block height。 |
| Scope | 本地受影响模块描述 | 不填真实漏洞路径或 PoC。 |
| 安全规则 | 选择 DemoVault 不变量 | 决定本地 mock evaluator。 |
| Bounty Pool 与四档奖励 | 演示奖励数值 | 不代表资金托管。 |

## 创建结果 `/create-bounty/result`

此页只填写或粘贴公开验收数据：

| 字段 | 格式 | 用途 |
| --- | --- | --- |
| Public Transaction ID | `at1...` | 查询 `create_bounty` 是否 Confirmed。不要使用 Wallet Request ID 代替。 |
| Bounty ID | Aleo `field`，例如 `123field` | 查询 `bounties` Mapping；留空时可从已确认交易的公开输入推导。 |

页面会比对 Owner、Bounty ID、Scope Hash、Rule、奖励档位与 Deadline。确认交易存在不代表 Mapping 已验证。

## 公开 Bounty 详情 `/bounties/[bountyId]`

只读页面。URL 中的 `bountyId` 必须是公开 Aleo `field`。页面读取 `bounties` Mapping，展示 Owner、Scope Hash、Rule、奖励档位、Deadline 与状态。这里不填写私密数据，也不提供 Mock 回退。

## 提交 Private Proof `/submit-proof`

默认是 Aleo Testnet Real Mode。Real Mode 先验证公开 Bounty，之后才显示对应规则的设备端输入。

### Real Mode：先填写公开 Bounty ID

| 字段 | 格式 | 用途 |
| --- | --- | --- |
| On-chain Bounty ID | `123field` | 必填。读取真实 `bounties` Mapping，并校验 Active 状态、Rule、Scope Hash 与 Deadline。 |
| Bug Type | 简短公开分类 | 公开 Claim 元数据，例如 `Vault accounting invariant breach`。不得写入 Exploit path、触发参数或 PoC。 |
| Requested Fee | `microcredits` | 钱包签名交易的公开费用。 |

Mapping 验证通过后，页面显示 Owner、Rule、Scope Hash、Deadline 与当前区块高度；这些均为公开链上数据。

### 规则对应的临时 PrivateProofInput

以下输入只用于当前页面的组件内存和钱包设备侧计算。当前项目应只使用虚构 DemoVault 测试值；不要填真实合约状态、真实攻击参数或敏感业务数据。

| 规则 | 初始状态输入 | 临时变化输入 | 验证目标 |
| --- | --- | --- | --- |
| Vault Accounting Safety | `vaultBalance`、`totalClaims` | `hiddenDeltaBalance`、`hiddenDeltaClaims` | `vaultBalance >= totalClaims` 被打破 |
| Claims vs Deposits Safety | `totalDeposits`、`totalClaims` | `hiddenDeltaClaims` | `totalClaims <= totalDeposits` 被打破 |
| Reward Reserve Safety | `vaultBalance`、`reservedRewards` | `hiddenDeltaBalance`、`hiddenDeltaReservedRewards` | `reservedRewards <= vaultBalance` 被打破 |
| Withdrawal Limit Safety | `withdrawLimit`、`userBalance`、`requestedWithdrawAmount` | `hiddenDeltaWithdrawAmount`、`hiddenDeltaUserBalance` | `withdrawLimit <= vaultBalance` 对应条件被打破 |

其他临时字段：

- `privateCallSequence`：仅 Demo/本地模拟可用的序列描述；不要填写真实调用序列。
- `privateStateValues`：仅 Demo/本地模拟的状态描述；不要填写真实状态快照。
- `reporterSecret`：为当前测试 Claim 使用的随机、一次性秘密。它不是 Aleo Private Key，也不能复用钱包、账户或生产凭据。

生成后的公开输出只有 `claimHash`、`witnessCommitment`、`nullifier`、`reporterCommitment`、`severity`、`ruleId`、`scopeHash`、Receipt/Registry 标识和验证状态。页面会在完成、失败或离开流程时清空临时输入。

### Demo Local

可以选择本地 Bounty 和 Mock/Aleo 开发 Engine，验证四个 DemoVault 不变量。此模式的状态只用于演示，不能当作 Testnet Claim、Receipt 或支付状态。

## Triage `/triage`

当前页面分为公开 Receipt、责任披露工作流、公开时间线、加密披露工作台和 AI 建议。Reward Lock、Patch、Paid、Reject 仍是 Local Demo State；当前已部署 Program 尚未提供 Escrow/支付 entry，因此不能将它们理解为链上支付。

### 可填写的数据

| 角色 | 字段 / 文件 | 用途 | 数据边界 |
| --- | --- | --- |
| Triage Arbiter | 公开备注 | 解释处理结论或给出 Severity 建议 | 只写可公开内容；不要写漏洞复现步骤。 |
| Project Owner | Owner Public Key JSON | 给 Whitehat 的加密收件公钥 | 可导出；解密密钥 bundle 不上传、不写 Store。 |
| Whitehat | Owner Public Key JSON、私密披露报告 | 在当前设备加密报告 | 密文需要通过外部安全通道交付；明文不上传。 |
| Project Owner | Ciphertext Package JSON、Disclosure Decryption Key JSON | 本地完整性校验与解密 | 仅当前组件内存使用；解密后应主动清除。 |

登记交付时，Store 只保留 `packageHash`、`recipientKeyId` 与公开状态；Ciphertext、明文报告、解密密钥和 Private Witness 都不会保存。

## 公开 Claims `/public-claims`

默认是公开只读浏览，无需钱包，也无需填写任何表单。页面读取 Testnet discovery、`claim_receipts` 与 `nullifiers` Mapping，并将本地演示 Registry 放在折叠区域中。

可复制或作为 URL 参数使用的公开数据包括：

- `Receipt ID`、`Claim Hash`、`Registry Key`
- `Witness Commitment`、`Nullifier`、`Scope Hash`
- Rule、Affected Module、Severity、Proof Status、Disclosure Status、Payout Status
- Program ID、Network、Public Transaction ID、Protocol Version

页面不会展示 Witness、hidden delta、reporter secret、触发参数、Exploit path 或 PoC。

## 公开 Receipt `/public-claims/[registryKey]`

只读详情页。`registryKey` 是 URL 中的公开索引键；页面允许复制 Receipt、Claim、Commitment 和 Nullifier 等公开值。不要把任何私密内容拼接到 URL。

## Duplicate Nullifier 安全测试 `/security-tests/duplicate-nullifier`

此页仅用于受控 Testnet 验收。它重用已存在的 Nullifier 构造一个“预期被拒绝”的交易 Preview，以验证 Final 的重复保护。不要把它用于真实漏洞数据；在钱包弹窗前必须人工确认，且被拒绝交易仍可能消耗 Testnet Fee。

## 钱包数据规则

钱包连接仅在创建/提交实际链上交易时需要。前端只读取公开地址、网络状态与交易响应；永远不要向本项目输入、粘贴或上传：

- Aleo Private Key
- Seed Phrase
- View Key
- 私密钱包导出文件

如果钱包未连接、被锁定或网络不是 Aleo Testnet，先在钱包扩展中处理；不要将任何凭据填入网页表单。

## 当前链上能力边界

当前 Testnet 已验收的能力是 `create_bounty`、`submit_claim`、Bounty/Nullifier/Claim Receipt Registry 与重复 Nullifier 拒绝。`fund_bounty`、`lock_reward`、`release_reward`、`refund_bounty` 尚未部署；任何显示为 Reward Lock、Paid 或 Escrow 的内容都必须视为 Local Demo，直到 Program Upgrade 被人工广播并完成 Testnet 验收。
