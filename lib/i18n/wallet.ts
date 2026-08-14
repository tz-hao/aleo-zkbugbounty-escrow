type TextSelector = (chinese: string, english: string) => string;

const walletMessages: Record<string, readonly [string, string]> = {
  "当前浏览器未检测到 Shield 扩展。请使用已安装该扩展的 Chrome 或 Edge 打开本站。": ["当前浏览器未检测到 Shield 扩展。请使用已安装该扩展的 Chrome 或 Edge 打开本站。", "Shield was not detected. Open this site in Chrome or Edge with the extension installed."],
  "检测到 Shield，但扩展接口不可用。请更新扩展、解锁钱包并刷新页面。": ["检测到 Shield，但扩展接口不可用。请更新扩展、解锁钱包并刷新页面。", "Shield was detected, but its extension interface is unavailable. Update and unlock it, then refresh the page."],
  "Shield 已注入，但适配器尚未就绪。请刷新页面后重新连接。": ["Shield 已加载，但钱包适配器尚未就绪。请刷新页面后重新连接。", "Shield is injected, but the wallet adapter is not ready. Refresh the page and reconnect."],
  "Shield 已响应，但返回的公开地址格式无效。请更新扩展并刷新页面后重试。": ["Shield 已响应，但返回的公开地址格式无效。请更新扩展并刷新页面后重试。", "Shield responded with an invalid public address. Update the extension, refresh the page, and try again."],
  "Shield 授权被取消或拒绝。请在扩展中移除本站授权后重新连接。": ["Shield 授权被取消或拒绝。请在扩展中移除本站授权后重新连接。", "Shield authorization was cancelled or rejected. Remove this site from the extension, then authorize it again."],
  "Shield 当前网络与 Aleo Testnet 不一致。请切换到 Testnet 后重新连接。": ["Shield 当前网络与 Aleo 测试网不一致。请切换到测试网后重新连接。", "Shield is not on Aleo Testnet. Switch to Testnet and reconnect."],
  "Shield 授权窗口未打开或已关闭。请允许本站弹窗后重新连接。": ["Shield 授权窗口未打开或已关闭。请允许本站弹窗后重新连接。", "The Shield authorization window did not open or was closed. Allow pop-ups and reconnect."],
  "Shield 已安装但当前不可用。请解锁扩展并刷新页面后重试。": ["Shield 已安装但当前不可用。请解锁扩展并刷新页面后重试。", "Shield is installed but unavailable. Unlock it, refresh the page, and try again."],
  "Shield 返回连接错误。请解锁扩展，并重新授权本站。": ["Shield 返回连接错误。请解锁扩展，并重新授权本站。", "Shield returned a connection error. Unlock it and authorize this site again."],
  "钱包已返回 Public Transaction ID；仍需等待链上 Confirmed。": ["钱包已返回公开交易编号；仍需等待链上确认。", "The Wallet returned a public Transaction ID. On-chain confirmation is still required."],
  "钱包已接收请求；返回值尚不能作为公开 Transaction ID，这不等于链上 Confirmed。": ["钱包已接收请求；返回值尚不能作为公开交易编号，也不代表链上已确认。", "The Wallet accepted the request, but the response is not yet a public Transaction ID or on-chain confirmation."],
  "钱包已返回 Public Transaction ID；仍需等待链上 Confirmed 与 claim_receipts mapping 验证。": ["钱包已返回公开交易编号；仍需等待链上确认，并验证 claim_receipts 映射。", "The Wallet returned a public Transaction ID. On-chain confirmation and claim_receipts Mapping verification are still required."],
  "钱包已接收 submit_claim；返回值目前只是 Wallet Request ID，不代表链上 Confirmed。": ["钱包已接收 submit_claim；当前返回值只是钱包请求编号，不代表链上已确认。", "The Wallet accepted submit_claim. The current response is only a Wallet Request ID, not on-chain confirmation."],  "钱包已返回 Public Transaction ID；仍需等待链上 Confirmed、Claim Receipt、Reporter 与 Nullifier Mapping 验证。": ["钱包已返回公开交易编号；仍需等待链上确认，并验证漏洞声明收据、报告人和防重复标识映射。", "The Wallet returned a public Transaction ID. On-chain confirmation and Claim Receipt, Reporter, and Nullifier Mapping verification are still required."],
  "钱包已接收 submit_claim_v2；当前返回值只是 Wallet Request ID，不代表链上 Confirmed。": ["钱包已接收 submit_claim_v2；当前返回值只是钱包请求编号，不代表链上已确认。", "The Wallet accepted submit_claim_v2. The current response is only a Wallet Request ID, not on-chain confirmation."],
  "钱包已返回 Public Transaction ID；仍需等待链上 Confirmed 与 duplicate nullifier 验证。": ["钱包已返回公开交易编号；仍需等待链上确认，并验证重复防重复标识保护。", "The Wallet returned a public Transaction ID. On-chain confirmation and duplicate Nullifier verification are still required."],
  "钱包已接收受控 submit_claim；返回值目前只是 Wallet Request ID，不代表链上 Confirmed。": ["钱包已接收受控 submit_claim；当前返回值只是钱包请求编号，不代表链上已确认。", "The Wallet accepted the controlled submit_claim. The current response is only a Wallet Request ID, not on-chain confirmation."],
  "Wallet 已返回公开 Transaction ID；仍需等待 Confirmed 与 Mapping Verified。": ["钱包已返回公开交易编号；仍需等待链上确认与映射验证。", "The Wallet returned a public Transaction ID. On-chain confirmation and Mapping verification are still required."],
  "Wallet 已接收协议交易；当前返回值不能视为链上 Confirmed。": ["钱包已接收协议交易；当前返回值不能视为链上已确认。", "The Wallet accepted the protocol transaction. The response is not on-chain confirmation."],
  "钱包处理已 Finalized；仍需使用公开 Transaction ID 验证链上交易与 mapping。": ["钱包处理已完成；仍需使用公开交易编号验证链上交易与映射。", "Wallet processing is finalized. Verify the on-chain transaction and Mapping with the public Transaction ID."],
  "钱包报告交易失败或拒绝。": ["钱包报告交易失败或被拒绝。", "The Wallet reported that the transaction failed or was rejected."],
  "暂时无法读取钱包请求状态，请稍后重试。": ["暂时无法读取钱包请求状态，请稍后重试。", "The Wallet request status is temporarily unavailable. Try again later."],
  "钱包处理已 Finalized；仍需用公开 Transaction ID 验证 claim receipt 与 nullifier mapping。": ["钱包处理已完成；仍需使用公开交易编号验证漏洞声明收据与防重复标识映射。", "Wallet processing is finalized. Verify the Claim Receipt and Nullifier Mapping with the public Transaction ID."],
  "钱包报告 submit_claim 失败或拒绝；没有生成链上 Claim Receipt。": ["钱包报告 submit_claim 失败或被拒绝；未生成链上漏洞声明收据。", "The Wallet reported that submit_claim failed or was rejected. No on-chain Claim Receipt was created."],
  "暂时无法读取 Wallet Request 状态，请稍后重试。": ["暂时无法读取钱包请求状态，请稍后重试。", "The Wallet request status is temporarily unavailable. Try again later."],
  "Wallet 处理已 Finalized；仍需核验公开 Transaction 与协议 Mapping。": ["钱包处理已完成；仍需核验公开交易与协议映射。", "Wallet processing is finalized. Verify the public transaction and protocol Mapping."],
  "Wallet 报告协议交易失败或拒绝；不得更新链上状态。": ["钱包报告协议交易失败或被拒绝；不得更新链上状态。", "The Wallet reported that the protocol transaction failed or was rejected. On-chain state must not be updated."],
};

export function getLocalizedWalletMessage(message: string, text: TextSelector) {
  const direct = walletMessages[message];
  if (direct) return text(direct[0], direct[1]);
  const walletStatus = /^钱包状态：(.*)$/.exec(message);
  if (walletStatus) return text(`钱包状态：${walletStatus[1]}`, `Wallet status: ${walletStatus[1]}`);
  return message;
}
