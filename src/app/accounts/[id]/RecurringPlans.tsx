"use client";

import { useActionState, useId } from "react";
import {
  createRecurringPlan,
  deletePlan,
  togglePlan,
  type FormState,
} from "./actions";
import { executePlan } from "./recurring-execution-action";
import { useActionAnnounce } from "@/components/a11y/use-action-announce";

export type Plan = {
  id: string;
  amount_twd: number;
  /** 每期固定手續費。舊資料在 migration 前沒有這欄，讀到 null 一律當 0。 */
  fee_twd: number | null;
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
  const feeFieldId = useId();
  const planFee = Number(plan.fee_twd ?? 0);
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

  // 這三支成功時都回 ok 字串（已執行本期定期定額／計畫已暫停／計畫已刪除），
  // hook 直接沿用，不另外給成功句。
  useActionAnnounce(execState, execPending);
  useActionAnnounce(toggleState, togglePending);
  useActionAnnounce(deleteState, deletePending);

  const error =
    execState?.error || toggleState?.error || deleteState?.error;
  const success = execState?.ok || toggleState?.ok || deleteState?.ok;

  return (
    <div
      className={`border border-[var(--c-border)] p-4 ${
        plan.active
          ? "bg-[var(--c-surface)]"
          : "bg-[var(--c-surface-soft)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[length:var(--fs-sm)] font-medium tnum">
            每月 {plan.day_of_month} 日{" "}
            <span className="text-[var(--c-muted)]">·</span>{" "}
            <span className="amt">NT$ {fmtTwd(Number(plan.amount_twd))}</span>
            {planFee > 0 && (
              <span className="ml-1.5 text-[length:var(--fs-micro)] font-normal text-[var(--c-muted)]">
                （含手續費 NT$ {fmtTwd(planFee)}）
              </span>
            )}
          </div>
          <div className="mt-1 text-[length:var(--fs-micro)] text-[var(--c-muted)] tnum">
            下次{" "}
            <span className="text-[var(--c-text)]">{plan.next_run_date}</span>
            {plan.last_run_date && (
              <>
                <span className="mx-1 text-[var(--c-faint)]">·</span>
                上次 {plan.last_run_date}
              </>
            )}
            {!plan.active && (
              <span className="ml-2 inline-block border border-[var(--c-line-strong)] px-1.5 py-px text-[length:var(--fs-micro)] font-semibold text-[var(--c-muted)]">
                已暫停
              </span>
            )}
          </div>
          {plan.note && (
            <div className="mt-1 text-[length:var(--fs-micro)] text-[var(--c-muted)]">
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
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[length:var(--fs-micro)] text-[var(--c-faint)]"
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
                className={`${controlH} field w-full py-0 pl-9 pr-2 text-right tnum disabled:opacity-40 sm:w-[118px]`}
              />
            </div>
            <label htmlFor={feeFieldId} className="sr-only">
              本期手續費（TWD），留空沿用計劃設定
            </label>
            <div className="relative flex-1 sm:flex-none">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[length:var(--fs-micro)] text-[var(--c-faint)]"
              >
                費
              </span>
              <input
                // 與金額欄同理：排程日推進就重新掛載，避免上期的手續費留在框裡。
                key={plan.next_run_date}
                id={feeFieldId}
                name="fee"
                type="number"
                step="any"
                min="0"
                disabled={!plan.active}
                defaultValue={planFee}
                className={`${controlH} field w-full py-0 pl-7 pr-2 text-right tnum disabled:opacity-40 sm:w-[86px]`}
              />
            </div>
            <button
              type="submit"
              disabled={execPending || !plan.active}
              className={`${controlH} btn btn-neutral btn-sm btn-fit shrink-0`}
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
              className={`${controlH} btn btn-outline btn-sm btn-fit`}
            >
              {plan.active ? "暫停" : "啟用"}
            </button>
          </form>
          <form action={deleteAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <button
              type="submit"
              disabled={deletePending}
              className={`${controlH} btn btn-ghost btn-ghost-danger btn-sm btn-fit underline`}
            >
              刪除
            </button>
          </form>
        </div>
      </div>
      {error && (
        <p className="mt-3 border border-[var(--c-down)] px-3 py-2 text-[length:var(--fs-sm)] text-[var(--c-down)]">
          {error}
        </p>
      )}
      {success && !error && (
        <p className="mt-3 border border-[var(--c-up)] px-3 py-2 text-[length:var(--fs-sm)] text-[var(--c-up)]">
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
  // createRecurringPlan 成功時回 ok:「定期定額計畫已建立」。
  useActionAnnounce(state, pending);

  return (
    <details className="border border-[var(--c-border)] bg-[var(--c-surface)]">
      <summary className="cursor-pointer select-none px-4 py-3 text-[length:var(--fs-sm)] font-medium transition-colors hover:bg-[var(--c-row-hover)]">
        新增定期定額計劃
      </summary>
      <form
        action={action}
        className="flex flex-col gap-3 border-t border-[var(--c-border)] p-4"
      >
        <input type="hidden" name="accountId" value={accountId} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px] text-[length:var(--fs-micro)] font-semibold text-[var(--c-muted)]">
            每次金額（TWD）
            <input
              name="amount"
              type="number"
              step="any"
              min="0"
              required
              placeholder="例：10000"
              className={`field ${controlFieldH} py-0`}
            />
          </label>
          <label className="flex flex-col gap-[7px] text-[length:var(--fs-micro)] font-semibold text-[var(--c-muted)]">
            每期手續費（TWD，留空 = 0）
            <input
              name="fee"
              type="number"
              step="any"
              min="0"
              placeholder="例：500"
              className={`field ${controlFieldH} py-0`}
            />
            <span className="font-normal text-[var(--c-muted)]">
              內含於每次金額，扣掉後才換算股數。
            </span>
          </label>
          <label className="flex flex-col gap-[7px] text-[length:var(--fs-micro)] font-semibold text-[var(--c-muted)]">
            每月幾日扣款（1-28）
            <input
              name="dayOfMonth"
              type="number"
              min="1"
              max="28"
              required
              defaultValue="5"
              className={`field ${controlFieldH} py-0`}
            />
          </label>
        </div>
        <label className="flex flex-col gap-[7px] text-[length:var(--fs-micro)] font-semibold text-[var(--c-muted)]">
          起始日期（留空 = 今天）
          <input
            name="startDate"
            type="date"
            className={`field ${controlFieldH} py-0`}
          />
        </label>
        <label className="flex flex-col gap-[7px] text-[length:var(--fs-micro)] font-semibold text-[var(--c-muted)]">
          備註（選填）
          <input
            name="note"
            type="text"
            placeholder="例：薪資自動撥入"
            className={`field ${controlFieldH} py-0`}
          />
        </label>
        {state?.error && (
          <p className="border border-[var(--c-down)] px-3 py-2 text-[length:var(--fs-sm)] text-[var(--c-down)]">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`${controlFieldH} btn btn-neutral btn-fit self-start`}
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
        <p className="border border-dashed border-[var(--c-line-strong)] bg-[var(--c-surface)] px-4 py-6 text-center text-[length:var(--fs-sm)] text-[var(--c-muted)]">
          尚無定期定額計劃。展開下方表單建立第一個。
        </p>
      )}
      <AddPlanForm accountId={accountId} />
    </div>
  );
}
