"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { project, crossMonth, type ProjPoint } from "@/lib/whatif-project";

const fmtTwd = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtCompact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e8) return (n / 1e8).toFixed(2) + " 億";
  if (a >= 1e4) return Math.round(n / 1e4).toLocaleString("en-US") + " 萬";
  return Math.round(n).toLocaleString("en-US");
};
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

export type CfRow = {
  label: string;
  sym: string | null;
  color: string;
  finalValue: number;
  returnPct: number;
  actual: boolean;
  skipped: number;
};
export type CounterfactualData = {
  invested: number;
  firstDate: string;
  contributions: number;
  rows: CfRow[];
};

/* ---------- 滑桿 ---------- */
function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mt-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-2.5">
        <span className="text-[13px] font-medium text-[var(--c-text)]">
          {label}
        </span>
        <span className="whitespace-nowrap text-sm font-semibold text-[var(--c-accent)] tnum">
          {fmt ? fmt(value) : value}
        </span>
      </div>
      <input
        type="range"
        className="proj-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--c-accent) ${pct}%, var(--c-surface-soft) ${pct}%)`,
        }}
      />
      {hint && (
        <span className="mt-[7px] block text-[11px] text-[var(--c-faint)]">
          {hint}
        </span>
      )}
    </div>
  );
}

/* ---------- 推算圖（手刻 SVG）---------- */
type Milestone = {
  target: number;
  label: string;
  color: string;
  reached: boolean;
  month: number | null;
};

