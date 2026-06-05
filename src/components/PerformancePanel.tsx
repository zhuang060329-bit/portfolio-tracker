"use client";

import { useMemo, useState } from "react";
import {
  PerformanceLine,
  type PerfDatum,
  type PerfSeries,
} from "./PortfolioCharts";

type Range = "1M" | "3M" | "6M" | "1Y" | "ALL";

const RANGE_DAYS: Record<Range, number | null> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  ALL: null,
};

const RANGE_LABEL: Record<Range, string> = {
  "1M": "1 月",
  "3M": "3 月",
  "6M": "6 月",
  "1Y": "1 年",
  ALL: "全部",
};

/**
 * 績效對照面板。
 * - data：server 預先合併好的所有日期 + 所有 series（值未 normalize）。
 *   key 'portfolio' 為組合，其他 key 為 benchmark 原始值。
 * - benchmarks：可顯示的基準清單。
 *
 * 本元件：按範圍 filter → 對 filter 後的第一天 re-normalize（起點 = 100）
 * → 套 benchmark toggle → 丟 PerformanceLine 渲染。
 *
 * 重新 normalize 的理由：使用者切到「1 個月」時，他想看的是「最近 1 個月內」
 * 誰跑得快，而不是「相對 1 年前起點」的累積。
 */
export function PerformancePanel({
  data,
  benchmarks,
}: {
  data: PerfDatum[];
  benchmarks: PerfSeries[];
}) {
  const [range, setRange] = useState<Range>("ALL");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(benchmarks.map((b) => [b.key, true])),
  );

  const visibleBench = benchmarks.filter((b) => enabled[b.key]);

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    let rows = data;
    if (days !== null && data.length > 0) {
      const lastDate = data[data.length - 1].date;
      const cutoff = new Date(lastDate);
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      rows = data.filter((d) => d.date >= cutoffStr);
    }
    if (rows.length === 0) return rows;

    // 找這個範圍內第一個各 series 都有值的「基準日」做 normalize 起點。
    // 若 portfolio 在範圍內沒值就用第一個有值的日期；benchmark 同理。
    const firstPort = rows.find((r) => typeof r.portfolio === "number");
    const portBase = firstPort?.portfolio ?? null;
    const benchBase: Record<string, number | null> = {};
    for (const b of benchmarks) {
      const first = rows.find((r) => typeof r[b.key] === "number");
      benchBase[b.key] = (first?.[b.key] as number | undefined) ?? null;
    }
    return rows.map((r) => {
      const out: PerfDatum = { date: r.date };
      if (portBase && portBase > 0 && typeof r.portfolio === "number") {
        out.portfolio = (r.portfolio / portBase) * 100;
      }
      for (const b of benchmarks) {
        const base = benchBase[b.key];
        const v = r[b.key];
        if (base && base > 0 && typeof v === "number") {
          out[b.key] = (v / base) * 100;
        }
      }
      return out;
    });
  }, [data, range, benchmarks]);

  const empty = filtered.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* 範圍按鈕 */}
        <div className="inline-flex rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-0.5 text-xs">
          {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-2.5 py-1 transition-colors ${
                range === r
                  ? "bg-[var(--c-accent)] text-white"
                  : "text-[var(--c-muted)] hover:text-[var(--c-text)]"
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        {/* benchmark 顯示開關 */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {benchmarks.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() =>
                setEnabled((s) => ({ ...s, [b.key]: !s[b.key] }))
              }
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 transition-colors ${
                enabled[b.key]
                  ? "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)]"
                  : "border-[var(--c-border)] bg-transparent text-[var(--c-faint)] line-through"
              }`}
            >
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ backgroundColor: b.color }}
              />
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-[var(--c-faint)]">
          此範圍內沒有資料
        </div>
      ) : (
        <PerformanceLine data={filtered} benchmarks={visibleBench} />
      )}
    </div>
  );
}
