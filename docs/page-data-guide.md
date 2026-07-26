# zkBugBounty Aleo Testnet 操作手册

本文只说明已部署的 Aleo Testnet 工作流：创建 Bounty、提交 Claim、读取公开 Registry 与核验重复 Nullifier 保护。未部署的 Escrow、奖励锁定、付款和退款不在本手册操作范围内。

Program ID：`zkbugbounty_7f3c92.aleo`
网络：Aleo Testnet
钱包：Leo Wallet

## 1. 操作前检查

开始前逐项确认：

1. 在浏览器扩展中解锁 Leo Wallet。
2. 将钱包网络切换到 Aleo Testnet。
3. 钱包有足够的 Testnet Credits 支付交易费用。
4. 仅使用公开地址和公开 `field` 数据操作网页。
5. 不要在任何表单、配置文件、聊天窗口或 URL 中输入 Private Key、Seed Phrase、View Key。
6. 不要上传真实 Exploit、PoC、触发参数、真实业务状态或私密漏洞报告。

链上交易需要你本人在钱包弹窗中确认。网页只会请求签名，不能代替你确认，也不会读取任何私钥。

## 2. 数据边界

| 数据类别 | 允许出现的位置 | 示例 | 处理规则 |
| --- | --- | --- | --- |
| 公开链上数据 | 交易、Mapping、Receipt、公开 Registry | `bounty_id`、`scope_hash`、奖励档位、`claim_hash`、`nullifier` | 可公开查询与复制 |
| 设备端私密输入 | 当前提交页面与钱包设备侧证明过程 | Witness 输入、报告者秘密承诺材料 | 仅用于当前操作；不得放入 URL、浏览器存储、公开备注或截图 |
| 禁止输入 | 所有网页、脚本、环境文件 | Private Key、Seed Phrase、View Key、真实 Exploit、PoC | 不得提供或保存 |

`Claim Hash`、`Witness Commitment`、`Reporter Commitment` 与 `Nullifier` 是公开承诺值，不是 Private Witness 本身；它们可出现在交易和 Receipt 中。

## 3. 首页 `/`

首页只作为协议入口，无需填写数据。

操作步骤：

1. 打开首页。
2. 点击“进入协议”。
3. 页面进入 `/submit-proof`。

首页不会请求钱包连接，也不会发起交易。

## 4. 创建链上 Bounty `/create-bounty`

创建 Bounty 会调用已部署 Program 的 `create_bounty`。钱包签名者由 Program 的 `self.signer` 写入 Owner；不要填写 Owner 地址。

### 4.1 填写字段

| 页面字段 | 链上字段 | 填写规则 | 公开性 |
| --- | --- | --- | --- |
| 安全规则 | `rule_id` | 从页面提供的规则中选择一项 | 公开 |
| Scope | `scope_hash` 的原始描述 | 填写简短的模块范围，例如 `Vault accounting logic`；不写漏洞利用细节 | 原文不入链，仅生成承诺值 |
| Bounty ID | `bounty_id` | 点击“生成公开标识”自动生成；不要手填 | 公开 Aleo `field` |
| Scope Hash | `scope_hash` | 根据 Scope 与规则自动生成；Scope 或规则变化后重新生成 | 公开 Aleo `field` |
| Critical / High / Medium / Low Reward | 四档奖励 | 填写非负整数，单位为 `microcredits` | 公开 |
| 有效期（Blocks） | 相对区块数 | 填写至少 `100` 的整数 | 公开 |
| Disclosure Deadline Height | `disclosure_deadline` | 页面按当前区块高度自动计算 | 公开 |
| 预计 Public Fee | 交易费 | 填写正整数，单位为 `microcredits` | 公开 |

当前 Program 登记奖励档位，但尚未启用 Credits 托管。填写奖励金额不代表资金已经锁定。

### 4.2 提交步骤

1. 打开 `/create-bounty`。
2. 连接 Leo Wallet；确认地址与网络状态正常。
3. 选择安全规则，填写 Scope 与四档奖励。
4. 点击“生成公开标识”，确认 `Bounty ID` 与 `Scope Hash` 已生成且均以 `field` 结尾。
5. 设置有效期和预计手续费。
6. 点击“生成 Transaction Preview”。
7. 检查 Preview：Program ID、函数名 `create_bounty`、Bounty ID、Scope Hash、Rule、奖励档位、Deadline、手续费。
8. 点击请求钱包签名。
9. 在 Leo Wallet 弹窗中复核网络、函数、公开输入和费用后，由你本人确认或取消。

### 4.3 创建结果判断