function ProjectionChart({
  pts,
  milestones,
  height = 280,
}: {
  pts: ProjPoint[];
  milestones: Milestone[];
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  // ResizeObserver（setW 只在 observer callback 觸發，符合 hooks 規則）
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padT = 14;
  const padB = 24;
  const padR = 64;
  const H = height;
  const n = pts.length;
  const reachedTargets = milestones
    .filter((m) => m.reached)
    .map((m) => m.target);
  const maxV = Math.max(pts[n - 1].value, ...reachedTargets);
  const hi = maxV * 1.06 || 1;
  const nx = (m: number) => (m / (n - 1)) * (w - padR);
  const ny = (v: number) => padT + (1 - v / hi) * (H - padT - padB);

  const valLine = pts
    .map((p, i) => `${i ? "L" : "M"}${nx(p.m).toFixed(1)},${ny(p.value).toFixed(1)}`)
    .join(" ");
  const area = `${valLine} L${nx(pts[n - 1].m)},${H - padB} L0,${H - padB} Z`;
  const contribLine = pts
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${nx(p.m).toFixed(1)},${ny(p.contributed).toFixed(1)}`,
    )
    .join(" ");

  const years = (n - 1) / 12;
  const step = years > 25 ? 10 : years > 12 ? 5 : years > 6 ? 2 : 1;
  const yearTicks = Array.from(
    { length: Math.floor(years / step) },
    (_, i) => (i + 1) * step,
  ).filter((y) => y <= years + 0.01);

  const onMove = (e: React.MouseEvent) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / (w - padR)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };
  const hp = hover != null ? pts[hover] : null;

  return (
    <div
      ref={wrapRef}
      className="relative w-full"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--c-accent)" stopOpacity="0.28" />
            <stop offset="0.65" stopColor="var(--c-accent)" stopOpacity="0.07" />
            <stop offset="1" stopColor="var(--c-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {milestones.map(
          (m, i) =>
            m.reached && (
              <g key={i}>
                <line
                  x1="0"
                  x2={w - padR}
                  y1={ny(m.target)}
                  y2={ny(m.target)}
                  stroke={m.color}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.55"
                />
                <text
                  x={w - padR + 6}
                  y={ny(m.target) + 4}
                  fontSize={10}
                  fill={m.color}
                >
                  {m.label}
                </text>
              </g>
            ),
        )}
        <path d={area} fill="url(#projFill)" />
        <path
          d={contribLine}
          fill="none"
          stroke="var(--c-text)"
          strokeWidth="1.4"
          strokeDasharray="4 5"
          opacity="0.35"
        />
        <path
          d={valLine}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {yearTicks.map((y) => (
          <text
            key={y}
            x={nx(y * 12)}
            y={H - 6}
            fontSize={10}
            fill="var(--c-faint)"
            textAnchor="middle"
          >
            {y} 年
          </text>
        ))}
        {hp && (
          <g>
            <line
              x1={nx(hp.m)}
              x2={nx(hp.m)}
              y1={padT}
              y2={H - padB}
              stroke="var(--c-accent)"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.5"
            />
            <circle
              cx={nx(hp.m)}
              cy={ny(hp.value)}
              r="4"
              fill="var(--c-accent)"
              stroke="var(--c-page)"
              strokeWidth="2"
            />
            <circle
              cx={nx(hp.m)}
              cy={ny(hp.contributed)}
              r="3"
              fill="var(--c-muted)"
              stroke="var(--c-page)"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-1.5 z-[5] -translate-x-1/2 whitespace-nowrap rounded-[10px] border border-[var(--c-line-strong)] bg-[var(--c-surface-soft)] px-[11px] py-2 shadow-[var(--c-shadow)]"
          style={{ left: Math.min(Math.max(nx(hp.m), 80), w - padR - 80) }}
        >
          <div className="text-[11px] text-[var(--c-muted)]">
            第 {Math.floor(hp.m / 12)} 年 {hp.m % 12} 月
          </div>
          <div className="mt-1 flex items-center gap-[7px] text-xs">
            <span className="h-[7px] w-[7px] rounded-full bg-[var(--c-accent)]" />
            <span className="text-[var(--c-muted)]">淨值</span>
            <span className="ml-auto font-semibold tnum">
              NT$ {fmtCompact(hp.value)}
            </span>
          </div>
          <div className="mt-[3px] flex items-center gap-[7px] text-xs">
            <span className="h-[7px] w-[7px] rounded-full bg-[var(--c-muted)]" />
            <span className="text-[var(--c-muted)]">累積投入</span>
            <span className="ml-auto font-semibold text-[var(--c-muted)] tnum">
              NT$ {fmtCompact(hp.contributed)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 未來推算分頁 ---------- */
const PRESETS = [
  { label: "保守", r: 4 },
  { label: "中性", r: 7 },
  { label: "積極", r: 10 },
];

function ProjectionTab({ netWorth }: { netWorth: number }) {
  const [monthly, setMonthly] = useState(40000);
  const [ret, setRet] = useState(7);
  const [years, setYears] = useState(15);
  const [expense, setExpense] = useState(1200000);

  const pts = useMemo(
    () => project({ start: netWorth, monthly, annualReturn: ret, years }),
    [netWorth, monthly, ret, years],
  );
  const final = pts[pts.length - 1].value;
  const contributed = pts[pts.length - 1].contributed;
  const gain = final - contributed;
  const annualWithdraw = final * 0.04;
  const fireTarget = expense * 25;

  const milestones: Milestone[] = useMemo(() => {
    const list = [
      { target: 1e7, label: "1000 萬", color: "#7FA8C9" },
      { target: 2e7, label: "2000 萬", color: "#7FBFA3" },
      { target: fireTarget, label: "FIRE", color: "var(--c-accent)" },
    ];
    return list
      .map((m) => {
        const cm = crossMonth(pts, m.target);
        return { ...m, reached: cm !== null, month: cm };
      })
      .sort((a, b) => a.target - b.target);
  }, [pts, fireTarget]);

  const monthLabel = (m: number | null) =>
    m == null ? "" : `${Math.floor(m / 12)} 年 ${m % 12} 月`;
  const isPreset = PRESETS.some((p) => p.r === ret);

  return (
    <div className="rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow)]">
    <div className="grid grid-cols-1 items-start min-[880px]:grid-cols-[340px_1fr]">
      {/* 控制（去盒裝，桌機用右側垂直分隔線）*/}
      <section className="p-6 sm:p-7 min-[880px]:sticky min-[880px]:top-[78px] min-[880px]:border-r min-[880px]:border-[var(--c-border)]">
        <h2 className="font-serif text-[19px] font-medium tracking-tight">
          情境設定
        </h2>
        <p className="mt-1 text-[12.5px] text-[var(--c-muted)]">
          從目前淨值 NT$ {fmtCompact(netWorth)} 開始推算
        </p>

        <div className="my-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs text-[var(--c-muted)]">報酬假設</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setRet(p.r)}
              className={`whitespace-nowrap rounded-lg border px-2.5 py-[5px] text-[12.5px] font-medium transition-all ${
                ret === p.r
                  ? "border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] bg-[var(--c-accent-soft)] text-[var(--c-accent)]"
                  : "border-[var(--c-border)] bg-[var(--c-surface-soft)] text-[var(--c-muted)]"
              }`}
            >
              {p.label} {p.r}%
            </button>
          ))}
          <label
            className={`inline-flex cursor-text items-center gap-1 whitespace-nowrap rounded-lg border py-1 pl-2.5 pr-2 text-[12.5px] font-medium transition-all ${
              !isPreset
                ? "border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] bg-[var(--c-accent-soft)] text-[var(--c-accent)]"
                : "border-[var(--c-border)] bg-[var(--c-surface-soft)] text-[var(--c-muted)]"
            }`}
          >
            自訂
            <input
              type="number"
              value={ret}
              min={-5}
              max={20}
              step={0.5}
              onChange={(e) => {
                const v = e.target.value === "" ? 0 : Number(e.target.value);
                setRet(Math.max(-5, Math.min(20, v)));
              }}
              className={`w-[42px] border-none bg-transparent text-right text-[13px] font-semibold outline-none ${
                !isPreset ? "text-[var(--c-accent)]" : "text-[var(--c-text)]"
              }`}
            />
            <span className="font-semibold text-[var(--c-muted)]">%</span>
          </label>
        </div>

        <Slider
          label="每月定期投入"
          value={monthly}
          min={0}
          max={150000}
          step={5000}
          onChange={setMonthly}
          fmt={(v) => `NT$ ${v.toLocaleString("en-US")}`}
        />
        <Slider
          label="年化報酬假設"
          value={ret}
          min={-5}
          max={20}
          step={0.5}
          onChange={setRet}
          fmt={(v) => `${v}%`}
          hint="長期股市約 7%（名目，未計通膨）"
        />
        <Slider
          label="投資年數"
          value={years}
          min={1}
          max={40}
          step={1}
          onChange={setYears}
          fmt={(v) => `${v} 年`}
        />
        <Slider
          label="預計年支出（FIRE 目標 = ×25）"
          value={expense}
          min={300000}
          max={3000000}
          step={100000}
          onChange={setExpense}
          fmt={(v) => `NT$ ${fmtCompact(v)}`}
          hint={`FIRE 目標 NT$ ${fmtCompact(fireTarget)}`}
        />
      </section>

      {/* 結果（去盒裝；手機上與控制以頂線分隔）*/}
      <section className="border-t border-[var(--c-border)] p-6 sm:p-7 min-[880px]:border-t-0">
        <div className="mb-4 border-b border-[var(--c-border)] pb-[18px]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--c-muted)]">
            {years} 年後預估淨值
          </span>
          <span className="mt-2 block font-serif text-[clamp(32px,5vw,46px)] font-medium leading-none tracking-[-0.02em] tnum">
            NT$ {fmtTwd(final)}
          </span>
          <span className="mt-3 block text-[13px] text-[var(--c-muted)]">
            投資獲利{" "}
            <b
              className={`font-semibold ${gain >= 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}`}
            >
              {sign(gain)}NT$ {fmtCompact(Math.abs(gain))}
            </b>{" "}
            · 累積投入 NT$ {fmtCompact(contributed)}
          </span>
        </div>

        <ProjectionChart pts={pts} milestones={milestones} height={280} />
        <div className="mt-2.5 flex gap-[18px] text-xs text-[var(--c-muted)]">
          <span className="inline-flex items-center gap-[7px]">
            <span className="inline-block h-0 w-4 border-t-[2.4px] border-[var(--c-accent)]" />
            預估淨值
          </span>
          <span className="inline-flex items-center gap-[7px]">
            <span className="inline-block h-0 w-4 border-t-[1.6px] border-dashed border-[var(--c-muted)]" />
            累積投入（本金）
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-card)] border border-[var(--c-line-strong)] bg-[var(--c-border)] shadow-[var(--c-shadow)] sm:grid-cols-4">
          <Rstat label="4% 法則年提領" value={`NT$ ${fmtCompact(annualWithdraw)}`} />
          <Rstat
            label="換算月被動收入"
            value={`NT$ ${fmtTwd(annualWithdraw / 12)}`}
            up
          />
          <Rstat label="總投入本金" value={`NT$ ${fmtCompact(contributed)}`} />
          <Rstat
            label="獲利倍數"
            value={`${contributed > 0 ? (final / contributed).toFixed(2) : "—"}×`}
          />
        </div>

        <div className="mt-[22px]">
          <span className="text-[13px] font-semibold">里程碑</span>
          {milestones.map((m) => (
            <div
              key={m.label}
              className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 border-b border-[var(--c-border)] px-0.5 py-[11px] last:border-b-0 ${
                m.reached ? "" : "opacity-50"
              }`}
            >
              <span
                className="h-[9px] w-[9px] rounded-full"
                style={{ background: m.reached ? m.color : "var(--c-faint)" }}
              />
              <span className="whitespace-nowrap text-[13.5px] font-semibold">
                {m.label}
              </span>
              <span className="text-[12.5px] text-[var(--c-muted)] tnum">
                NT$ {fmtCompact(m.target)}
              </span>
              <span
                className={`whitespace-nowrap text-right text-[12.5px] ${
                  m.reached ? "text-[var(--c-text)]" : "text-[var(--c-faint)]"
                }`}
              >
                {m.reached ? `約 ${monthLabel(m.month)}達成` : `${years} 年內未達成`}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
    </div>
  );
}

