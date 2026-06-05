"use client";

import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Claude 系暖色配色（橘 / 沙金 / 暖棕系），近似品牌調性，非精確取色。
const CHART_COLORS = [
  "var(--c-accent)", // Claude 橘
  "#D4A574", // 沙金
  "#8B6F47", // 暖棕
  "#A8826E", // mauve
  "var(--c-muted)", // 中性灰
  "#D9B382", // 淺金
];

const fmtTwd = (v: number) =>
  `NT$ ${v.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;

type PieDatum = { label: string; value: number };
type LineDatum = { date: string; value: number };

export function AllocationPie({ data }: { data: PieDatum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
          stroke="var(--c-surface-soft)"
          strokeWidth={2}
          label={({ percent }: { percent?: number }) =>
            percent && percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : ""
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => fmtTwd(Number(v))}
          contentStyle={{
            background: "var(--c-surface-soft)",
            border: "1px solid var(--c-border)",
            borderRadius: 4,
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          wrapperStyle={{ fontSize: 12, color: "var(--c-muted)" }}
          // 在 legend 上補百分比，免得使用者只看顏色猜不到比例
          formatter={(value: string, entry) => {
            const v = Number(
              (entry?.payload as { value?: number } | undefined)?.value ?? 0,
            );
            const pct = total > 0 ? (v / total) * 100 : 0;
            return (
              <span style={{ color: "var(--c-text)" }}>
                {value}
                <span style={{ color: "var(--c-muted)", marginLeft: 6 }}>
                  {pct.toFixed(1)}%
                </span>
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function NetWorthLine({ data }: { data: LineDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="var(--c-muted)"
          fontSize={11}
          tickMargin={6}
          axisLine={{ stroke: "var(--c-border)" }}
          tickLine={false}
        />
        <YAxis
          stroke="var(--c-muted)"
          fontSize={11}
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
                ? `${Math.round(v / 1_000)}k`
                : String(v)
          }
          axisLine={{ stroke: "var(--c-border)" }}
          tickLine={false}
          width={48}
          domain={["dataMin - dataMin * 0.02", "dataMax + dataMax * 0.02"]}
        />
        <Tooltip
          formatter={(v) => fmtTwd(Number(v))}
          labelStyle={{ color: "var(--c-text)", fontSize: 12 }}
          contentStyle={{
            background: "var(--c-surface-soft)",
            border: "1px solid var(--c-border)",
            borderRadius: 4,
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--c-accent)"
          strokeWidth={2.5}
          dot={{ fill: "var(--c-accent)", r: 3 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// 投資組合 vs 多基準（normalized 起點 = 100）。
// data 一列 = 一個日期；portfolio 為必出現的 key，其他 benchmark 由 series 定義動態渲染。
// date 是字串，其餘動態 key 都是 number | undefined；用聯合型別避免 index signature 把 date 拖下水。
export type PerfDatum = {
  date: string;
  portfolio?: number;
  [key: string]: number | string | undefined;
};

export type PerfSeries = {
  key: string;
  label: string;
  color: string;
  dash?: string;
};

export function PerformanceLine({
  data,
  benchmarks,
}: {
  data: PerfDatum[];
  benchmarks: PerfSeries[];
}) {
  // 動態算 Y 軸範圍：把所有 series 的值掃過去，給 ±2% 緩衝，避免折線壓在軸線。
  const allVals: number[] = [];
  for (const d of data) {
    if (typeof d.portfolio === "number") allVals.push(d.portfolio);
    for (const b of benchmarks) {
      const v = d[b.key];
      if (typeof v === "number") allVals.push(v);
    }
  }
  const minV = allVals.length ? Math.min(...allVals) : 95;
  const maxV = allVals.length ? Math.max(...allVals) : 105;
  const pad = Math.max(1, (maxV - minV) * 0.1);
  const yDomain: [number, number] = [
    Math.floor(minV - pad),
    Math.ceil(maxV + pad),
  ];

  const labelMap = Object.fromEntries(
    benchmarks.map((b) => [b.key, b.label]),
  );
  labelMap["portfolio"] = "我的組合";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="var(--c-muted)"
          fontSize={11}
          tickMargin={6}
          axisLine={{ stroke: "var(--c-border)" }}
          tickLine={false}
        />
        <YAxis
          stroke="var(--c-muted)"
          fontSize={11}
          tickFormatter={(v: number) => `${v.toFixed(0)}`}
          axisLine={{ stroke: "var(--c-border)" }}
          tickLine={false}
          width={48}
          domain={yDomain}
        />
        <Tooltip
          formatter={(v, name) => [
            `${Number(v).toFixed(2)} (${(Number(v) - 100 >= 0 ? "+" : "−")}${Math.abs(Number(v) - 100).toFixed(2)}%)`,
            labelMap[String(name)] ?? String(name),
          ]}
          labelStyle={{ color: "var(--c-text)", fontSize: 12 }}
          contentStyle={{
            background: "var(--c-surface-soft)",
            border: "1px solid var(--c-border)",
            borderRadius: 4,
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="bottom"
          iconType="line"
          wrapperStyle={{ fontSize: 12, color: "var(--c-muted)" }}
          formatter={(value) => labelMap[String(value)] ?? String(value)}
        />
        <Line
          type="monotone"
          dataKey="portfolio"
          stroke="var(--c-accent)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 6 }}
          connectNulls
          isAnimationActive={false}
        />
        {benchmarks.map((b) => (
          <Line
            key={b.key}
            type="monotone"
            dataKey={b.key}
            stroke={b.color}
            strokeWidth={2}
            strokeDasharray={b.dash ?? "6 4"}
            dot={false}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
