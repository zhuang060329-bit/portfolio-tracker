"use client";

import { useActionState, useId } from "react";
import {
  createRecurringPlan,
  deletePlan,
  togglePlan,
  type FormState,
} from "./actions";
import { executePlan } from "./recurring-execution-action";

export type Plan = {
  id: string;
  amount_twd: number;
  day_of_month: number;
  start_date: string;
  next_run_date: string;
  last_run_date: string | null;
  active: boolean;
  note: string | null;
};

const fmtTwd = (value: number) =>
  value.toLocaleString("zh-TW", { maximumFractionDigits: 0 });

// 定期定額區塊的控制項高度。小螢幕 44px（WCAG 2.5.5 舒適觸控值），
// sm 以上是滑鼠操作，收到 34px 以免這排在桌機變得笨重。
// 這排按鈕原本只有 28-30px，手指點「暫停」很容易誤中旁邊的「刪除」。
const controlH = "h-11 sm:h-[34px]";

// 新增計劃表單是堆疊的完整欄位，桌機給到 38px 與 app 其他表單接近，
// 不套用上面那排行內控制項的 34px。
const controlFieldH = "h-11 sm:h-[38px]";

function PlanRow({ plan }: { plan: Plan }) {
  const amountFieldId = useId();
  const [execState, execAction, execPending] = useActionState<FormState, FormData>(
    executePlan,
    undefined,
  );
  const [toggleState, toggleAction, togglePending] = useActionState<
    FormState,
    FormData
  >(togglePlan, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState<
    FormState,
    FormData
  >(deletePlan, undefined);

  const error =
    execState?.error || toggleState?.error || deleteState?.error;
  const success = execState?.ok || toggleState?.ok || deleteState?.ok;

  return (
    <div
      className={`rounded-[var(--r-card)] border border-[var(--c-border)] p-4 ${
        plan.active
          ? "bg-[var(--c-surface)]"
          : "bg-[var(--c-surface-soft)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium [font-variant-numeric:lining-nums_tabular-nums]">
            每月 {plan.day_of_month} 日{" "}
            <span className="text-[var(--c-muted)]">·</span>{" "}
            <span className="amt">NT$ {fmtTwd(Number(plan.amount_twd))}</span>
          </div>
          <div className="mt-1 text-xs text-[var(--c-muted)]">
            下次{" "}
            <span className="text-[var(--c-text)]">{plan.next_run_date}</span>
            {plan.last_run_date && (
              <>
                <span className="mx-1 text-[var(--c-faint)]">·</span>
                上次 {plan.last_run_date}
              </>
            )}
            {!plan.active && (
              <span className="ml-2 rounded-[var(--r-pill)] bg-[var(--c-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--c-muted)]">
                Paused
              </span>
            )}
          </div>
          {plan.note && (
            <div className="mt-1 text-xs text-[var(--c-muted)]">
              備註：{plan.note}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            action={execAction}
            className="flex basis-full items-center gap-1.5 sm:basis-auto"
          >
            <input type="hidden" name="planId" value={plan.id} />
            <label htmlFor={amountFieldId} className="sr-only">
              本期金額（TWD），留空沿用計劃金額
            </label>
            <div className="relative flex-1 sm:flex-none">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--c-faint)]"
              >
                NT$
              </span>
              <input
                // 排程日一推進就重新掛載，把金額重設回計劃預設值。
                // 否則 defaultValue 只在掛載時生效，上期打的覆寫金額會留在框裡，
                // 下期不小心直接送出就沿用了上期的加減碼決定。
                key={plan.next_run_date}
                id={amountFieldId}
                name="amount"
                type="number"
                step="any"
                // 金額欄位是 numeric(20,2)，RPC 也先 round 到 2 位才驗證正數。
                // min 設 0 會讓 0 通過瀏覽器驗證、白跑一趟 server 才被擋。
                min="0.01"
                disabled={!plan.active}
                defaultValue={Number(plan.amount_twd)}
                className={`${controlH} w-full rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] py-0 pl-9 pr-2 text-right text-xs text-[var(--c-text)] tnum outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)] disabled:opacity-40 sm:w-[118px]`}
              />
            </div>
            <button
              type="submit"
              disabled={execPending || !plan.active}
              className={`${controlH} inline-flex shrink-0 items-center rounded-[var(--r-control)] bg-[var(--c-accent)] px-3 text-xs font-semibold text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-40`}
            >
              {execPending ? "執行中…" : "立即執行"}
            </button>
          </form>
          <form action={toggleAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <input
              type="hidden"
              name="newActive"
              value={plan.active ? "false" : "true"}
            />
            <button
              type="submit"
              disabled={togglePending}
              className={`${controlH} inline-flex items-center rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-xs text-[var(--c-text)] hover:bg-[var(--c-page)] disabled:opacity-50`}
            >
              {plan.active ? "暫停" : "啟用"}
            </button>
          </form>
          <form action={deleteAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <button
              type="submit"
              disabled={deletePending}
              className={`${controlH} inline-flex items-center rounded-[var(--r-control)] px-2.5 text-xs text-[var(--c-muted)] underline hover:text-[var(--c-down)] disabled:opacity-50`}
            >
              刪除
            </button>
          </form>
        </div>
      </div>
      {error && (
        <p className="mt-2 rounded-[var(--r-control)] border border-[color-mix(in_srgb,var(--c-down)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-down)_10%,var(--c-surface))] px-2 py-1 text-xs text-[var(--c-down)]">
          {error}
        </p>
      )}
      {success && !error && (
        <p className="mt-2 rounded-[var(--r-control)] border border-[color-mix(in_srgb,var(--c-up)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-up)_10%,var(--c-surface))] px-2 py-1 text-xs text-[var(--c-up)]">
          {success}
        </p>
      )}
    </div>
  );
}

function AddPlanForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createRecurringPlan,
    undefined,
  );

  return (
    <details className="rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)]">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
        新增定期定額計劃
      </summary>
      <form
        action={action}
        className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4"
      >
        <input type="hidden" name="accountId" value={accountId} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            每次金額（TWD）
            <input
              name="amount"
              type="number"
              step="any"
              min="0"
              required
              placeholder="例：10000"
              className={`mt-1 ${controlFieldH} rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-2.5 text-sm text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
            每月幾日扣款（1-28）
            <input
              name="dayOfMonth"
              type="number"
              min="1"
              max="28"
              required
              defaultValue="5"
              className={`mt-1 ${controlFieldH} rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-2.5 text-sm text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]`}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
          起始日期（留空 = 今天）
          <input
            name="startDate"
            type="date"
            className={`mt-1 ${controlFieldH} rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-2.5 text-sm text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
          備註（選填）
          <input
            name="note"
            type="text"
            placeholder="例：薪資自動撥入"
            className={`mt-1 ${controlFieldH} rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-2.5 text-sm text-[var(--c-text)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] focus:shadow-[0_0_0_3px_var(--c-accent-soft)]`}
          />
        </label>
        {state?.error && (
          <p className="rounded-[var(--r-control)] border border-[color-mix(in_srgb,var(--c-down)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-down)_10%,var(--c-surface))] px-2 py-1 text-xs text-[var(--c-down)]">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`${controlFieldH} inline-flex items-center self-start rounded-[var(--r-control)] bg-[var(--c-btn-strong-bg)] px-4 text-sm font-medium text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50`}
        >
          {pending ? "建立中…" : "建立計劃"}
        </button>
      </form>
    </details>
  );
}

export function RecurringPlans({
  plans,
  accountId,
}: {
  plans: Plan[];
  accountId: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {plans.length > 0 ? (
        <div className="flex flex-col gap-2">
          {plans.map((plan) => (
            <PlanRow key={plan.id} plan={plan} />
          ))}
        </div>
      ) : (
        <p className="rounded-[var(--r-card)] border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-6 text-center text-xs text-[var(--c-muted)]">
          尚無定期定額計劃。展開下方表單建立第一個。
        </p>
      )}
      <AddPlanForm accountId={accountId} />
    </div>
  );
}
