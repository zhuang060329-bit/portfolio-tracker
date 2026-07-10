"use client";

import { useMemo, useState } from "react";
import {
  BenchChart,
  TrendChart,
  type BenchSeries,
  type PerfPoint,
  type SeriesPoint,
} from "./DashboardCharts";
import { RANGES, sliceByRange, sliceToCommonStart } from "./chart-data";
import { sign, TONE_TEXT, toneCls } from "./shared";

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
    ...Object.fromEntries(
      benchmarks.map((benchmark, index) => [benchmark.key, index !== 1]),
    ),
  }));

  const sliced = useMemo(
    () => sliceByRange(series, range, today),
    [series, range, today],
  );
  const perfInRange = useMemo(
    () => sliceByRange(perf, range, today),
    [perf, range, today],
  );
  const perfSliced = useMemo(() => {
    const keys = [
      "portfolio",
      ...benchmarks
        .filter((benchmark) => active[benchmark.key])
        .map((benchmark) => benchmark.key),
    ];
    return sliceToCommonStart(perfInRange, keys);
  }, [perfInRange, benchmarks, active]);

  const enoughValue = sliced.length >= 2;
  const enoughBench = perfSliced.length >= 2;
  const change = enoughValue
    ? sliced[sliced.length - 1].value - sliced[0].value
    : 0;

  return (
    <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow)]">
      <div className="mb-3 flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-[3px] h-[15px] w-[3px] shrink-0 rounded-full bg-[var(--c-accent)]"
          />
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">
              {mode === "value" ? "淨資產趨勢" : "績效對照"}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--c-muted)]">
              {mode === "value" ? (
                enoughValue ? (
                  <>
                    此區間淨值變化{" "}
                    <span className={TONE_TEXT[toneCls(change)]}>
                      <span className="amt">
                        {sign(change)}NT${" "}
                        {Math.abs(Math.round(change)).toLocaleString("en-US")}
                      </span>
                    </span>
                  </>
                ) : (
                  "此區間快照不足兩天"
                )
              ) : (
                "啟用線共同起點 = 100 · SPY/QQQ 已換算 TWD"
              )}
            </p>
          </div>
        </div>
        {hasPerf && (
          <div className="inline-flex self-start rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] p-[3px]">
            {(["value", "bench"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                  mode === item
                    ? "bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm"
                    : "text-[var(--c-muted)]"
                }`}
              >
                {item === "value" ? "淨值" : "大盤對照"}
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
          key={`${range}-${perfSliced[0].date}`}
          data={perfSliced}
          series={benchmarks}
          height={300}
          active={active}
        />
      ) : (
        <ChartEmpty>啟用的線沒有共同起算資料。</ChartEmpty>
      )}

      {mode === "bench" && benchNotice && (
        <p
          className="mt-2 px-5 text-[11.5px] text-[var(--c-faint)] sm:px-6"
          role="status"
        >
          {benchNotice}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4 px-5 pb-4 sm:px-6">
        <div className="inline-flex gap-0.5">
          {RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
                range === item.key
                  ? "bg-[var(--c-accent-soft)] text-[var(--c-accent)] shadow-[inset_0_-2px_0_var(--c-accent)]"
                  : "text-[var(--c-muted)] hover:text-[var(--c-text)]"
              }`}
            >
              {item.key}
            </button>
          ))}
        </div>
        {mode === "bench" && (
          <div className="flex flex-wrap gap-1.5">
            <LegendButton
              on={active.portfolio}
              color="var(--c-accent)"
              label="我的組合"
              onClick={() =>
                setActive((current) => ({
                  ...current,
                  portfolio: !current.portfolio,
                }))
              }
            />
            {benchmarks.map((benchmark) => (
              <LegendButton
                key={benchmark.key}
                on={active[benchmark.key]}
                color={benchmark.color}
                dash={benchmark.dash}
                label={benchmark.label}
                onClick={() =>
                  setActive((current) => ({
                    ...current,
                    [benchmark.key]: !current[benchmark.key],
                  }))
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LegendButton({
  on,
  color,
  label,
  onClick,
  dash,
}: {
  on: boolean;
  color: string;
  label: string;
  onClick: () => void;
  dash?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--c-border)] px-2.5 py-1 text-xs font-medium text-[var(--c-text)] transition-all duration-150 hover:border-[var(--c-line-strong)] hover:bg-[var(--c-surface-soft)] ${
        on ? "" : "opacity-40 hover:opacity-60"
      }`}
    >
      <svg width="22" height="10" aria-hidden="true" className="shrink-0">
        <line
          x1="1"
          y1="5"
          x2="21"
          y2="5"
          stroke={color}
          strokeWidth={dash ? 2 : 3}
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      </svg>
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
