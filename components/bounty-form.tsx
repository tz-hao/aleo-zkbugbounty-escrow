"use client";

import { useState, type FormEvent } from "react";
import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { DEMO_VAULT_RULES, getDemoVaultRule } from "@/lib/demo-vault";
import { canCreateBounty } from "@/lib/permissions";
import { useAppState } from "./app-state-provider";
import { getChineseProtocolValue, zh } from "@/lib/i18n/zh";
import { ExecutionStatusBadge } from "./execution-status-badge";

const ruleSelectorOrder = [
  "Vault Accounting Safety",
  "Claims vs Deposits Safety",
  "Reward Reserve Safety",
  "Withdrawal Limit Safety",
];

export function BountyForm() {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const allowed = canCreateBounty(state.currentActor);
  const [projectName, setProjectName] = useState("演示金库");
  const [scope, setScope] = useState("Vault accounting logic");
  const [bountyAmount, setBountyAmount] = useState("100");
  const [criticalReward, setCriticalReward] = useState("100");
  const [highReward, setHighReward] = useState("50");
  const [mediumReward, setMediumReward] = useState("20");
  const [lowReward, setLowReward] = useState("5");
  const [ruleId, setRuleId] = useState(DEMO_VAULT_RULES[0].id);
  const [disclosureDeadline, setDisclosureDeadline] = useState("7 days after verified claim");
  const selectedRule = getDemoVaultRule(ruleId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowed) {
      return;
    }
    dispatch({
      type: "createBounty",
      input: {
        projectName,
        scope,
        bountyAmount: Number(bountyAmount),
        rewards: {
          critical: Number(criticalReward),
          high: Number(highReward),
          medium: Number(mediumReward),
          low: Number(lowReward),
        },
        ruleId,
        ruleText: selectedRule.invariantText,
        disclosureDeadline,
      },
    });
    router.push("/submit-proof");
  }

  return (
    <form className="surface-card grid gap-5 rounded-lg p-5 sm:p-6" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <ExecutionStatusBadge kind="local" />
          <h2 className="mt-3 text-xl font-semibold text-white">本地演示 Bounty</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-400">
          Data Source: Demo Local State。此流程不会创建 Aleo Testnet transaction，也不代表链上成功。
        </p>
      </div>
      {!allowed ? (
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm text-amber-100">
          当前 Demo Preview 视角不能创建本地 Bounty。请在上方演示设置中切换为 Project Owner；这不会改变钱包或链上权限。
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
              {zh.createBounty.fields.projectName}
          <input
            className="focus-ring input-surface rounded-lg px-3 py-3"
            disabled={!allowed}
            onChange={(event) => setProjectName(event.target.value)}
            required
            value={projectName}
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
              {zh.createBounty.fields.deadline}
          <input
            className="focus-ring input-surface rounded-lg px-3 py-3"
            disabled={!allowed}
            onChange={(event) => setDisclosureDeadline(event.target.value)}
            required
            value={disclosureDeadline}
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm text-slate-300">
        {zh.createBounty.fields.scope}
        <textarea
          className="focus-ring input-surface min-h-24 rounded-lg px-3 py-3"
          disabled={!allowed}
          onChange={(event) => setScope(event.target.value)}
          required
          value={scope}
        />
      </label>
      <label className="grid gap-2 text-sm text-slate-300">
        {zh.createBounty.fields.rule}
        <select
        className="focus-ring rounded-lg border border-violet-300/20 bg-violet-300/8 px-3 py-3 font-mono text-violet-100 disabled:text-slate-500"
          disabled={!allowed}
          onChange={(event) => setRuleId(event.target.value as typeof ruleId)}
          required
          value={ruleId}
        >
          {DEMO_VAULT_RULES.filter((rule) => ruleSelectorOrder.includes(rule.name)).map((rule) => (
            <option className="bg-slate-950" key={rule.id} value={rule.id}>
              {zh.rules[rule.id].name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 rounded-lg border border-violet-300/20 bg-violet-300/8 p-4 text-sm text-violet-100 md:grid-cols-2">
        <div>
          <p className="text-xs tracking-normal text-violet-200/80">{zh.createBounty.fields.ruleName}</p>
          <p className="mt-1 font-semibold text-white">{zh.rules[selectedRule.id].name}</p>
        </div>
        <div>
          <p className="text-xs tracking-normal text-violet-200/80">{zh.createBounty.fields.affectedModule}</p>
          <p className="mt-1 text-white">{getChineseProtocolValue(selectedRule.affectedModule)}</p>
        </div>
        <div>
          <p className="text-xs tracking-normal text-violet-200/80">安全不变量</p>
          <p className="mt-1 font-mono text-white">{selectedRule.invariantText}</p>
        </div>
        <div>
          <p className="text-xs tracking-normal text-violet-200/80">{zh.createBounty.fields.description}</p>
          <p className="mt-1 text-white">{zh.rules[selectedRule.id].description}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        <NumberField disabled={!allowed} label={zh.createBounty.fields.pool} onChange={setBountyAmount} value={bountyAmount} />
        <NumberField disabled={!allowed} label="严重级奖励" onChange={setCriticalReward} value={criticalReward} />
        <NumberField disabled={!allowed} label="高危奖励" onChange={setHighReward} value={highReward} />
        <NumberField disabled={!allowed} label="中危奖励" onChange={setMediumReward} value={mediumReward} />
        <NumberField disabled={!allowed} label="低危奖励" onChange={setLowReward} value={lowReward} />
      </div>
      <button
        className="focus-ring primary-action w-fit disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
        disabled={!allowed}
      >
        <PlusCircle size={17} aria-hidden="true" />
        {zh.createBounty.submit}
      </button>
    </form>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      {label}
      <input
        className="focus-ring input-surface rounded-lg px-3 py-3"
        disabled={disabled}
        min="0"
        onChange={(event) => onChange(event.target.value)}
        required
        type="number"
        value={value}
      />
    </label>
  );
}
