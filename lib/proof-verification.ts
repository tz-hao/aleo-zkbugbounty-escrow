import type { ProofVerification, Severity } from "./models.ts";

export function getVerificationLabel(verification?: ProofVerification) {
  if (verification?.level === "NetworkConfirmed") return "Aleo Network Confirmed";
  if (verification?.level === "RemoteExecution") return "Remote Leo Execution";
  if (verification?.level === "LocalExecution") return "Local Leo Execution";
  if (verification?.level === "Simulation") return "Mock Simulation";
  return "Verification Unavailable";
}

export function getVerificationStatement(verification?: ProofVerification) {
  if (verification?.level === "NetworkConfirmed") {
    return "Proof: Aleo Network Confirmed｜DemoVault 约束执行已确认，未绑定目标合约 State Root";
  }
  if (verification?.level === "RemoteExecution") {
    return "Proof: Remote Leo Execution｜远程执行，尚非链上确认";
  }
  if (verification?.level === "LocalExecution") {
    return "Proof: Local Leo Execution｜本地执行，尚非链上确认";
  }
  if (verification?.level === "Simulation") {
    return "Proof: Mock Simulation｜模拟验证，不是链上 Proof";
  }
  return "Proof: Unavailable｜当前没有可验证 Proof";
}

export function getImpactBand(severity: Severity) {
  if (severity === "Critical") return "100+（Severity 下界）";
  if (severity === "High") return "50-99（Severity 区间）";
  if (severity === "Medium") return "10-49（Severity 区间）";
  return "0-9（Severity 区间）";
}
