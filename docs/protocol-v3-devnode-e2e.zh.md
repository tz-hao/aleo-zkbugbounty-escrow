# Protocol V3 本地 Devnode E2E

该入口只连接 `127.0.0.1:3030` 的一次性 Leo Devnode，不访问 Aleo Testnet，也不使用管理员钱包。

## 运行

在 WSL 的项目根目录执行：

~~~bash
npm run test:protocol-v3-devnode
~~~

按提示输入三组仅用于本地 Devnode 的一次性账户：

- Owner
- Whitehat
- Arbiter 1

脚本在内存中另外生成 Arbiter 2 和 Arbiter 3，并把三人面板写入该 Bounty 的不可变 V3 配置。不要输入 Testnet、浏览器钱包或生产管理员凭据。

## 覆盖范围

V3 扩展在原有 Edition 0 → Edition 1 与 V2 托管验证之后继续执行：

1. 创建带目标承诺、披露密钥承诺、2-of-3 仲裁面板、SLA 和保证金的 V3 Bounty。
2. 充值真实本地 Credits。
3. 白帽提交绑定目标系统、代码、状态、执行和报告承诺的 V3 Claim。
4. 项目方开始审核、受理并单独锁定奖励。
5. 白帽交付加密包承诺，项目方确认接收并提交复现结论。
6. 第一条争议由两个仲裁员判定为 High，合约支付奖励、退回保证金并释放差额。
7. 第二条争议由两个仲裁员驳回，同时验证同一仲裁员不能重复投票。
8. 合约退还保证金、解锁奖励、关闭 Bounty，并在截止高度后退回剩余托管资金。
9. 核对 Program、Owner、Whitehat 的 Credits 守恒及所有关键 Mapping 终态。

## 安全边界

- 所有私钥只存在于当前 Shell 进程，脚本退出时清空。
- 公共报告只记录本地交易 ID、Mapping 键和步骤状态。
- 私有 witness、reporter secret、加密报告正文和签名载荷不会写入报告。
- 默认的 `npm run test:escrow-devnode` 仍只运行原 V1/V2 流程；只有 V3 包装入口会设置 `ZKBB_RUN_PROTOCOL_V3=1`。
- 此验证不能替代 Testnet Edition 2 升级、公开交易证据验证或外部安全审计。