钱包返回请求标识不等于链上 Transaction ID。仅以真实 `at1...` Transaction ID 为准。

| 状态 | 含义 | 下一步 |
| --- | --- | --- |
| Wallet cancelled | 钱包未签名 | 修改参数或重新请求签名 |
| Submitted | 请求已提交 | 等待 Testnet 处理 |
| Confirmed | 交易已被接受 | 查询 `bounties` Mapping |
| Mapping Verified | Mapping 与交易公开输入一致 | Bounty 可用于提交 Claim |
| Rejected / Aborted | 交易未写入有效 Bounty | 读取拒绝原因后修正，不要把它当作成功 |

保存以下公开信息：Transaction ID、Bounty ID、Scope Hash、Rule、Deadline、Owner 地址。

## 5. 核验 Bounty `/create-bounty/result` 与 `/bounties/[bountyId]`

### 5.1 创建结果页

1. 打开 `/create-bounty/result`。
2. 粘贴真实 `at1...` Transaction ID。
3. 粘贴 Bounty ID，例如 `257640041950318553814753415615134947371field`。
4. 等待页面读取交易和 Mapping。
5. 核对 Owner、Bounty ID、Scope Hash、Rule、四档奖励、Deadline、Status。

只有 `Mapping Verified` 代表公开 Mapping 已存在且内容与创建交易一致。`Confirmed` 不能替代该检查。

### 5.2 公开详情页

访问 `/bounties/[bountyId]`，将 URL 中的 `[bountyId]` 替换为公开 Aleo `field`。

示例：

```text
/bounties/257640041950318553814753415615134947371field
```

页面只读取 `bounties` Mapping。若找不到键，说明该 Bounty 尚未写入、键不正确，或交易没有成功执行 Final。

## 6. 提交链上 Claim `/submit-proof`

Claim 提交调用 `submit_claim`。先核验 Bounty，再生成公开承诺输出，最后由 Whitehat 钱包签名。

### 6.1 先验证公开 Bounty

1. 打开 `/submit-proof`。
2. 进入 Aleo Testnet Real Mode。
3. 输入已核验的 On-chain Bounty ID。
4. 等待页面读取 `bounties` Mapping。
5. 核对以下公开数据：Program ID、Bounty ID、Scope Hash、Rule、Deadline、Status、Owner。
6. 只有 Status 为 `Active` 且 Deadline 未过期时继续。

不要使用网页缓存、URL 参数或浏览器存储中的旧数据替代 Mapping 读取结果。

### 6.2 填写可公开元数据

| 字段 | 填写方式 |
| --- | --- |
| Bug Type | 填写简短分类，例如 `Vault accounting invariant breach`；不要写 Exploit path、触发参数或 PoC |
| Requested Fee | 填写本次钱包交易的公开费用，单位为 `microcredits` |
| Bounty ID | 使用第 6.1 节已核验的 `field` 值 |

### 6.3 私密输入处理

私密输入只在当前设备与 Wallet 证明流程内使用。操作要求：

1. 使用非敏感测试材料，不录入真实漏洞细节。
2. 不复制 Private Witness、私密状态、报告者秘密到公开备注、截图、URL 或外部表单。
3. 不调用或恢复服务端私密 Proof API；`/api/aleo/prove` 返回 `410` 是预期的安全边界。
4. 页面完成、失败或离开操作后，应清除当前表单中的私密输入。

### 6.4 Preview 与 Wallet 签名

生成 Preview 后，逐项检查：

1. Program ID 为 `zkbugbounty_7f3c92.aleo`。
2. Function 为 `submit_claim`。
3. Network 为 Aleo Testnet。
4. 钱包地址是当前 Whitehat 地址。
5. Bounty ID、Scope Hash、Rule 与已读取 Mapping 一致。
6. Claim Hash、Witness Commitment、Reporter Commitment、Nullifier 均为公开 `field` 值。
7. Severity 合法，且满足 Program 的验证条件。
8. 手续费符合预期。

页面会先查询 `nullifiers` Mapping。若 Nullifier 已存在，必须更换一次性测试材料并重新生成公开承诺；不要尝试复用已存在 Nullifier。

确认 Preview 后：

1. 点击请求 Wallet 签名。
2. 钱包弹窗出现后，人工复核函数、网络、公开输入和费用。
3. 由你本人确认或取消。
4. 记录钱包返回的真实 `at1...` Transaction ID，不要将 Wallet Request ID 当作交易 ID。

## 7. 核验 Claim 与 Receipt `/public-claims`

该页面无需连接钱包，所有读取均来自公开链上数据。

### 7.1 读取公开 Registry

