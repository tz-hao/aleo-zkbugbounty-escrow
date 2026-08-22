# zkBugBounty Protocol V3 操作手册（Edition 4 当前版）

> 当前 Testnet 已公开核验为 Edition 4。此手册不要求、收集、保存或打印 Private Key、Seed Phrase、View Key、Private Witness、Exploit、PoC 或触发参数。REMEDIATION 争议在裁决期无 quorum 时会回到 `ReproductionConfirmed`，奖励仍保持锁定。

## 使用前检查

1. 连接 Shield，并确认网络为 Aleo Testnet。
2. 页面必须显示公开 Program 能力已通过：Edition、升级交易、费用交易和 Program Hash 全部匹配。
3. 区分三个阶段：`Wallet Submitted`、`Transaction Confirmed`、`Mapping Verified`。只有 `Mapping Verified` 才是完成依据。
4. 私有见证、报告正文、PoC、密钥与解密内容不得进入 Scope、备注、URL、公开承诺输入或截图。

## 创建赏金 `/create-bounty`

默认入口是 **Aleo 测试网（V3 当前协议）**；V2 仅在显式选择“V2 兼容（旧数据）”时出现，本地演示也完全独立。

1. 项目方先在“生成并保存项目方披露密钥”中本地创建专用 ECDH 密钥。
2. 立即下载私钥包并离线保管；下载公钥包，后续安全地交给白帽。
3. 页面会从规范化公钥以域分隔 SHA-256 的前 31 字节派生非零 `disclosure_key_commitment` 并自动填入。下载的公钥包会携带同一公开 field，白帽加密前会再次核对。
4. 填写 Scope、奖励档位、披露期限、目标系统承诺、固定代码版本哈希、三位仲裁员、2/3 或 3/3 门槛、审核/裁决 SLA、争议保证金与付款条件。
5. 生成 Bounty ID、Scope Hash、Panel ID；核对公开预览中的 9 个 ABI 输入后才请求钱包签名。
6. 交易确认后，在公开 `bounties`、`bounty_v3_configs` 与 `bounty_protocol_versions` Mapping 完成验证。

验收：面板地址均不同且不等于项目方；配置创建后不可修改；没有任何私钥进入页面或链上。

## 提交 Claim `/submit-proof`

默认入口是 **V3 当前协议**。

1. 白帽输入 Bounty ID，读取链上 V3 Bounty 和固定的目标系统/代码承诺。
2. 在安全的本地证据流程中准备目标状态、可验证执行和报告承诺；下载“公开绑定清单”，用于让双方核对这些 `field` 未被替换。
3. 私有 DemoVault witness 与 Reporter Secret 仅交给 Shield；不能把真实漏洞利用细节填入这些输入。
4. 钱包确认后，查询 `claim_receipts`、`claim_reporters`、`nullifiers`、`claim_v3_evidence` 与 `claim_v3_states`。

验收：收据代表“审核及锁款资格”，不代表真实目标漏洞、可复现性或修复有效性。

## 分诊、加密交付与仲裁 `/triage`

在 V3 workbench 输入 Claim Hash 并读取公开 Mapping；页面会从连接钱包和不可变 Bounty 配置推导项目方、白帽或仲裁员权限。

### 白帽交付

1. 仅在 `RewardLocked` 后，导入项目方事先分发的公钥包。
2. 本地输入私密报告，页面先核对项目方公钥能否导出链上 `disclosure_key_commitment`，再生成密文包。包会验证绑定当前 Claim Hash 与链上 `report_commitment`。
3. 下载密文包，经双方约定的安全通道交付给项目方。
4. 再点击“准备链上交付登记”，核对公开 ABI 预览后使用白帽钱包签名。

### 项目方解密与确认

1. 导入收到的密文包与本地私钥包。
2. 页面先校验本地私钥对应链上 `disclosure_key_commitment`，再校验 package hash、Claim Hash 和 `report_commitment`，最后在本地解密。
3. 确认后点击“准备链上接收确认”；该操作复用已验证的报告承诺，不接受随意的确认值。
4. 项目方本地复现后，按角色按钮记录复现结论、修复承诺；白帽确认修复或依规则进入争议。

### 仲裁证据

争议打开后，发起方可以为链上固定的三位仲裁员分别导入不同公钥并生成三份密文包。每份都绑定当前 `dispute_commitment`，只能交付给对应仲裁员。仲裁员解密后仅在链上投票；链上不保存密文或明文。

### 结算

仲裁员仅能投 `Reject`、收据建议等级或其下调档位。达到固定门槛后，任何人都可构建确定性结算预览。奖励金额必须等于已锁定金额，保证金接收方由合约决定。

## 当前边界

- 当前证明绑定目标系统、代码、状态、执行和报告承诺，但 DemoVault 电路尚不验证外部目标链状态根或真实执行事实。
- Shield 官方适配器当前为 alpha：页面只请求最小权限连接和公开交易签名；每笔交易必须在 Shield 内由用户人工核对。尚未完成实际 Shield 签名验收前，不应将适配器集成表述为钱包端 E2E 验证。
- 密文包的链上承诺确保同一 Claim 使用同一公开字段；项目方仍需本地核验其真实复现材料。
- Edition 4 的 REMEDIATION 争议若仲裁期无 quorum，会在裁决期到期后回到 `ReproductionConfirmed`；这不会自动支付或解锁奖励。
