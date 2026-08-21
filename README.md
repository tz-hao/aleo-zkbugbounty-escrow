# zkBugBounty

> **zkBugBounty lets whitehats prove a bug exists without leaking the exploit.**
>
> zkBugBounty 让白帽能够证明漏洞存在，而不泄露利用细节。

zkBugBounty 是一个运行在 **Aleo Testnet** 上的隐私优先、责任披露（Responsible Disclosure）协议原型。白帽可以在设备端以私有 DemoVault 见证证明安全约束被破坏；链上仅记录可验证的承诺、收据、状态与 Credits 托管账本，不保存漏洞利用路径、PoC、触发参数或私有见证。

| 项目 | 当前状态 |
| --- | --- |
| 在线 DApp | [aleo-gilt.vercel.app](https://aleo-gilt.vercel.app) |
| Aleo Program | [`zkbugbounty_7f3c92.aleo`](https://testnet.explorer.provable.com/program/zkbugbounty_7f3c92.aleo) |
| 网络 | Aleo Testnet |
| 链上状态 | Edition `3` 已公开核验；Edition `4` 修复候选待独立编译、预览与管理员部署 |
| 合约语言 | Leo 4.4 |
| 前端 | Next.js 16, React 19, TypeScript, Tailwind CSS |

![zkBugBounty protocol overview](public/images/zkbugbounty-readme-protocol-v1.png)

## 为什么需要它

传统漏洞赏金往往迫使研究员在获得信任、奖励锁定或修复前先交出 PoC。这会产生矛盾：披露得足够详细才容易被相信，但过早披露又可能给攻击者提供可操作的利用信息。

zkBugBounty 将“**证明影响存在**”与“**交付利用细节**”分开：

1. 白帽在本地生成私有约束证明；
2. Aleo 记录公开 Claim Receipt、Witness Commitment、Reporter Commitment 与一次性 Nullifier；
3. 项目方基于链上状态审核、锁定奖励并请求加密披露；
4. 加密细节只发送给固定接收方；
5. 复现、修复、争议、仲裁和 Credits 结算拥有可审计的链上状态机。

收据只证明私有输入满足已部署的 DemoVault 约束与协议绑定。它不是对真实生产系统漏洞、复现结果或修复有效性的自动判定。

## Protocol V3：责任披露、仲裁与结算

Testnet 当前是已公开核验的 **Edition 4 / Protocol V3**。前端只在公开 Edition、升级交易、费用交易和完整 Program SHA-256 同时匹配时启用 V3 钱包动作。Edition 4 已修复 REMEDIATION 争议在仲裁面板未达门槛时可能长期停留在 `Disputed` 的活性问题：裁决期到期且无 quorum 时，Claim 回到 `ReproductionConfirmed`，奖励保持锁定。

```text
Submitted
  -> OwnerReviewing
     -> Accepted -> RewardLocked
     -> OwnerRejected -> Disputed | Rejected
RewardLocked
  -> DisclosureDelivered -> DisclosureAcknowledged
  -> ReproductionConfirmed -> PatchProposed -> PatchAccepted -> Paid
  -> ReproductionRejected -> Disputed | Rejected
Disputed
  -> panel decision / SLA default -> RewardLocked | Paid | Rejected
```

### 参与者

| 角色 | 链上职责 |
| --- | --- |
| Project Owner | 创建与充值 Bounty、审核 Claim、确认加密披露、记录复现与修复决定。 |
| Whitehat | 提交私有证明、交付加密报告、确认修复、对可申诉决定发起争议。 |
| Arbitration Panel | 仅在争议期对固定的 Bounty 面板进行一次性投票。 |
| Public User | 读取公开收据、映射与状态；无法读取漏洞细节。 |

### V3 链上入口

| 入口 | 作用 |
| --- | --- |
| `create_bounty_v3` | 固化范围、规则、奖励、付款条件、披露公钥承诺与仲裁面板。 |
| `submit_claim_v3` | 写入经绑定的 Claim Receipt、Reporter、Nullifier 与公开证据承诺。 |
| `fund_bounty_v3` | 将真实 Testnet Credits 转入 Bounty 托管。 |
| `review_claim_v3` | 项目方开始审核、受理、提出可申诉决定或评估严重程度。 |
| `lock_reward_v3` | 按已配置的奖励档位锁定资金。 |
| `disclosure_action_v3` | 记录加密包交付与项目方确认，不写入明文。 |
| `resolution_action_v3` | 记录复现、修复提议、白帽接受修复或无申诉终结。 |
| `dispute_claim_v3` / `cast_arbitration_vote_v3` | 发起争议并由固定面板按门槛投票。 |
| `settle_reward_v3` / `finalize_*_v3` | 按付款条件或仲裁结论结算奖励与保证金。 |
| `refund_bounty_v3` | 仅在没有未解决责任时退款，且受一次性标记保护。 |

V1/V2 历史接口与映射保持兼容；V2 Claim 不会被伪装为 V3 Claim。前端在发起任何真实 Wallet 请求前都会验证公开 Program Edition、ABI 和链上能力。

## 隐私与安全边界

### 不进入公开链或前端持久化的数据

- Private Witness 与所有隐藏变化量；
- Reporter Secret、私有调用序列与私有状态；
- Exploit Path、PoC、触发参数与漏洞明文；
- 加密披露包的明文与解密密钥。

`/api/aleo/prove` 在真实模式明确返回 HTTP `410`。服务器不会接收、证明、打印或保存 Private Witness；真实证明与签名仅在 Leo Wallet 的设备端边界完成。

### 可公开验证的最小状态

| Mapping | 内容 |
| --- | --- |
| `bounties` / `bounty_v3_configs` | 赏金配置、规则、截止高度、付款条件与不可变仲裁配置。 |
| `claim_receipts` / `claim_reporters` | 已验证 Claim 的公开收据与报告人归属。 |
| `nullifiers` | 一次性 Claim 防重放。 |
| `bounty_escrows` / `claim_v3_payouts` | Credits 托管、锁定和最终结算状态。 |
| `claim_v3_states` / `claim_v3_evidence` | 责任披露阶段与最小证据承诺。 |
| `claim_v3_arbitration_*` | 争议投票、门槛与裁决状态。 |
| `*_operation_markers` | 充值、锁定、披露、付款、退款等操作的重放保护。 |

公开注册表只展示可验证元数据，并明确标注 `Exploit Details: Hidden` 与 `Private Witness: Never Stored`。

## DemoVault：安全演示边界

项目使用四个虚构的 DemoVault 约束来演示证明语义：

1. `vaultBalance >= totalClaims`
2. `totalClaims <= totalDeposits`
3. `reservedRewards <= vaultBalance`
4. `withdrawLimit <= vaultBalance`

它们不扫描真实合约、不生成攻击载荷，也不证明外部生产系统真实存在漏洞。V3 可绑定目标系统承诺与代码哈希，但 DemoVault 电路尚不验证外部链状态或真实执行记录；生产化需要接入可验证状态根、认证测试记录或目标链执行证明。

## 架构

```text
Next.js DApp
  ├─ 公开 Registry 读取 ──────────────> Provable 公共 API
  ├─ Leo Wallet（用户人工签名） ─────> Aleo Testnet Transaction
  └─ Device-side private boundary
       ├─ DemoVault witness
       ├─ Reporter Secret
       └─ encrypted disclosure plaintext

zkbugbounty_7f3c92.aleo
  ├─ Claim Receipt + Nullifier + Reporter
  ├─ Bounty / Escrow / Payout mappings
  └─ V3 disclosure / dispute / arbitration state
```

Real Mode 从不回退到 Mock、localStorage 或服务端私有证明。Demo Mode 仅用于安全的产品走查，不能替代任何链上验收。

## 本地运行与验证

### 环境

- Node.js 20+
- npm
- Leo 4.4（编译 Leo Program 时需要）
- Leo Wallet 浏览器扩展（真实 Testnet 钱包操作时需要）

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

```bash
npm run test
npm run lint
npm run build
npm run leo:build
```

下列命令只查询公开 Testnet 信息，不要求密钥、不签名也不广播：

```bash
npm run verify:testnet-edition-1
npm run verify:testnet-edition-2
npm run verify:testnet-edition-4 # 校验当前 Edition 4 公开证据
npm run verify:testnet-mapping -- --mapping bounties --key <bounty_id_field>
```

## 公开资源

- [在线 DApp](https://aleo-gilt.vercel.app)
- [Aleo Program Explorer](https://testnet.explorer.provable.com/program/zkbugbounty_7f3c92.aleo)
- [Protocol V3 设计](docs/protocol-v3-design.zh.md)
- [V3 争议授权与结算矩阵](docs/protocol-v3-dispute-matrix.zh.md)
- [V3 当前操作手册](docs/operation-manual-v3.zh.md)
- [V3 Local Devnode E2E](docs/protocol-v3-devnode-e2e.zh.md)

## 当前限制与下一步

- Edition 4 是当前公开可验证的 V3 版本；Edition 2 与 Edition 3 仅作历史证据，不能用于当前 V3 钱包流程。
- Edition 4 已修复 REMEDIATION 争议无 quorum 超时的链上活性问题；其公开交易、费用交易和哈希记录见 [Edition 4 修复说明](docs/protocol-v3-edition-4-remediation-hardening.zh.md)。
- Credits 结算、重放保护和失败原子性已经在 Local Devnode 完整 E2E 中验证；需要以全新 Testnet 数据完成持续的人工端到端验收。
- V3 页面可在本地生成专用 ECDH 密钥，并从规范化公钥确定性导出链上披露 field 承诺；同时生成/核验绑定到 Claim 的密文包，并为每位仲裁员生成独立证据包。密钥、密文与明文不经服务器或浏览器持久化；真实目标状态仍需外部安全流程和审计。
- 需要正式协议审计，以及超出 DemoVault 的可验证不变量库。

## License

See [LICENSE](LICENSE).
