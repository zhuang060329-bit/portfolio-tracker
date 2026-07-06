"use client";

import { Sparkline, type SeriesPoint } from "./DashboardCharts";
import { fmtUpdatedAt } from "@/lib/format";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import type { DashSummary } from "./types";
import { sign, TONE_TEXT, type Tone } from "./shared";
import { useCountUp } from "./useCountUp";

/* ---------- Hero ---------- */
export function Hero({
  s,
  series,
  demo,
}: {
  s: DashSummary;
  series: SeriesPoint[];
  demo?: boolean;
}) {
  const total = useCountUp(s.total);
  const recent = series.slice(-30);
  const hasDay = s.dayChange != null && s.dayChangePct != null;
  const up30 = recent.length >= 2 && recent[recent.length - 1].value >= recent[0].value;
  const chg30Pct =
    recent.length >= 2 && recent[0].value > 0
      ? ((recent[recent.length - 1].value - recent[0].value) / recent[0].value) * 100
      : 0;

  return (
    <section className="grid grid-cols-1 gap-x-5 gap-y-6 px-1 pt-4 sm:grid-cols-[1fr_auto] sm:pt-7">
      {/* 主：總淨資產 */}
      <div className="sm:col-start-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-muted)]">
          總淨資產 · NET WORTH
        </p>
        <h1 className="mt-3 flex items-baseline gap-2 font-serif">
          <span className="text-[14px] font-medium text-[var(--c-muted)]">
            NT$
          </span>
          <span className="amt text-[clamp(44px,7vw,72px)] font-medium leading-[0.95] tracking-[-0.025em] tnum">
            {Math.round(total).toLocaleString("en-US")}
          </span>
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {hasDay ? (
            <span
              className={`inline-flex items-center gap-[7px] rounded-full border px-3 py-1.5 text-sm font-semibold ${
                s.dayChange! >= 0
                  ? "border-[color-mix(in_srgb,var(--c-up)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-up)_12%,transparent)] text-[var(--c-up)]"
                  : "border-[color-mix(in_srgb,var(--c-down)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)] text-[var(--c-down)]"
              }`}
            >
              <span className="text-[9px]">
                {s.dayChange! >= 0 ? "▲" : "▼"}
              </span>
              <span className="amt">
                {sign(s.dayChange!)}NT${" "}
                {Math.abs(Math.round(s.dayChange!)).toLocaleString("en-US")}
              </span>
              <span className="pl-0.5 text-[12.5px] opacity-80">
                {sign(s.dayChangePct!)}
                {Math.abs(s.dayChangePct!).toFixed(2)}%
              </span>
            </span>
          ) : null}
          {hasDay && (
            <span className="text-xs text-[var(--c-faint)]">較前一日快照</span>
          )}
          <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--c-muted)]">
            報價更新於 {s.lastUpdate ? fmtUpdatedAt(s.lastUpdate) : "—"} ·{" "}
            {s.accounts} 個帳戶
            {!demo && <RefreshPricesButton />}
          </span>
        </div>
      </div>

      {/* 副：近 30 日 instrument panel */}
      {recent.length >= 2 && (
        <div className="sm:col-start-2 sm:flex sm:items-center sm:justify-end">
          <div className="inline-block rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 pb-2.5 pt-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-4">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--c-faint)]">
                近 30 日
              </span>
              <span
                className={`text-[11.5px] font-semibold tnum ${up30 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}`}
              >
                {sign(chg30Pct)}{Math.abs(chg30Pct).toFixed(1)}%
              </span>
            </div>
            <Sparkline data={recent} w={150} h={40} up={up30} />
          </div>
        </div>
      )}

    </section>
  );
}

export function HeroStat({
  label,
  value,
  tone,
  sub,
  primary,
  mask,
}: {
  label: string;
  value: string;
  tone?: Tone;
  sub?: string;
  primary?: boolean;
  mask?: boolean; // 絕對金額才標 amt；百分比類不遮
}) {
  return (
    <div className={`bg-[var(--c-surface)] px-4 ${primary ? "py-5" : "py-4"} sm:px-[18px]`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--c-muted)]">
        {label}
      </div>
      <div
        className={`mt-1.5 font-serif ${primary ? "text-[27px]" : "text-[21px]"} font-medium tracking-tight tnum ${
          tone ? TONE_TEXT[tone] : ""
        } ${mask ? "amt" : ""}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--c-faint)]">{sub}</div>}
    </div>
  );
}
