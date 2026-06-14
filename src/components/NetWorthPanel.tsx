"use client";

import { useMemo, useState } from "react";
import { NetWorthLine } from "./PortfolioCharts";

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

export function NetWorthPanel({
  data,
}: {
  data: { date: string; value: number }[];
}) {
  const [range, setRange] = useState<Range>("ALL");
  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (days === null || data.length === 0) return data;
    const lastDate = data[data.length - 1].date;
    const cutoff = new Date(lastDate);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data.filter((d) => d.date >= cutoffStr);
  }, [data, range]);

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex self-end rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-0.5 text-xs">
        {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded px-2.5 py-1 transition-colors ${
              range === r
                ? "bg-[var(--c-accent)] text-[var(--c-btn-strong-text)]"
                : "text-[var(--c-muted)] hover:text-[var(--c-text)]"
            }`}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>
      {filtered.length < 2 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-[var(--c-faint)]">
          此範圍內資料不足兩天
        </div>
      ) : (
        <NetWorthLine data={filtered} />
      )}
    </div>
  );
}
