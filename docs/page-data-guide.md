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

### 6.2 填写可公开数据

| 字段 | 填写方式 |
| --- | --- |
| Requested Fee | 填写本次钱包交易的公开费用，单位为 `microcredits` |
| Bounty ID | 使用第 6.1 节已核验的 `field` 值 |

Real Mode 的 Bug Type、Rule 与 Scope Hash 由已读取的 Bounty 和 Program 输入确定，页面不要求手动填写漏洞叙述。不要把 Exploit path、触发参数或 PoC 填入任何公开字段。

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

当前 Testnet 的 Edition 4 支持经公开能力门核验后的 V3 托管、锁定、支付和退款，以及 REMEDIATION 无 quorum 到期后的确定性恢复。页面只会在公开 Edition、升级证据与 Program 哈希同时通过时请求 Leo Wallet 签名；任何 Endpoint 不可用或证据不匹配都会失败关闭，绝不回退到 Demo。

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

- `fund_bounty_v2`
- `lock_reward_v2`
- `release_reward_v2`
- `refund_bounty_v2`
- 链上 Escrow 与真实付款

在这些功能完成 Program Upgrade、人工广播并通过 Testnet 验收之前，不能将网页中的奖励状态解释为链上资金状态。

## 12. 逐页可填写示例

以下是完全虚构的安全测试数据，用于理解每个输入框应该填写什么。它们不包含真实漏洞、真实合约状态或任何钱包凭据。

重要规则：

1. 自动生成的 `Bounty ID`、`Scope Hash`、`Claim Hash`、`Nullifier` 不要手改。
2. `field` 示例仅在页面已经验证对应 Mapping 时才可用于链上流程。
3. 点击“请求 Wallet 签名”可能产生 Testnet 交易和费用；只查看 Preview 时不要确认钱包弹窗。
4. 每次准备实际提交新 Claim 时，必须替换 `reporterSecret`，避免生成重复 Nullifier。

### 12.1 首页 `/`

无需填写任何数据。

| 操作控件 | 操作 | 预期结果 |
| --- | --- | --- |
| 进入协议 | 点击 | 进入 `/submit-proof`；不连接钱包、不发交易 |

### 12.2 创建 Bounty `/create-bounty`

选择 `Aleo Testnet`，使用下面这一组可直接填写的公开测试数据：

| 页面字段 | 填写值 | 说明 |
| --- | --- | --- |
| 安全规则 | `Vault Accounting Safety` | 对应链上 `rule_id = 1field` |
| Scope | `Test Vault Accounting QA` | 仅用于生成 Scope Hash；不要填漏洞步骤 |
| Critical Reward | `5000000` | 单位 `microcredits` |
| High Reward | `2000000` | 单位 `microcredits` |
| Medium Reward | `1000000` | 单位 `microcredits` |
| Low Reward | `500000` | 单位 `microcredits` |
| 有效期（Blocks） | `100000` | 从当前 Testnet 高度起计算 |
| 预计 Public Fee | `1000000` | 默认手续费；Wallet 仍会显示最终确认信息 |

按顺序操作：

1. 填完 Scope 和规则后，点击“生成公开标识”。
2. 记录页面自动生成的 `Bounty ID` 与 `Scope Hash`，两者必须以 `field` 结尾。
3. 点击“生成 Transaction Preview”。
4. Preview 中必须看到：`create_bounty`、`zkbugbounty_7f3c92.aleo`、`1field`、四档奖励和 Deadline。
5. 只做表单检查时，在钱包弹窗点击取消；需要真正创建时，再由本人确认。

不要填写：Owner 地址、Private Key、Seed Phrase、View Key、真实项目合约地址或真实漏洞描述。

### 12.3 创建结果 `/create-bounty/result`

此页只填写自己刚刚创建交易得到的公开值。

| 输入框 | 应填写的来源 | 示例格式 |
| --- | --- | --- |
| Public Transaction ID | 钱包或区块浏览器返回的真实交易 ID | `at1...` |
| Bounty ID | 创建 Preview 中自动生成的值 | `123456789field` |

