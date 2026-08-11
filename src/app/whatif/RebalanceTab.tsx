"use client";

import { useMemo, useState } from "react";
import { ASSET_CLASS_LABEL } from "@/lib/dashboard-data";
import { fmtFull } from "@/lib/format";
import { planRebalance } from "@/lib/rebalance";
import type { ScenarioHolding } from "@/lib/scenario";

export type RebalanceData = {
  holdings: ScenarioHolding[];
  allocationTargets: Record<string, number>;
};

const PRESETS = [0, 10_000, 30_000, 50_000, 100_000];

export function RebalanceTab({ data }: { data: RebalanceData }) {
  const [contribution, setContribution] = useState(0);

  const plan = useMemo(
    () =>
      planRebalance({
        holdings: data.holdings,
        targets: data.allocationTargets,
        contributionTwd: contribution,
      }),
    [data.holdings, data.allocationTargets, contribution],
  );

  if (plan.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center text-sm text-[var(--c-muted)]">
        {plan.notes[0] ??
          "還沒有可估值的持倉，先到帳戶頁建立帳戶後再回來看再平衡建議。"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5">
        <h2 className="text-[15px] font-semibold">這次要投入多少</h2>
        <p className="mt-1 text-[12px] text-[var(--c-muted)]">
          只買不賣。賣出會實現損益、計入海外所得，所以這裡算的是「新資金該怎麼分」，
          不是「該賣掉什麼」。
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-[var(--c-muted)]">NT$</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={contribution === 0 ? "" : contribution}
              onChange={(e) =>
                setContribution(Math.max(0, Number(e.target.value) || 0))
              }
              placeholder="0"
              className="tnum h-11 w-[140px] rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 text-right text-[14px] font-semibold text-[var(--c-text)]"
            />
          </label>
          {PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setContribution(v)}
              aria-pressed={contribution === v}
              className={`h-11 rounded-[var(--r-control)] border px-3 text-[12.5px] font-medium transition-colors ${
                contribution === v
                  ? "border-[var(--c-accent)] bg-[var(--c-accent-soft)] text-[var(--c-text)]"
                  : "border-[var(--c-border)] text-[var(--c-muted)] hover:text-[var(--c-text)]"
              }`}
            >
              {v === 0 ? "不投入" : `${(v / 10_000).toLocaleString("en-US")} 萬`}
            </button>
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="目前總市值" value={plan.totalTwd} />
          <Stat
            label="補平全部低配需要"
            value={plan.totalShortfallTwd}
            hint={
              contribution > 0 && plan.totalShortfallTwd > contribution
                ? "這次投入不夠補滿"
                : undefined
            }
          />
          <Stat label="未分配餘額" value={plan.unallocatedTwd} />
        </dl>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-border)] text-left text-[11px] uppercase tracking-wider text-[var(--c-faint)]">
                <th scope="col" className="px-4 py-3 font-medium">類別</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">目標</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">實際</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">偏離</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">差額</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">本次配置</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">投入後</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((r) => (
                <tr
                  key={r.assetClass}
                  className="border-b border-[var(--c-border-soft)] last:border-b-0"
                >
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {ASSET_CLASS_LABEL[r.assetClass] ?? r.assetClass}
                    {r.untargeted && (
                      <span className="ml-2 rounded-full border border-[var(--c-border)] px-1.5 py-px text-[10px] font-normal text-[var(--c-faint)]">
                        未設目標
                      </span>
                    )}
                  </th>
                  <td className="tnum px-4 py-3 text-right text-[var(--c-muted)]">
                    {r.targetPct.toFixed(0)}%
                  </td>
                  <td className="tnum px-4 py-3 text-right">{r.actualPct.toFixed(1)}%</td>
                  <td
                    className="tnum px-4 py-3 text-right"
                    style={{ color: driftColor(r.driftPp) }}
                  >
                    {signed(r.driftPp, 1)}pp
                  </td>
                  <td
                    className="amt tnum px-4 py-3 text-right"
                    style={{ color: driftColor(-r.gapTwd) }}
                  >
                    {signedTwd(r.gapTwd)}
                  </td>
                  <td className="amt tnum px-4 py-3 text-right font-semibold">
                    {r.contributionTwd > 0 ? fmtFull(r.contributionTwd) : "—"}
                  </td>
                  <td className="tnum px-4 py-3 text-right text-[var(--c-muted)]">
                    {r.afterPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-5 py-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--c-faint)]">
          前提與限制
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-[var(--c-muted)]">
          {plan.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>
            「差額」是不投入新資金時、要達到目標比例的市值差；「本次配置」則是以投入後的
            總市值為基準重算，兩個數字不一樣是正常的。
          </li>
          <li>未計手續費、稅負、最小交易單位與零股限制。實際下單金額請自行取整。</li>
          <li>
            以資產類別為單位計算，不細分到個別帳戶或標的。同類別內要買哪一檔由你決定。
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-[var(--c-faint)]">
        {label}
      </dt>
      <dd className="amt tnum mt-1 text-[17px] font-semibold">{fmtFull(value)}</dd>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--c-warn)]">{hint}</p>}
    </div>
  );
}

/* 低配（該補）用漲色、超配用跌色，與全站賺綠虧紅的方向一致：
   綠色代表「這裡要加錢」，紅色代表「這裡已經太多」。 */
function driftColor(v: number): string {
  if (Math.abs(v) < 0.05) return "var(--c-muted)";
  return v > 0 ? "var(--c-down)" : "var(--c-up)";
}

function signed(v: number, digits: number): string {
  if (Math.abs(v) < 0.05) return "0";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
}

function signedTwd(v: number): string {
  if (Math.abs(v) < 1) return "—";
  return `${v > 0 ? "+" : "−"}${fmtFull(Math.abs(v))}`;
}
