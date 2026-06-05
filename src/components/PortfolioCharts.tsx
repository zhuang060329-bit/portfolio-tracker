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

// 投資組合 vs 基準（normalized 起點 = 100）
type NormDatum = { date: string; portfolio?: number; benchmark?: number };
export function PerformanceLine({
  data,
  benchmarkName,
}: {
  data: NormDatum[];
  benchmarkName: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
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
        />
        <Tooltip
          formatter={(v, name) => [
            `${Number(v).toFixed(2)} (${(Number(v) - 100 >= 0 ? "+" : "−")}${Math.abs(Number(v) - 100).toFixed(2)}%)`,
            name === "portfolio" ? "我的組合" : benchmarkName,
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
          formatter={(value) =>
            value === "portfolio" ? "我的組合" : benchmarkName
          }
        />
        <Line
          type="monotone"
          dataKey="portfolio"
          stroke="var(--c-accent)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 6 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="benchmark"
          stroke="#3B82F6"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