function Rstat({
  label,
  value,
  up,
}: {
  label: string;
  value: string;
  up?: boolean;
}) {
  return (
    <div className="bg-[var(--c-surface)] px-4 py-3.5">
      <span className="block text-[11.5px] text-[var(--c-muted)]">{label}</span>
      <span
        className={`mt-1.5 block whitespace-nowrap font-serif text-xl font-medium tnum ${up ? "text-[var(--c-up)]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ---------- 回測對照分頁 ---------- */
function CounterfactualTab({ cf }: { cf: CounterfactualData }) {
  const actual = cf.rows.find((r) => r.actual);
  const maxVal = Math.max(...cf.rows.map((r) => r.finalValue), 1);
  const actualValue = actual?.finalValue ?? 0;

  return (
    <div>
      <div className="mb-7 grid grid-cols-1 gap-px overflow-hidden rounded-[var(--r-card)] border border-[var(--c-line-strong)] bg-[var(--c-border)] shadow-[var(--c-shadow)] sm:grid-cols-2">
        <div className="bg-[var(--c-surface)] px-5 py-[18px]">
          <span className="text-[11.5px] text-[var(--c-muted)]">累積投入</span>
          <span className="mt-1.5 block font-serif text-[26px] font-medium tnum">
            NT$ {fmtTwd(cf.invested)}
          </span>
          <span className="mt-1 block text-[11.5px] text-[var(--c-faint)]">
            從 {cf.firstDate} 起 · {cf.contributions} 筆投入
          </span>
        </div>
        <div className="bg-[var(--c-surface)] px-5 py-[18px]">
          <span className="text-[11.5px] text-[var(--c-muted)]">目前實際組合</span>
          <span
            className={`mt-1.5 block font-serif text-[26px] font-medium tnum ${
              (actual?.returnPct ?? 0) >= 0
                ? "text-[var(--c-up)]"
                : "text-[var(--c-down)]"
            }`}
          >
            NT$ {fmtTwd(actualValue)}
          </span>
          <span className="mt-1 block text-[11.5px] text-[var(--c-faint)]">
            報酬 {sign(actual?.returnPct ?? 0)}
            {Math.abs((actual?.returnPct ?? 0) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <section className="border-t border-[var(--c-border)] pt-7">
        <h2 className="font-serif text-[19px] font-medium tracking-tight">
          如果當初全買 ETF 並 Buy &amp; Hold
        </h2>
        <p className="mt-1 text-[12.5px] text-[var(--c-muted)]">
          用每次投入的當日收盤價買入，之後不賣出、不計成本 — 今天會值多少？
        </p>
        <div className="mt-[18px] flex flex-col gap-2">
          {cf.rows.map((r, i) => {
            const diff = r.finalValue - actualValue;
            return (
              <div
                key={r.label}
                className={`grid grid-cols-[auto_1fr] items-center gap-[13px] rounded-xl border p-[13px] ${
                  r.actual
                    ? "border-[color-mix(in_srgb,var(--c-accent)_45%,transparent)] bg-[var(--c-accent-soft)]"
                    : "border-transparent"
                }`}
              >
                <div className="w-[18px] text-center font-serif text-[17px] text-[var(--c-faint)] tnum">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-[9px]">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ background: r.color }}
                    />
                    <span className="whitespace-nowrap text-[14.5px] font-semibold">
                      {r.label}
                      {r.sym && (
                        <span className="ml-1.5 text-[11.5px] font-medium text-[var(--c-muted)]">
                          {r.sym}
                        </span>
                      )}
                    </span>
                    {r.actual && (
                      <span className="rounded-[5px] bg-[color-mix(in_srgb,var(--c-accent)_16%,transparent)] px-[7px] py-0.5 text-[10px] font-semibold text-[var(--c-accent)]">
                        實際
                      </span>
                    )}
                    <span className="ml-auto whitespace-nowrap text-[15px] font-semibold tnum">
                      NT$ {fmtTwd(r.finalValue)}
                    </span>
                  </div>
                  <div className="mt-[9px] h-[7px] overflow-hidden rounded bg-[var(--c-surface-soft)]">
                    <span
                      className="block h-full rounded transition-[width] duration-700 ease-out"
                      style={{
                        width: `${(r.finalValue / maxVal) * 100}%`,
                        background: r.color,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex gap-4 text-xs tnum">
                    <span
                      className={
                        r.returnPct >= 0
                          ? "text-[var(--c-up)]"
                          : "text-[var(--c-down)]"
                      }
                    >
                      報酬 {sign(r.returnPct)}
                      {(r.returnPct * 100).toFixed(1)}%
                    </span>
                    {!r.actual && (
                      <span
                        className={
                          diff > 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"
                        }
                      >
                        vs 實際 {sign(diff)}NT$ {fmtCompact(Math.abs(diff))}
                      </span>
                    )}
                    {r.skipped > 0 && (
                      <span className="text-[var(--c-down)]">
                        {r.skipped} 筆投入無價格被跳過
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--c-faint)]">
          假設：投入 = 現金流為負的紀錄；配息/賣出視為未發生（buy-and-hold）；SPY/QQQ
          用當日收盤×匯率；未計交易成本與再投資。過去績效不代表未來。
        </p>
      </section>
    </div>
  );
}

/* ---------- 組合 ---------- */
export function WhatIfClient({
  netWorth,
  counterfactual,
}: {
  netWorth: number;
  counterfactual: CounterfactualData | null;
}) {
  const [tab, setTab] = useState<"proj" | "cf">("proj");

  return (
    <div>
      <div className="mb-6 inline-flex rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] p-[3px]">
        {(["proj", "cf"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-md px-[18px] py-2 text-[13.5px] font-semibold transition-all ${
              tab === t
                ? "bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm"
                : "text-[var(--c-muted)]"
            }`}
          >
            {t === "proj" ? "未來推算" : "回測對照"}
          </button>
        ))}
      </div>

      {tab === "proj" ? (
        <ProjectionTab netWorth={netWorth} />
      ) : counterfactual ? (
        <CounterfactualTab cf={counterfactual} />
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center text-sm text-[var(--c-muted)]">
          還沒有任何投入紀錄，先到帳戶頁建立帳戶並加碼後再回來看回測對照。
        </div>
      )}
    </div>
  );
}