1. 打开 `/public-claims`。
2. 等待 Bounty 与 Claim Registry 加载。
3. 确认每条记录具有链上来源与 Mapping 状态。
4. 网络不可用时，页面应显示不可用或空结果；不能把错误状态视为确认结果。

### 7.2 查询指定 Bounty

1. 在“查询链上 Bounty 状态”输入 Bounty ID，例如 `257640041950318553814753415615134947371field`。
2. 点击“查询 mapping”。
3. 核对 Owner、Scope Hash、Rule、Reward tiers、Deadline、Status。

### 7.3 查询指定 Claim Receipt

1. 在“独立核验链上 Claim Receipt”输入 Claim Hash（Aleo `field`）。
2. 点击“查询 Receipt”。
3. 核对 Claim Hash、Bounty ID、Scope Hash、Rule、Severity、Witness Commitment、Reporter Commitment、Nullifier、Proof Status 与 Protocol Version。
4. 再查询同一 Nullifier，确认其为已占用状态。

成功验收应同时满足：Transaction Confirmed、Nullifier Mapping found、Claim Receipt Mapping found。三项缺少任一项，都不应标记 Claim 为完整链上验收。

## 8. Triage `/triage`

当前 Testnet 已部署版本不支持链上奖励托管、锁定、支付或退款。因此本页不能用于发起真实资金操作。

可执行的安全操作：

1. 读取公开 Claim、Receipt 与披露状态。
2. 记录只包含公开信息的分诊备注。
3. 通过独立安全渠道与项目方交换加密披露材料。

禁止事项：

- 不要把明文漏洞报告、Exploit、PoC 或 Private Witness 粘贴到公开备注。
- 不要依据页面上的未部署支付入口判断奖励已锁定或已付款。
- 不要把披露材料、解密材料或私钥上传至网站。

## 9. 重复 Nullifier 验收 `/security-tests/duplicate-nullifier`

此页面仅用于 Testnet 安全验收，验证 Program Final 会拒绝重复 Nullifier。被拒绝交易可能仍消耗 Testnet Fee。

操作步骤：

1. 准备一个已经成功写入的公开 Nullifier 与原始 Claim Receipt。
2. 打开 `/security-tests/duplicate-nullifier`。
3. 确认 Preview 使用相同 Nullifier，但使用新的测试 Claim Hash、Witness Commitment 与 Reporter Commitment。
4. 确认 Bounty、Scope Hash、Rule、Deadline、Severity 均仍然有效。
5. 页面必须显示预期结果为 `Rejected` 和费用风险。
6. 只有在明确理解费用风险后，才请求钱包签名。
7. 钱包弹窗出现后由你本人决定确认或取消。
8. 若确认，记录第二笔 `at1...` Transaction ID，并查询结果。

验收通过条件：第二笔交易为 `Rejected`；原 Nullifier Mapping 不变；原 Claim Receipt 不变；新 Claim Hash 未产生有效 Receipt；公开 Claim 数量不增加。

如果重复交易被 `Accepted`，立即停止后续操作，并将其视为最高优先级安全问题。

## 10. 常见状态与处理

| 页面状态 | 含义 | 操作 |
| --- | --- | --- |
| Wallet extension unavailable | 浏览器未检测到 Leo Wallet | 安装或启用扩展后刷新页面 |
| Wallet locked | 钱包未解锁 | 在扩展内解锁后重新连接 |
| Wrong network | 钱包不是 Testnet | 切换到 Aleo Testnet 后重新授权 |
| Connection rejected | 用户拒绝连接授权 | 重新点击连接，并在弹窗中授权 |
| Transaction rejected | Program Final 或交易条件拒绝 | 记录 Transaction ID 与原因，修正公开输入后重新生成 Preview |
| Mapping not found | 公开键不存在或 Final 未写入 | 核对 `field` 编码、交易状态与函数 ABI |
| Endpoint unavailable | 公共节点暂不可达 | 稍后重试；不要把不可用当作未部署或已确认 |

## 11. 已部署能力与限制

已验收：

- Wallet-signed `create_bounty`
- Wallet-signed `submit_claim`
- `bounties` Mapping
- `nullifiers` Mapping
- `claim_receipts` Mapping
- Duplicate Nullifier 拒绝
- 公开 Registry 读取

尚未启用链上操作：

- `fund_bounty`
- `lock_reward`
- `release_reward`
- `refund_bounty`
- 链上 Escrow 与真实付款

在这些功能完成 Program Upgrade、人工广播并通过 Testnet 验收之前，不能将网页中的奖励状态解释为链上资金状态。
