"use client";

import { useActionState } from "react";
import {
  setAllocationTargets,
  type FormState,
} from "@/lib/profile-actions";

const LABEL: Record<string, string> = {
  stock: "股票",
  crypto: "加密貨幣",
  other_investment: "其他投資",
  liquid_cash: "流動資金",
  fund: "基金",
  precious_metal: "貴金屬",
  fixed_asset: "固定資產",
  receivable: "應收款",
  liability: "負債",
};

export type AllocRow = { cls: string; actual: number; target: number };

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export function AllocationTargets({ rows }: { rows: AllocRow[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    setAllocationTargets,
    undefined,
  );

  const targetSum = rows.reduce((s, r) => s + r.target, 0);

  return (
    <div className="rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">配置目標</h2>
      <p className="mt-1 text-xs text-[var(--c-muted)]">
        配置目標 vs 實際；偏離 ±5% 以上會標紅。設 0 = 不設目標。
      </p>
      <form action={action} className="mt-3 flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-1 text-xs tracking-wider text-[var(--c-faint)]">
          <div>類別</div>
          <div className="w-16 text-right">實際</div>
          <div className="w-20 text-right">目標</div>
          <div className="w-16 text-right">偏離</div>
        </div>
        {rows.map((r) => {
          const drift = r.actual - r.target;
          const has = r.target > 0;
          const tone =
            !has
              ? "text-[var(--c-faint)]"
              : Math.abs(drift) > 5
                ? "text-[var(--c-down)] font-medium"
                : "text-[var(--c-muted)]";
          return (
            <div
              key={r.cls}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 text-sm"
            >
              <div className="text-[var(--c-text)]">{LABEL[r.cls] ?? r.cls}</div>
              <div className="w-16 text-right tabular-nums text-[var(--c-muted)]">
                {fmtPct(r.actual)}
              </div>
              <input
                name={`target_${r.cls}`}
                type="number"
                step="any"
                min="0"
                max="100"
                defaultValue={r.target || ""}
                placeholder="0"
                className="w-20 rounded border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-2 py-1 text-right text-sm tabular-nums text-[var(--c-text)]"
              />
              <div className={`w-16 text-right tabular-nums ${tone}`}>
                {has
                  ? `${drift > 0 ? "+" : drift < 0 ? "−" : ""}${fmtPct(Math.abs(drift))}`
                  : "—"}
              </div>
            </div>
          );
        })}
        {targetSum > 0 && (
          <p
            className={`mt-1 text-xs ${targetSum > 100.5 || targetSum < 99.5 ? "text-[var(--c-down)]" : "text-[var(--c-muted)]"}`}
          >
            目標總和：{targetSum.toFixed(1)}%
            {(targetSum > 100.5 || targetSum < 99.5) && " （總和可低於 100%，但不可超過 100%）"}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-sm bg-[var(--c-btn-strong-bg)] px-4 py-1.5 text-sm font-medium text-[var(--c-btn-strong-text)] hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "儲存中…" : "儲存目標"}
          </button>
          {state?.error && (
            <span className="text-xs text-[var(--c-down)]">{state.error}</span>
          )}
        </div>
      </form>
    </div>
  );
}
