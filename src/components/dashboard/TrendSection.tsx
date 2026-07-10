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
    <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)]">
      <div className="flex flex-col gap-4 px-4 pb-2 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pt-6">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.015em] sm:text-[18px]">
            {mode === "value" ? "淨資產趨勢" : "績效對照"}
          </h2>
          <p className="mt-1 text-[12px] text-[var(--c-muted)]">
            {mode === "value" ? (
              enoughValue ? (
                <>
                  區間變化{" "}
                  <span className={TONE_TEXT[toneCls(change)]}>
                    <span className="amt font-medium">
                      {sign(change)}NT${" "}
                      {Math.abs(Math.round(change)).toLocaleString("en-US")}
                    </span>
                  </span>
                </>
              ) : (
                "此區間快照不足兩天"
              )
            ) : (
              "啟用線採共同起點 100，SPY／QQQ 已換算 TWD"
            )}
          </p>
        </div>

        {hasPerf && (
          <div className="inline-flex self-start rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-page)] p-1">
            {(["value", "bench"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={mode === item}
                onClick={() => setMode(item)}
                className={`min-h-9 whitespace-nowrap rounded-[5px] px-3 text-[12px] font-medium ${
                  mode === item
                    ? "bg-[var(--c-surface-soft)] text-[var(--c-text)]"
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
          <TrendChart key={range} data={sliced} height={280} />
        ) : (
          <ChartEmpty>此區間快照不足兩天。</ChartEmpty>
        )
      ) : enoughBench ? (
        <BenchChart
          key={`${range}-${perfSliced[0].date}`}
          data={perfSliced}
          series={benchmarks}
          height={280}
          active={active}
        />
      ) : (
        <ChartEmpty>啟用的線沒有共同起算資料。</ChartEmpty>
      )}

      {mode === "bench" && benchNotice && (
        <p
          className="px-4 text-[11px] text-[var(--c-faint)] sm:px-6"
          role="status"
        >
          {benchNotice}
        </p>
      )}

      <div className="mt-2 border-t border-[var(--c-border)] px-4 py-3 sm:px-6">
        <div className="hide-scrollbar flex gap-1 overflow-x-auto">
          {RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={range === item.key}
              onClick={() => setRange(item.key)}
              className={`min-h-9 min-w-11 shrink-0 rounded-[var(--r-control)] px-2.5 text-[11px] font-semibold ${
                range === item.key
                  ? "bg-[var(--c-accent-soft)] text-[var(--c-accent)]"
                  : "text-[var(--c-muted)] hover:bg-[var(--c-surface-soft)] hover:text-[var(--c-text)]"
              }`}
            >
              {item.key}
            </button>
          ))}
        </div>

        {mode === "bench" && (
          <div className="hide-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
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
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[var(--r-control)] border border-[var(--c-border)] px-2.5 text-[11px] font-medium text-[var(--c-text)] hover:border-[var(--c-line-strong)] hover:bg-[var(--c-surface-soft)] ${
        on ? "" : "opacity-40"
      }`}
    >
      <svg width="20" height="8" aria-hidden="true" className="shrink-0">
        <line
          x1="1"
          y1="4"
          x2="19"
          y2="4"
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
    <div className="flex h-[280px] items-center justify-center px-4 text-center text-sm text-[var(--c-faint)]">
      {children}
    </div>
  );
}
