"use client";

import { useActionState } from "react";
import { saveDecisionReview, type DecisionFormState } from "../actions";
import type { DecisionReviewMetrics } from "@/lib/decision-review-metrics";

type ReviewInitial = {
  hypothesis_outcome: string;
  catalyst_outcome: string;
  risk_outcome: string;
  plan_followed: boolean;
  asset_return_pct: number | null;
  twd_return_pct: number | null;
  fx_effect_pct: number | null;
  max_favorable_excursion_pct: number | null;
  max_adverse_excursion_pct: number | null;
  decision_quality: number;
  reflection: string;
  next_improvement: string;
};

const inputClass =
  "mt-1.5 w-full rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3.5 py-2.5 text-[14px] outline-none focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-accent-soft)]";

export function ReviewForm({ decisionId, initial, suggested }: { decisionId: string; initial: ReviewInitial | null; suggested: DecisionReviewMetrics }) {
  const [state, action, pending] = useActionState<DecisionFormState, FormData>(
    saveDecisionReview,
    undefined,
  );
  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="decisionId" value={decisionId} />
      {!initial && suggested.startSnapshotDate && suggested.endSnapshotDate && (
        <p className="rounded-lg bg-[var(--c-surface-soft)] px-3 py-2 text-[11.5px] text-[var(--c-muted)]">
          已依 {suggested.startSnapshotDate} 至 {suggested.endSnapshotDate} 的單價與匯率快照預填報酬；請依實際情況確認。
        </p>
      )}
      <Field label="原始假設後來如何發展？" required>
        <textarea className={`${inputClass} min-h-24 resize-y`} name="hypothesisOutcome" defaultValue={initial?.hypothesis_outcome ?? ""} maxLength={3000} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="催化劑結果">
          <textarea className={`${inputClass} min-h-20 resize-y`} name="catalystOutcome" defaultValue={initial?.catalyst_outcome ?? ""} maxLength={3000} />
        </Field>
        <Field label="風險結果">
          <textarea className={`${inputClass} min-h-20 resize-y`} name="riskOutcome" defaultValue={initial?.risk_outcome ?? ""} maxLength={3000} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="是否依原計畫執行？" required>
          <select className={inputClass} name="planFollowed" defaultValue={initial?.plan_followed === false ? "false" : "true"} required>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </Field>
        <Field label="決策品質" required>
          <select className={inputClass} name="decisionQuality" defaultValue={String(initial?.decision_quality ?? 2)} required>
            <option value="1">1 · 流程需調整</option>
            <option value="2">2 · 證據尚可</option>
            <option value="3">3 · 流程紀律良好</option>
          </select>
        </Field>
        <Field label="標的報酬（%）">
          <input className={inputClass} type="number" step="0.01" name="assetReturnPct" defaultValue={initial?.asset_return_pct ?? suggested.assetReturnPct ?? ""} />
        </Field>
        <Field label="TWD 報酬（%）">
          <input className={inputClass} type="number" step="0.01" name="twdReturnPct" defaultValue={initial?.twd_return_pct ?? suggested.twdReturnPct ?? ""} />
        </Field>
        <Field label="匯率效果（%）">
          <input className={inputClass} type="number" step="0.01" name="fxEffectPct" defaultValue={initial?.fx_effect_pct ?? suggested.fxEffectPct ?? ""} />
        </Field>
        <Field label="最大有利變動（%）">
          <input className={inputClass} type="number" step="0.01" name="maxFavorableExcursionPct" defaultValue={initial?.max_favorable_excursion_pct ?? suggested.maxFavorableExcursionPct ?? ""} />
        </Field>
        <Field label="最大不利變動（%）">
          <input className={inputClass} type="number" step="0.01" name="maxAdverseExcursionPct" defaultValue={initial?.max_adverse_excursion_pct ?? suggested.maxAdverseExcursionPct ?? ""} />
        </Field>
      </div>
      <Field label="檢討" required>
        <textarea className={`${inputClass} min-h-28 resize-y`} name="reflection" defaultValue={initial?.reflection ?? ""} maxLength={4000} required />
      </Field>
      <Field label="下一次要改進什麼？" required>
        <textarea className={`${inputClass} min-h-20 resize-y`} name="nextImprovement" defaultValue={initial?.next_improvement ?? ""} maxLength={2000} required />
      </Field>
      {state?.error && <p role="alert" className="text-[13px] text-[var(--c-down)]">{state.error}</p>}
      {state?.ok && <p role="status" className="text-[13px] text-[var(--c-up)]">{state.ok}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-[var(--r-control)] bg-[var(--c-accent)] px-5 py-2.5 text-[13.5px] font-semibold text-[var(--c-btn-strong-text)] hover:brightness-110 disabled:opacity-50">
          {pending ? "儲存中…" : initial ? "更新檢討" : "儲存檢討"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-[13px] font-medium">
      {label}{required && <span className="ml-1 text-[var(--c-down)]">*</span>}
      {children}
    </label>
  );
}