不要把 Wallet Request ID 填入 Public Transaction ID。填写后依次确认：Transaction 为 `Confirmed`，随后 `bounties` Mapping 为 `found`，最后显示 `Mapping Verified`。

### 12.4 公开 Bounty 详情 `/bounties/[bountyId]`

将第 12.3 节的 Bounty ID 粘到 URL 中。示例格式：

```text
/bounties/123456789field
```

此页没有可编辑表单。应读取并显示 Owner、Scope Hash、Rule、四档奖励、Deadline 与 Status。若页面显示 not found，先回到创建结果页核验 Mapping，而不是改写 URL 里的数据。

### 12.5 提交 Claim `/submit-proof`

#### A. 先填写并验证 Bounty

| 页面字段 | 填写值 | 操作说明 |
| --- | --- | --- |
| On-chain Bounty ID | 第 12.3 节通过 Mapping Verified 的 Bounty ID | 例如 `123456789field`，不能填写任意数字 |
| 验证链上 Bounty | 点击按钮 | 等待出现 Status、Rule、Scope Hash、Owner、Deadline 和 Current Height |
| Public Fee | `5000000` | 单位 `microcredits`；这是当前页面默认值 |

只有在页面显示 Bounty 为 `Active` 且未过期后，才会显示对应 Rule 的 Private Witness 输入框。

#### B. 截图中的 Vault Accounting Safety 填写方法

当页面显示 Rule 为 `Vault Accounting Safety` 时，填写下表：

| 输入框 | 填写值 | 计算含义 |
| --- | --- | --- |
| `vaultBalance` | `100` | 初始 Vault 余额 |
| `totalClaims` | `80` | 初始总 Claim |
| `hiddenDeltaBalance` | `90` | 只在当前设备侧使用的余额变化 |
| `hiddenDeltaClaims` | `30` | 只在当前设备侧使用的 Claim 变化 |
| `reporterSecret` | `zkbb-fixture-vault-001` | 一次性虚构字符串；不是钱包密钥 |
| Public Fee | `5000000` | 公开手续费，单位 `microcredits` |

这组数值的检查过程是：初始 `100 >= 80` 成立；变化后余额为 `100 - 90 = 10`，总 Claim 为 `80 + 30 = 110`；最终 `10 < 110`，影响值为 `100`，对应 Critical。`reporterSecret` 每次真实提交都要改成新字符串，例如将末尾改为 `002`、`003`，不能复用。

#### C. 其它规则的可填写虚构值

仅在页面读取到对应 Rule 后填写相应行；未显示的字段无需填写。

| Rule | 输入字段与填写值 | 预期结果 |
| --- | --- | --- |
| Claims vs Deposits Safety | `totalDeposits=100`；`totalClaims=80`；`hiddenDeltaClaims=30`；`reporterSecret=zkbb-fixture-claims-001` | 变化后 `110 > 100`，影响值 `10`，Medium |
| Reward Reserve Safety | `vaultBalance=100`；`reservedRewards=20`；`hiddenDeltaBalance=40`；`hiddenDeltaReservedRewards=90`；`reporterSecret=zkbb-fixture-reserve-001` | 变化后 Reserve `110 > 60`，影响值 `50`，High |
| Withdrawal Limit Safety | `withdrawLimit=50`；`userBalance=40`；`requestedWithdrawAmount=20`；`hiddenDeltaWithdrawAmount=35`；`hiddenDeltaUserBalance=10`；`reporterSecret=zkbb-fixture-withdraw-001` | 变化后请求额 `55`、可用余额 `30`，影响值 `25`，Medium |

提交前最后检查：

1. 不要在任何字段输入真实漏洞复现步骤、PoC 或私钥。
2. 确认 Preview 的 Program 为 `zkbugbounty_7f3c92.aleo`，Function 为 `submit_claim`。
3. 确认 Bounty ID、Scope Hash、Rule 与页面刚读取的 Mapping 一致。
4. 如只验证表单，在 Leo Wallet 弹窗取消。
5. 如确认广播，保留真实 `at1...` Transaction ID，等待链上状态，而不是只看 Wallet Request ID。

### 12.6 公开 Claims `/public-claims`

