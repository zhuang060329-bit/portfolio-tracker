"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

/* recharts 是全站最大的第三方相依，但只有帳戶詳情頁這一張折線圖在用
   （儀表板的圖是手刻 SVG）。靜態匯入等於每個進到這頁的人都得先下載完整個
   圖表庫才看得到頁面其他部分，所以拆成動態載入。
   ssr:false：圖表要量 container 寬度才畫得出來，SSR 那份必定要在 client 重畫，
   先產一份丟掉沒有意義。載入中先放骨架，避免圖表出現時把下面的內容往下推。 */
const NetWorthLine = dynamic(
  () => import("./PortfolioCharts").then((m) => m.NetWorthLine),
  {
    ssr: false,
    loading: () => (
      <div className="sk h-[260px] w-full rounded-[var(--r-card)]" />
    ),
  },
);

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
