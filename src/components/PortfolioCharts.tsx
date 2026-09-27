"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// account 詳情頁仍用這支 recharts 折線；dashboard 已改用手刻 SVG（DashboardCharts.tsx）。
// 外觀比照 dashboard 的淨值圖：虛線十字準線、直角標記、髮絲線讀數框、Mono 軸標。
// 軸標字體與字級寫在 globals.css 的 .survey-rechart（Recharts 的 tick 不吃 class）。

const fmtTwd = (v: number) =>
  `NT$ ${v.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;

type LineDatum = { date: string; value: number };

// fontSize 同 --fs-axis（10px）。實際字體由 .survey-rechart 設成 Mono，但 Recharts 挑選
// 要顯示哪些刻度時是用這個 fontSize 量字寬，不給會用預設字級量，日期標籤就會擠在一起。
const AXIS_TICK = { fill: "var(--c-faint)", fontSize: 10 };
const AXIS_LINE = { stroke: "var(--c-border)" };

/* 讀數框：髮絲線邊、實底、無陰影、直角，同 DashboardCharts 的 READOUT。
   隱私模式由外層 .amt-chart 對 .recharts-tooltip-wrapper 整塊模糊，這裡不再加 .amt。 */
function Readout({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-2.5 py-1.5">
      <div className="tnum text-[length:var(--fs-micro)] text-[var(--c-muted)]">{label}</div>
      <div className="mt-0.5 tnum text-[length:var(--fs-sm)] font-semibold text-[var(--c-text)]">
        {fmtTwd(Number(payload[0].value))}
      </div>
    </div>
  );
}

/* 十字交點：空心方框，不畫圓點（全站標記都是直角）。 */
function CrossMark({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null;
  return (
    <rect
      x={cx - 4}
      y={cy - 4}
      width={8}
      height={8}
      fill="var(--c-surface)"
      stroke="var(--c-accent)"
      strokeWidth={1.5}
    />
  );
}

/* 只在最後一天畫一個實心方塊，標出「現在」；其餘資料點不畫。 */
function EndMark({
  cx,
  cy,
  index,
  last,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  last: number;
}) {
  if (index !== last || cx == null || cy == null) return null;
  return <rect x={cx - 3} y={cy - 3} width={6} height={6} fill="var(--c-accent)" />;
}

export function NetWorthLine({ data }: { data: LineDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260} className="survey-rechart">
      <LineChart data={data} margin={{ top: 10, right: 32, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--c-border)" strokeDasharray="2 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          tickMargin={6}
          // 量字寬用的是 Sans，Mono 較寬，多留間距補差額
          minTickGap={28}
          axisLine={AXIS_LINE}
          tickLine={false}
        />
        <YAxis
          tick={AXIS_TICK}
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
                ? `${Math.round(v / 1_000)}k`
                : String(v)
          }
          axisLine={AXIS_LINE}
          tickLine={false}
          width={48}
          domain={["dataMin - dataMin * 0.02", "dataMax + dataMax * 0.02"]}
        />
        <Tooltip
          content={<Readout />}
          cursor={{ stroke: "var(--c-muted)", strokeWidth: 1, strokeDasharray: "2 3" }}
          isAnimationActive={false}
          wrapperStyle={{ outline: "none" }}
        />
        {/* 折線不做平滑：monotone 會在兩個資料點之間畫出不存在的弧度 */}
        <Line
          type="linear"
          dataKey="value"
          stroke="var(--c-accent)"
          strokeWidth={2}
          dot={<EndMark last={data.length - 1} />}
          activeDot={<CrossMark />}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
