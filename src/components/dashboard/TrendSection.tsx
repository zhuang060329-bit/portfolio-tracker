"use client";

import { useMemo, useState } from "react";
import {
  BenchChart,
  TrendChart,
  type BenchSeries,
  type PerfPoint,
  type SeriesPoint,
} from "./DashboardCharts";
import { sign, TONE_TEXT, toneCls } from "./shared";

/* ---------- 趨勢區（淨值 / 大盤對照）---------- */
export const RANGES: { k: string; d: number | null }[] = [
  { k: "1M", d: 30 },
  { k: "3M", d: 90 },
  { k: "6M", d: 182 },
  { k: "YTD", d: null },
  { k: "1Y", d: 365 },
  { k: "ALL", d: 9999 },
];

export function TrendSection({
  series,
  perf,
  benchmarks,
  hasPerf,
  benchNotice,
  today,
}: {
  series: SeriesPoint[];
  perf: PerfPoint[];
  benchmarks: BenchSeries[];
  hasPerf: boolean;
  benchNotice?: string | null;
  today: string;
}) {
  const [range, setRange] = useState("6M");
  const [mode, setMode] = useState<"value" | "bench">("value");
  const [active, setActive] = useState<Record<string, boolean>>(() => ({
    portfolio: true,
    ...Object.fromEntries(benchmarks.map((b, i) => [b.key, i !== 1])),
  }));

  // 依選定區間切片（YTD 用今天年份起算；其餘取尾端 N 天）。
  function sliceBy<T extends { date: string }>(full: T[]): T[] {
    if (full.length === 0) return full;
    if (range === "ALL") return full;
    if (range === "YTD") {
      const y = today.slice(0, 4);
      return full.filter((p) => p.date >= `${y}-01-01`);
    }
    const d = RANGES.find((r) => r.k === range)?.d ?? null;
    return d == null ? full : full.slice(-d);
  }

  const sliced = useMemo(
    () => sliceBy(series),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, range, today],
  );
  const perfSliced = useMemo(
    () => sliceBy(perf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perf, range, today],
  );

  const enoughValue = sliced.length >= 2;
  const enoughBench = perfSliced.length >= 2;

  const chg = enoughValue
    ? sliced[sliced.length - 1].value - sliced[0].value
    : 0;
  const chgPct = enoughValue && sliced[0].value ? (chg / sliced[0].value) * 100 : 0;

  return (
    <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow)]">
      <div className="mb-3 flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6">
        <div>
          <h2 className="text-[19px] font-medium tracking-tight">
            {mode === "value" ? "淨資產趨勢" : "績效對照"}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--c-muted)]">
            {mode === "value" ? (
              enoughValue ? (
                <>
                  此區間{" "}
                  <span className={TONE_TEXT[toneCls(chg)]}>
                    <span className="amt">{sign(chg)}NT$ {Math.abs(Math.round(chg)).toLocaleString("en-US")}</span>{" "}
                    ({sign(chgPct)}
                    {Math.abs(chgPct).toFixed(1)}%)
                  </span>
                </>
              ) : (
                "此區間快照不足兩天"
              )
            ) : (
              "與大盤對照 · 區間起點 = 100 · SPY/QQQ 已換算 TWD"
            )}
          </p>
        </div>
        {hasPerf && (
          <div className="inline-flex self-start rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] p-[3px]">
            {(["value", "bench"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                  mode === m
                    ? "bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm"
                    : "text-[var(--c-muted)]"
                }`}
              >
                {m === "value" ? "淨值" : "大盤對照"}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === "value" ? (
        enoughValue ? (
          <TrendChart key={range} data={sliced} height={300} />
        ) : (
          <ChartEmpty>此區間快照不足兩天，明天再來看。</ChartEmpty>
        )
      ) : enoughBench ? (
        <BenchChart
          key={range}
          data={perfSliced}
          series={benchmarks}
          height={300}
          active={active}
        />
      ) : (
        <ChartEmpty>此區間沒有可對照的資料。</ChartEmpty>
      )}

      {mode === "bench" && benchNotice && (
        <p className="mt-2 text-[11.5px] text-[var(--c-faint)]" role="status">
          {benchNotice}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4 px-5 pb-4 sm:px-6">
        <div className="inline-flex gap-0.5">
          {RANGES.map((r) => (
            <button
              key={r.k}
              type="button"
              onClick={() => setRange(r.k)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
                range === r.k
                  ? "bg-[var(--c-accent-soft)] text-[var(--c-accent)] shadow-[inset_0_-2px_0_var(--c-accent)]"
                  : "text-[var(--c-muted)] hover:text-[var(--c-text)]"
              }`}
            >
              {r.k}
            </button>
          ))}
        </div>
        {mode === "bench" && (
          <div className="flex flex-wrap gap-1.5">
            <LegendBtn
              on={active.portfolio}
              color="var(--c-accent)"
              label="我的組合"
              onClick={() =>
                setActive((a) => ({ ...a, portfolio: !a.portfolio }))
              }
            />
            {benchmarks.map((b) => (
              <LegendBtn
                key={b.key}
                on={active[b.key]}
                color={b.color}
                label={b.label}
                onClick={() => setActive((a) => ({ ...a, [b.key]: !a[b.key] }))}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LegendBtn({
  on,
  color,
  label,
  onClick,
}: {
  on: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--c-border)] px-2.5 py-1 text-xs font-medium text-[var(--c-text)] transition-all duration-150 hover:border-[var(--c-line-strong)] hover:bg-[var(--c-surface-soft)] ${
        on ? "" : "opacity-40 hover:opacity-60"
      }`}
    >
      <span
        className="h-[9px] w-[9px] rounded-full"
        style={{ background: color }}
      />
      {label}
    </button>
  );
}

function ChartEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[300px] items-center justify-center text-sm text-[var(--c-faint)]">
      {children}
    </div>
  );
}
