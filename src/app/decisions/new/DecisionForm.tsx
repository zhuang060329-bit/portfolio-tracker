"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createInvestmentDecision, type DecisionFormState } from "../actions";

type AccountOption = {
  id: string;
  name: string;
  symbol: string | null;
  status: string;
};

type LinkedTransaction = {
  id: string;
  account_id: string;
  type: string;
  created_at: string;
  accounts: { name: string; symbol: string | null } | null;
};

const inputClass =
  "mt-1.5 w-full rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 py-2.5 text-[14px] text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-accent-soft)]";

export function DecisionForm({
  accounts,
  linkedTransaction,
  initialDecisionDate,
  initialReviewDate,
}: {
  accounts: AccountOption[];
  linkedTransaction: LinkedTransaction | null;
  initialDecisionDate: string;
  initialReviewDate: string;
}) {
  const [state, action, pending] = useActionState<DecisionFormState, FormData>(
    createInvestmentDecision,
    undefined,
  );
  const linkedAccountId = linkedTransaction?.account_id ?? "";
  const linkedName = linkedTransaction?.accounts?.name ?? "已刪除帳戶";

  return (
    <form action={action} className="mt-6 space-y-5">
      {linkedTransaction && (
        <aside className="rounded-xl border border-[color-mix(in_srgb,var(--c-accent)_35%,var(--c-border))] bg-[var(--c-accent-soft)] px-4 py-3 text-[13px]">
          <div className="font-semibold">已連結交易 · {linkedName}</div>
          <div className="mt-1 text-[var(--c-muted)]">
            類型 {linkedTransaction.type} · 交易識別碼 {linkedTransaction.id.slice(0, 8)}…
          </div>
          <input type="hidden" name="transactionId" value={linkedTransaction.id} />
          <input type="hidden" name="accountId" value={linkedAccountId} />
        </aside>
      )}

      <FormSection title="決策與標的">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="決策日期" required>
            <input className={inputClass} type="date" name="decisionDate" defaultValue={initialDecisionDate} required />
          </Field>
          <Field label="決策類型" required>
            <select className={inputClass} name="decisionType" defaultValue="buy" required>
              <option value="buy">買進</option>
              <option value="add">加碼</option>
              <option value="reduce">減碼</option>
              <option value="sell">賣出</option>
              <option value="hold">續抱</option>
              <option value="avoid">不採取</option>
            </select>
          </Field>
          {!linkedTransaction && (
            <Field label="關聯帳戶" hint="可留空；留空時情境快照不含持倉資料。">
              <select className={inputClass} name="accountId" defaultValue="">
                <option value="">不連結帳戶</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.symbol ? ` · ${account.symbol}` : ""}{account.status === "archived" ? "（已封存）" : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="標的名稱" required>
            <input className={inputClass} name="assetName" defaultValue={linkedName === "已刪除帳戶" ? "" : linkedName} maxLength={120} required />
          </Field>
          <Field label="代號">
            <input className={inputClass} name="symbol" defaultValue={linkedTransaction?.accounts?.symbol ?? ""} maxLength={40} autoCapitalize="characters" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="事前論證">
        <Field label="投資論點" hint="寫下可被驗證的主張，不要只寫價格會漲。" required>
          <textarea className={`${inputClass} min-h-28 resize-y`} name="thesis" maxLength={4000} required />
        </Field>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="可能催化劑">
            <textarea className={`${inputClass} min-h-24 resize-y`} name="catalysts" maxLength={3000} />
          </Field>
          <Field label="主要風險" required>
            <textarea className={`${inputClass} min-h-24 resize-y`} name="risks" maxLength={3000} required />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="失效條件" hint="什麼證據出現時，這個論點不再成立？" required>
            <textarea className={`${inputClass} min-h-24 resize-y`} name="invalidationConditions" maxLength={3000} required />
          </Field>
        </div>
      </FormSection>

      <FormSection title="預期與檢討">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="預期持有（月）" required>
            <input className={inputClass} type="number" name="expectedHoldingMonths" min={1} max={600} defaultValue={24} required />
          </Field>
          <Field label="目標報酬下限（%）">
            <input className={inputClass} type="number" name="targetReturnMinPct" step="0.1" min={-100} />
          </Field>
          <Field label="目標報酬上限（%）">
            <input className={inputClass} type="number" name="targetReturnMaxPct" step="0.1" min={-100} />
          </Field>
          <Field label="最大可接受跌幅（%）">
            <input className={inputClass} type="number" name="maxDrawdownPct" step="0.1" min={0} max={100} />
          </Field>
          <Field label="信心程度" required>
            <select className={inputClass} name="confidence" defaultValue="2" required>
              <option value="1">1 · 低</option>
              <option value="2">2 · 中</option>
              <option value="3">3 · 高</option>
            </select>
          </Field>
          <Field label="預定檢討日" required>
            <input className={inputClass} type="date" name="reviewDate" defaultValue={initialReviewDate} required />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="標籤" hint="以逗號分隔，最多 12 個。">
            <input className={inputClass} name="tags" maxLength={400} placeholder="長期配置, 估值, 科技" />
          </Field>
        </div>
      </FormSection>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-[color-mix(in_srgb,var(--c-down)_10%,transparent)] px-4 py-3 text-[13px] text-[var(--c-down)]">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <Link href="/decisions" className="rounded-[var(--r-control)] border border-[var(--c-border)] px-4 py-2.5 text-[13.5px] hover:bg-[var(--c-surface-soft)]">
          取消
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--r-control)] bg-[var(--c-accent)] px-5 py-2.5 text-[13.5px] font-semibold text-[var(--c-btn-strong-text)] hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "儲存中…" : "儲存決策與情境"}
        </button>
      </div>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] sm:p-6">
      <h2 className="mb-4 font-serif text-xl font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[13px] font-medium">
      {label}{required && <span className="ml-1 text-[var(--c-down)]">*</span>}
      {hint && <span className="mt-0.5 block text-[11.5px] font-normal text-[var(--c-muted)]">{hint}</span>}
      {children}
    </label>
  );
}
