"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { PICK_OFF, PICK_ON } from "./dashboard/shared";

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
      <div className="sk h-[260px] w-full" />
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
      {/* 刻度格分段控制，同首頁 TrendSection：髮絲線外框、格間分隔線、44×44 觸控 */}
      <div className="hide-scrollbar self-end overflow-x-auto">
        <div className="inline-flex divide-x divide-[var(--c-border)] border border-[var(--c-line-strong)]">
          {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`min-h-11 min-w-11 shrink-0 px-2.5 text-[length:var(--fs-micro)] ${
                range === r ? PICK_ON : PICK_OFF
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      {filtered.length < 2 ? (
        <div className="flex h-[260px] items-center justify-center text-[length:var(--fs-sm)] text-[var(--c-faint)]">
          此範圍內資料不足兩天
        </div>
      ) : (
        <NetWorthLine data={filtered} />
      )}
    </div>
  );
}
