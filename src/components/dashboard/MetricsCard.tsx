"use client";

import { fmtTwd, fmtCompact } from "./DashboardCharts";
import type { DashSummary } from "./types";
import { CardHead, sign, toneCls, TONE_TEXT, type Tone } from "./shared";

/* ---------- 指標 + 被動收入 ---------- */
export function MetricsCard({ s }: { s: DashSummary }) {
  const metrics =
    s.twrShowable && s.twrCum != null
      ? [
          {
            label: "TWR 累積",
            value: `${sign(s.twrCum)}${(Math.abs(s.twrCum) * 100).toFixed(1)}%`,
            tone: toneCls(s.twrCum),
            hint: "策略本身報酬",
          },
          {
            label: "TWR 年化",
            value: `${sign(s.twrAnn ?? 0)}${(Math.abs(s.twrAnn ?? 0) * 100).toFixed(1)}%`,
            tone: toneCls(s.twrAnn ?? 0),
            hint: "可與大盤比較",
          },
          {
            label: "最大回撤",
            value: `−${(Math.abs(s.maxDrawdown ?? 0) * 100).toFixed(1)}%`,
            tone: "down" as Tone,
            hint: s.ddPeak && s.ddTrough ? `${s.ddPeak} → ${s.ddTrough}` : "下行風險",
          },
          {
            label: "Sharpe",
            value: (s.sharpe ?? 0).toFixed(2),
            tone: (s.sharpe ?? 0) > 1 ? ("up" as Tone) : ("flat" as Tone),
            hint: ">1 算優秀",
          },
        ]
      : null;

  return (
    <div>
      <CardHead title="績效指標" sub="基於每日淨值快照" />
      {metrics ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-border)]">
          {metrics.map((m) => (
            <div key={m.label} className="bg-[var(--c-surface)] px-4 py-3.5">
              <div className="text-[11.5px] text-[var(--c-muted)]">
                {m.label}
              </div>
              <div
                className={`mt-1.5 font-serif text-[23px] font-medium tnum ${TONE_TEXT[m.tone]}`}
              >
                {m.value}
              </div>
              <div className="mt-0.5 text-[10.5px] text-[var(--c-faint)]">
                {m.hint}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-border)]">
            {["TWR 累積", "TWR 年化", "最大回撤", "Sharpe"].map((label) => (
              <div key={label} className="bg-[var(--c-surface)] px-4 py-3.5">
                <div className="text-[11.5px] text-[var(--c-muted)]">{label}</div>
                <div className="sk mt-1.5 h-[26px] w-[68px] rounded-md" />
                <div className="sk mt-1.5 h-[10px] w-[56px] rounded" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-[var(--c-faint)]">
            快照滿 30 天後顯示
          </p>
        </div>
      )}

      {s.hasIncome && (
        <div className="mt-4 border-t border-[var(--c-border)] pt-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[13.5px] font-semibold">被動收入</span>
            <span className="text-xs font-semibold text-[var(--c-accent)] tnum">
              配息率 {s.yieldOnCost.toFixed(2)}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3.5">
            <IncomeStat label="今年累積" value={`NT$ ${fmtCompact(s.incomeYtd)}`} up />
            <IncomeStat label="近 12 月" value={`NT$ ${fmtCompact(s.income12m)}`} up />
            <IncomeStat label="月均" value={`NT$ ${fmtCompact(s.monthlyAvg)}`} />
          </div>
          <p className="mt-3 text-[10.5px] text-[var(--c-faint)]">
            累計 配息 <span className="amt">NT$ {fmtTwd(s.dividendAll)}</span> · 利息 <span className="amt">NT$ {fmtTwd(s.interestAll)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

function IncomeStat({
  label,
  value,
  up,
}: {
  label: string;
  value: string;
  up?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11.5px] text-[var(--c-muted)]">{label}</span>
      <span
        className={`amt text-[17px] font-semibold tnum ${up ? "text-[var(--c-up)]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
