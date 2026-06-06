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

const fmtTwd = (v: number) =>
  `NT$ ${v.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;

type LineDatum = { date: string; value: number };

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
