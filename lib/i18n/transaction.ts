import type { AleoTransactionState } from "@/lib/aleo-transaction-status";

type TextSelector = (chinese: string, english: string) => string;

const transactionMessages: Record<AleoTransactionState, readonly [string, string]> = {
  idle: ["尚未创建交易请求。", "No transaction request has been created."],
  wallet_disconnected: ["钱包尚未连接。", "Wallet is not connected."],
  wrong_network: ["钱包当前不在 Aleo 测试网。", "Wallet is not on Aleo Testnet."],
  awaiting_signature: ["正在等待钱包签名。", "Waiting for Wallet signature."],
  signature_rejected: ["交易已取消或钱包签名被拒绝。", "The transaction was cancelled or the Wallet signature was rejected."],
  generating_transaction: ["正在生成钱包交易请求。", "Generating the Wallet transaction request."],
  broadcasting: ["钱包正在广播交易。", "Wallet is broadcasting the transaction."],
  pending: ["交易已提交，正在等待测试网索引或确认。", "The transaction was submitted and is awaiting Testnet indexing or confirmation."],
  accepted: ["交易已被节点接受，仍需等待链上确认与映射核验。", "The transaction was accepted by the node and still requires on-chain confirmation and Mapping verification."],
  confirmed: ["交易已在链上确认。", "The transaction is confirmed on-chain."],
  rejected: ["交易已被 Aleo 测试网明确拒绝。", "The transaction was explicitly rejected by Aleo Testnet."],
  failed: ["交易未能完成。", "The transaction could not be completed."],
  timeout: ["在限定时间内未获得交易确认。", "Transaction confirmation was not received within the time limit."],
};

export function getLocalizedTransactionMessage(state: AleoTransactionState, text: TextSelector) {
  const [chinese, english] = transactionMessages[state];
  return text(chinese, english);
}