页面有两类可输入查询框：

| 查询区域 | 填写数据 | 正确格式 | 查询后核对 |
| --- | --- | --- | --- |
| 查询链上 Bounty 状态 | 创建成功后的 Bounty ID | `123456789field` | Owner、Scope Hash、Rule、Reward tiers、Deadline、Status |
| 独立核验链上 Claim Receipt | 已确认 Claim 的 Claim Hash | `987654321field` | Bounty ID、Rule、Severity、Witness Commitment、Reporter Commitment、Nullifier、Protocol Version |

不要填：Transaction ID、钱包地址、Scope 原文或任何 Private Witness。两个查询框只接受 Aleo `field` literal；错误格式不会得到 Mapping 结果。

### 12.7 公开 Receipt 详情 `/public-claims/[registryKey]`

此页没有可填写表单。点击公开 Registry 中的 Receipt 入口后，URL 会包含公开 `registryKey`。

可核对的数据：Receipt ID、Claim Hash、Witness Commitment、Reporter Commitment、Nullifier、Severity、Rule、Scope Hash、Bounty ID、Proof Status 与 Protocol Version。

不要手工拼接未知 `registryKey`，不要把 Private Witness 或报告内容添加到 URL。

### 12.8 Triage `/triage`

当前页面可在 Edition 4 公开能力门通过后，为 V3 Claim 构建真实 Escrow、锁定、披露确认、仲裁和付款交易预览。只有 `Mapping Verified` 才表示链上动作完成；公开备注仍只能填写非技术细节。

可填写示例：

```text
已核验公开 Claim Receipt；等待项目方通过独立安全渠道确认修复范围。
```

不要填写：漏洞复现步骤、漏洞路径、触发参数、PoC、Private Witness、加密材料明文、任何钱包密钥。

#### 本地加密演练：可导入文件与文本

下列文件专门用于截图中的“Encrypted Disclosure · Device Only”区域：

| 页面控件 | 使用文件 / 文本 | 用途 |
| --- | --- | --- |
| 导入 Owner Public Key | [`triage-owner-public-key.fixture.json`](./fixtures/triage-owner-public-key.fixture.json) | 有效 ECDH P-256 公钥；可直接用“选择 JSON 文件”导入 |
| 私密披露报告 | [`triage-private-disclosure-report.fixture.txt`](./fixtures/triage-private-disclosure-report.fixture.txt) 的全部文本 | 复制后粘贴到文本框；内容为虚构测试报告 |

操作步骤：

1. 在 Triage 页面将当前 Claim 推进至 `RewardLocked` 后，再进入 `DetailsRequested`。
2. 以 Whitehat 视角打开该 Claim 的 Encrypted Disclosure 区域。
3. 点击“选择 JSON 文件”，导入 `triage-owner-public-key.fixture.json`。
4. 打开 `triage-private-disclosure-report.fixture.txt`，复制全部内容并粘贴到“私密披露报告”。
5. 点击“本地加密”。页面应生成 Ciphertext Package，并允许导出 JSON。
6. 需要验证端到端解密时，不使用本仓库的示例公钥；由 Project Owner 在页面点击“生成披露密钥”，自行导出 Public Key 和 Disclosure Decryption Key，再将该 Public Key 交给 Whitehat。

示例公钥没有附带解密私钥，因此它只用于验证导入与加密流程。这样不会把任何解密材料或钱包密钥写入仓库。

### 12.9 重复 Nullifier 验收 `/security-tests/duplicate-nullifier`

此页没有可自由填写的漏洞参数。它应从第一个已确认 Claim 读取已有 Nullifier，并构造预期为 `Rejected` 的交易 Preview。

操作时只核对：

1. Existing Nullifier 与第一笔已确认 Claim 相同。
2. New Claim Hash、Witness Commitment、Reporter Commitment 与第一笔不同。
3. Bounty ID、Scope Hash、Rule、Deadline 仍来自有效 Bounty。
4. 页面明确提示可能消耗 Testnet Fee。
5. 只有希望实际验收重复保护时，才在 Wallet 弹窗确认；否则取消。
