"use client";

// Midnight Ledger 儀表板互動層。
// page.tsx（server）負責所有 Supabase 抓取與計算，把算好的資料當 props 丟進來；
// 本檔只處理視覺與互動（count-up、hover、排序、區間切換）。

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  allocColor,
  BenchChart,
  Donut,
  fmtCompact,
  fmtTwd,
  Sparkline,
  TrendChart,
  type AllocDatum,
  type BenchSeries,
  type PerfPoint,
  type SeriesPoint,
} from "./DashboardCharts";
import { fmtUpdatedAt } from "@/lib/format";

/* ---------- 對外資料型別（page.tsx 餵入）---------- */
export type DashSummary = {
  total: number;
  totalCost: number;
  unrealized: number;
  unrealizedPct: number;
  totalRealized: number;
  xirr: number | null;
  xirrShowable: boolean;
  dayChange: number | null; // 由快照差算；不足兩筆快照為 null
  dayChangePct: number | null;
  accounts: number;
  lastUpdate: string | null;
  twrCum: number | null;
  twrAnn: number | null;
  maxDrawdown: number | null;
  ddPeak: string | null;
  ddTrough: string | null;
  sharpe: number | null;
  twrShowable: boolean;
  hasIncome: boolean;
  incomeYtd: number;
  income12m: number;
  monthlyAvg: number;
  yieldOnCost: number;
  dividendAll: number;
  interestAll: number;
};

export type AllocTarget = {
  cls: string;
  label: string;
  actual: number;
  target: number;
};

export type Holding = {
  id: string;
  name: string;
  symbol: string | null;
  market: string;
  cls: string;
  value: number;
  cost: number;
  realized: number;
  day: number | null; // 今日漲跌（小數），null = 無前一日快照
  status: string;
};

export type DashboardData = {
  summary: DashSummary;
  series: SeriesPoint[];
  perf: PerfPoint[];
  benchmarks: BenchSeries[];
  hasPerf: boolean;
  allocation: AllocDatum[];
  allocTargets: AllocTarget[];
  holdings: Holding[];
  marketLabel: Record<string, string>;
  today: string;
  archivedCount: number;
  showArchived: boolean;
};

/* ---------- 小工具 ---------- */
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
type Tone = "up" | "down" | "flat";
const toneCls = (n: number): Tone => (n > 0 ? "up" : n < 0 ? "down" : "flat");
const TONE_TEXT: Record<Tone, string> = {
  up: "text-[var(--c-up)]",
  down: "text-[var(--c-down)]",
  flat: "text-[var(--c-muted)]",
};

// count-up：掛載後從 0 緩動到目標值（cubic ease-out）。
function useCountUp(target: number, dur = 1100) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    // prefers-reduced-motion 守衛：跳過 rAF，以 setTimeout 非同步設定終值（對齊 settle 模式）
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setVal(target), 0);
      return () => clearTimeout(id);
    }
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setVal(target * ease(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    const settle = setTimeout(() => setVal(target), dur + 80);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(settle);
    };
  }, [target, dur]);
  return val;
}

function CardHead({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[19px] font-medium tracking-tight">
          {title}
        </h2>
        {sub && (
          <p className="mt-0.5 text-[12.5px] text-[var(--c-muted)]">{sub}</p>
        )}
      </div>
    </div>
  );
}

/* ---------- Hero ---------- */
function Hero({
  s,
  series,
}: {
  s: DashSummary;
  series: SeriesPoint[];
}) {
  const total = useCountUp(s.total);
  const recent = series.slice(-30);
  const hasDay = s.dayChange != null && s.dayChangePct != null;
  const up30 = recent.length >= 2 && recent[recent.length - 1].value >= recent[0].value;
  const chg30Pct =
    recent.length >= 2 && recent[0].value > 0
      ? ((recent[recent.length - 1].value - recent[0].value) / recent[0].value) * 100
      : 0;

  return (
    <section className="grid grid-cols-1 gap-x-5 gap-y-6 px-1 pt-4 sm:grid-cols-[1fr_auto] sm:pt-7">
      {/* 主：總淨資產 */}
      <div className="sm:col-start-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-muted)]">
          總淨資產 · NET WORTH
        </p>
        <h1 className="mt-3 flex items-baseline gap-2 font-serif">
          <span className="text-[14px] font-medium text-[var(--c-muted)]">
            NT$
          </span>
          <span className="text-[clamp(44px,7vw,72px)] font-medium leading-[0.95] tracking-[-0.025em] tnum">
            {Math.round(total).toLocaleString("en-US")}
          </span>
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {hasDay ? (
            <span
              className={`inline-flex items-center gap-[7px] rounded-full border px-3 py-1.5 text-sm font-semibold ${
                s.dayChange! >= 0
                  ? "border-[color-mix(in_srgb,var(--c-up)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-up)_12%,transparent)] text-[var(--c-up)]"
                  : "border-[color-mix(in_srgb,var(--c-down)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)] text-[var(--c-down)]"
              }`}
            >
              <span className="text-[9px]">
                {s.dayChange! >= 0 ? "▲" : "▼"}
              </span>
              {sign(s.dayChange!)}NT${" "}
              {Math.abs(Math.round(s.dayChange!)).toLocaleString("en-US")}
              <span className="pl-0.5 text-[12.5px] opacity-80">
                {sign(s.dayChangePct!)}
                {Math.abs(s.dayChangePct!).toFixed(2)}%
              </span>
            </span>
          ) : null}
          {hasDay && (
            <span className="text-xs text-[var(--c-faint)]">較前一日快照</span>
          )}
          <span className="text-[12.5px] text-[var(--c-muted)]">
            報價更新於 {s.lastUpdate ? fmtUpdatedAt(s.lastUpdate) : "—"} ·{" "}
            {s.accounts} 個帳戶
          </span>
        </div>
      </div>

      {/* 副：近 30 日 instrument panel */}
      {recent.length >= 2 && (
        <div className="sm:col-start-2 sm:flex sm:items-center sm:justify-end">
          <div className="inline-block rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-3 pb-2.5 pt-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-4">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--c-faint)]">
                近 30 日
              </span>
              <span
                className={`text-[11.5px] font-semibold tnum ${up30 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}`}
              >
                {sign(chg30Pct)}{Math.abs(chg30Pct).toFixed(1)}%
              </span>
            </div>
            <Sparkline data={recent} w={150} h={40} up={up30} />
          </div>
        </div>
      )}

    </section>
  );
}

function HeroStat({
  label,
  value,
  tone,
  sub,
  primary,
}: {
  label: string;
  value: string;
  tone?: Tone;
  sub?: string;
  primary?: boolean;
}) {
  return (
    <div className={`bg-[var(--c-surface)] px-4 ${primary ? "py-5" : "py-4"} sm:px-[18px]`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--c-muted)]">
        {label}
      </div>
      <div
        className={`mt-1.5 font-serif ${primary ? "text-[27px]" : "text-[21px]"} font-medium tracking-tight tnum ${
          tone ? TONE_TEXT[tone] : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--c-faint)]">{sub}</div>}
    </div>
  );
}

/* ---------- 趨勢區（淨值 / 大盤對照）---------- */
const RANGES: { k: string; d: number | null }[] = [
  { k: "1M", d: 30 },
  { k: "3M", d: 90 },
  { k: "6M", d: 182 },
  { k: "YTD", d: null },
  { k: "1Y", d: 365 },
  { k: "ALL", d: 9999 },
];

function TrendSection({
  series,
  perf,
  benchmarks,
  hasPerf,
  today,
}: {
  series: SeriesPoint[];
  perf: PerfPoint[];
  benchmarks: BenchSeries[];
  hasPerf: boolean;
  today: string;
}) {
  const [range, setRange] = useState("6M");
  const [mode, setMode] = useState<"value" | "bench">("value");
  const [active, setActive] = useState<Record<string, boolean>>(() => ({
    portfolio: true,
    ...Object.fromEntries(benchmarks.map((b, i) => [b.key, i !== 1])),
  }));

  // 依選定區間切片（YTD 用今天年份起算；其餘取尾端 N 天）。
  function sliceBy<T extends { date: string }>(full: T[]): T[] {
    if (full.length === 0) return full;
    if (range === "ALL") return full;
    if (range === "YTD") {
      const y = today.slice(0, 4);
      return full.filter((p) => p.date >= `${y}-01-01`);
    }
    const d = RANGES.find((r) => r.k === range)?.d ?? null;
    return d == null ? full : full.slice(-d);
  }

  const sliced = useMemo(
    () => sliceBy(series),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, range, today],
  );
  const perfSliced = useMemo(
    () => sliceBy(perf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perf, range, today],
  );

  const enoughValue = sliced.length >= 2;
  const enoughBench = perfSliced.length >= 2;

  const chg = enoughValue
    ? sliced[sliced.length - 1].value - sliced[0].value
    : 0;
  const chgPct = enoughValue && sliced[0].value ? (chg / sliced[0].value) * 100 : 0;

  return (
    <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow)]">
      <div className="mb-3 flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6">
        <div>
          <h2 className="text-[19px] font-medium tracking-tight">
            {mode === "value" ? "淨資產趨勢" : "績效對照"}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--c-muted)]">
            {mode === "value" ? (
              enoughValue ? (
                <>
                  此區間{" "}
                  <span className={TONE_TEXT[toneCls(chg)]}>
                    {sign(chg)}NT$ {Math.abs(Math.round(chg)).toLocaleString("en-US")}{" "}
                    ({sign(chgPct)}
                    {Math.abs(chgPct).toFixed(1)}%)
                  </span>
                </>
              ) : (
                "此區間快照不足兩天"
              )
            ) : (
              "與大盤對照 · 區間起點 = 100 · SPY/QQQ 已換算 TWD"
            )}
          </p>
        </div>
        {hasPerf && (
          <div className="inline-flex self-start rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] p-[3px]">
            {(["value", "bench"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                  mode === m
                    ? "bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm"
                    : "text-[var(--c-muted)]"
                }`}
              >
                {m === "value" ? "淨值" : "大盤對照"}
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
          key={range}
          data={perfSliced}
          series={benchmarks}
          height={300}
          active={active}
        />
      ) : (
        <ChartEmpty>此區間沒有可對照的資料。</ChartEmpty>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4 px-5 pb-4 sm:px-6">
        <div className="inline-flex gap-0.5">
          {RANGES.map((r) => (
            <button
              key={r.k}
              type="button"
              onClick={() => setRange(r.k)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
                range === r.k
                  ? "bg-[var(--c-accent-soft)] text-[var(--c-accent)] shadow-[inset_0_-2px_0_var(--c-accent)]"
                  : "text-[var(--c-muted)] hover:text-[var(--c-text)]"
              }`}
            >
              {r.k}
            </button>
          ))}
        </div>
        {mode === "bench" && (
          <div className="flex flex-wrap gap-1.5">
            <LegendBtn
              on={active.portfolio}
              color="var(--c-accent)"
              label="我的組合"
              onClick={() =>
                setActive((a) => ({ ...a, portfolio: !a.portfolio }))
              }
            />
            {benchmarks.map((b) => (
              <LegendBtn
                key={b.key}
                on={active[b.key]}
                color={b.color}
                label={b.label}
                onClick={() => setActive((a) => ({ ...a, [b.key]: !a[b.key] }))}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LegendBtn({
  on,
  color,
  label,
  onClick,
}: {
  on: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--c-border)] px-2.5 py-1 text-xs font-medium text-[var(--c-text)] transition-all duration-150 hover:border-[var(--c-line-strong)] hover:bg-[var(--c-surface-soft)] ${
        on ? "" : "opacity-40 hover:opacity-60"
      }`}
    >
      <span
        className="h-[9px] w-[9px] rounded-full"
        style={{ background: color }}
      />
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

/* ---------- 配置偏離（percentage points）----------
 * drift = actual − target，單位 pp。這是「離目標多遠」的輔助判斷，
 * 不帶賺賠語義（超配不一定好、低配不一定壞），所以分級只用中性 token：
 *   |drift| < 1   → faint（基本對齊）
 *   1 ≤ |drift| < 5 → muted（輕微提醒）
 *   |drift| ≥ 5   → accent（較明顯提醒，金色只是「看這裡」非好壞）
 * target <= 0 / 不存在 / 非有限值 → 回傳 null（不顯示）。
 * 四捨五入到 1 位小數；接近 0 用 sign("")避免出現 "−0.0pp"。 */
function driftInfo(actual: number, target: number) {
  if (!(target > 0)) return null;
  const raw = actual - target;
  if (!Number.isFinite(raw)) return null;
  const d = Math.round(raw * 10) / 10; // 1 位小數
  const mag = Math.abs(d);
  const tone =
    mag < 1
      ? "var(--c-faint)"
      : mag < 5
        ? "var(--c-muted)"
        : "var(--c-accent)";
  return { text: `${sign(d)}${mag.toFixed(1)}pp`, tone };
}

/* ---------- 配置卡（donut + 目標長條）---------- */
function AllocationCard({
  allocation,
  allocTargets,
  total,
}: {
  allocation: AllocDatum[];
  allocTargets: AllocTarget[];
  total: number;
}) {
  const [hoverCls, setHoverCls] = useState<string | null>(null);
  const sel = hoverCls ? allocation.find((a) => a.cls === hoverCls) : null;

  return (
    <div>
      <CardHead title="資產配置" sub="實際 vs 目標" />
      <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[auto_1fr] sm:gap-7">
        <div className="relative mx-auto h-[188px] w-[188px]">
          <Donut
            data={allocation}
            size={188}
            onHover={setHoverCls}
            hoverCls={hoverCls}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {sel ? (
              <>
                <div className="text-[11px] text-[var(--c-muted)]">
                  {sel.label}
                </div>
                <div className="mt-0.5 font-serif text-[26px] font-medium tnum">
                  {sel.pct.toFixed(1)}%
                </div>
                <div className="mt-0.5 text-[11.5px] text-[var(--c-faint)] tnum">
                  NT$ {fmtCompact(sel.value)}
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] text-[var(--c-muted)]">總資產</div>
                <div className="mt-0.5 font-serif text-[26px] font-medium tnum">
                  {fmtCompact(total)}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[var(--c-faint)]">
                  {allocation.length} 類
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-[11px]">
          {allocTargets.map((a) => (
            <div
              key={a.cls}
              className={`grid grid-cols-[auto_56px_1fr_58px] items-center gap-2.5 transition-opacity ${
                hoverCls && hoverCls !== a.cls ? "opacity-40" : ""
              }`}
              onMouseEnter={() => setHoverCls(a.cls)}
              onMouseLeave={() => setHoverCls(null)}
            >
              <span
                className="h-[9px] w-[9px] rounded-[3px]"
                style={{ background: allocColor(a.cls) }}
              />
              <span className="truncate text-[13px]">{a.label}</span>
              <span className="relative h-[7px] rounded bg-[var(--c-surface-soft)]">
                <span
                  className="absolute inset-y-0 left-0 rounded transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.min(100, a.actual)}%`,
                    background: allocColor(a.cls),
                  }}
                />
                {a.target > 0 && (
                  // 目標 marker：加高、滿對比、加 1px page 色描邊讓它在實際長條上跳出來（D9）
                  <span
                    className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded-full bg-[var(--c-text)] shadow-[0_0_0_1px_var(--c-page)]"
                    style={{ left: `calc(${Math.min(100, a.target)}% - 1px)` }}
                    title={`目標 ${a.target}%`}
                  />
                )}
              </span>
              <span className="flex flex-col items-end leading-tight">
                <span className="text-[12.5px] font-medium tnum">
                  {a.actual.toFixed(1)}%
                </span>
                {(() => {
                  const d = driftInfo(a.actual, a.target);
                  return d ? (
                    <span
                      className="mt-0.5 text-[10px] font-medium tnum"
                      style={{ color: d.tone }}
                      title="相對目標配置的偏離（percentage points）"
                    >
                      {d.text}
                    </span>
                  ) : null;
                })()}
              </span>
            </div>
          ))}
          <p className="text-[11px] text-[var(--c-faint)]">
            <span className="text-[var(--c-text)]">▏</span> = 目標配置
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- 指標 + 被動收入 ---------- */
function MetricsCard({ s }: { s: DashSummary }) {
  const metrics =
    s.twrShowable && s.twrCum != null
      ? [
          {
            label: "TWR 累積",
            value: `${sign(s.twrCum)}${(Math.abs(s.twrCum) * 100).toFixed(1)}%`,
            tone: toneCls(s.twrCum),
            hint: "策略本身報酬",
          },
          {
            label: "TWR 年化",
            value: `${sign(s.twrAnn ?? 0)}${(Math.abs(s.twrAnn ?? 0) * 100).toFixed(1)}%`,
            tone: toneCls(s.twrAnn ?? 0),
            hint: "可與大盤比較",
          },
          {
            label: "最大回撤",
            value: `−${(Math.abs(s.maxDrawdown ?? 0) * 100).toFixed(1)}%`,
            tone: "down" as Tone,
            hint: s.ddPeak && s.ddTrough ? `${s.ddPeak} → ${s.ddTrough}` : "下行風險",
          },
          {
            label: "Sharpe",
            value: (s.sharpe ?? 0).toFixed(2),
            tone: (s.sharpe ?? 0) > 1 ? ("up" as Tone) : ("flat" as Tone),
            hint: ">1 算優秀",
          },
        ]
      : null;

  return (
    <div>
      <CardHead title="績效指標" sub="基於每日淨值快照" />
      {metrics ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-border)]">
          {metrics.map((m) => (
            <div key={m.label} className="bg-[var(--c-surface)] px-4 py-3.5">
              <div className="text-[11.5px] text-[var(--c-muted)]">
                {m.label}
              </div>
              <div
                className={`mt-1.5 font-serif text-[23px] font-medium tnum ${TONE_TEXT[m.tone]}`}
              >
                {m.value}
              </div>
              <div className="mt-0.5 text-[10.5px] text-[var(--c-faint)]">
                {m.hint}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-border)]">
            {["TWR 累積", "TWR 年化", "最大回撤", "Sharpe"].map((label) => (
              <div key={label} className="bg-[var(--c-surface)] px-4 py-3.5">
                <div className="text-[11.5px] text-[var(--c-muted)]">{label}</div>
                <div className="sk mt-1.5 h-[26px] w-[68px] rounded-md" />
                <div className="sk mt-1.5 h-[10px] w-[56px] rounded" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-[var(--c-faint)]">
            快照滿 30 天後顯示
          </p>
        </div>
      )}

      {s.hasIncome && (
        <div className="mt-4 border-t border-[var(--c-border)] pt-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[13.5px] font-semibold">被動收入</span>
            <span className="text-xs font-semibold text-[var(--c-accent)] tnum">
              配息率 {s.yieldOnCost.toFixed(2)}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3.5">
            <IncomeStat label="今年累積" value={`NT$ ${fmtCompact(s.incomeYtd)}`} up />
            <IncomeStat label="近 12 月" value={`NT$ ${fmtCompact(s.income12m)}`} up />
            <IncomeStat label="月均" value={`NT$ ${fmtCompact(s.monthlyAvg)}`} />
          </div>
          <p className="mt-3 text-[10.5px] text-[var(--c-faint)]">
            累計 配息 NT$ {fmtTwd(s.dividendAll)} · 利息 NT$ {fmtTwd(s.interestAll)}
          </p>
        </div>
      )}
    </div>
  );
}

function IncomeStat({
  label,
  value,
  up,
}: {
  label: string;
  value: string;
  up?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11.5px] text-[var(--c-muted)]">{label}</span>
      <span
        className={`text-[17px] font-semibold tnum ${up ? "text-[var(--c-up)]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ---------- 持有資產 ---------- */
type SortKey = "name" | "value" | "day" | "pnl";

function Holdings({
  holdings,
  total,
  marketLabel,
  archivedCount,
  showArchived,
}: {
  holdings: Holding[];
  total: number;
  marketLabel: Record<string, string>;
  archivedCount: number;
  showArchived: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [dir, setDir] = useState(-1);

  const rows = useMemo(() => {
    const r = [...holdings];
    r.sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      let av = 0;
      let bv = 0;
      if (sortKey === "value") {
        av = a.value;
        bv = b.value;
      } else if (sortKey === "pnl") {
        av = a.value - a.cost;
        bv = b.value - b.cost;
      } else {
        // day：null 視為最小
        av = a.day ?? -Infinity;
        bv = b.day ?? -Infinity;
      }
      return dir * (av - bv);
    });
    return r;
  }, [holdings, sortKey, dir]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setDir(-dir);
    else {
      setSortKey(k);
      setDir(-1);
    }
  };
  const caret = (k: SortKey) =>
    sortKey === k ? (dir === -1 ? " ↓" : " ↑") : "";

  const dayCell = (day: number | null) =>
    day == null || day === 0
      ? "—"
      : `${sign(day)}${Math.abs(day * 100).toFixed(2)}%`;

  return (
    <section className="px-5 pb-5 pt-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-medium tracking-tight">
            持有資產
          </h2>
          {archivedCount > 0 && (
            <p className="mt-1 text-sm text-[var(--c-muted)]">
              <Link
                href={showArchived ? "/" : "/?archived=1"}
                className="underline hover:text-[var(--c-text)]"
              >
                {showArchived
                  ? `隱藏 ${archivedCount} 個已歸檔`
                  : `顯示 ${archivedCount} 個已歸檔`}
              </Link>
            </p>
          )}
        </div>
        <Link
          href="/accounts/new"
          className="shrink-0 rounded-[var(--r-control)] bg-[var(--c-accent)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--c-btn-strong-text)] transition hover:brightness-110"
        >
          ＋ 新增帳戶
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center text-sm text-[var(--c-muted)]">
          還沒有任何帳戶。點右上「＋ 新增帳戶」建立第一個。
        </div>
      ) : (
        <>
          {/* 桌機表格（去盒裝：扁平帳本表，靠列分隔線）*/}
          <div className="hidden md:block">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-[var(--c-surface-soft)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--c-muted)]">
                  <Th onClick={() => setSort("name")} align="left">
                    帳戶{caret("name")}
                  </Th>
                  <Th align="left">市場</Th>
                  <Th>佔比</Th>
                  <Th onClick={() => setSort("value")}>市值{caret("value")}</Th>
                  <Th onClick={() => setSort("day")}>今日{caret("day")}</Th>
                  <Th onClick={() => setSort("pnl")}>未實現{caret("pnl")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => {
                  const pnl = h.value - h.cost;
                  const pct = h.cost > 0 ? (pnl / h.cost) * 100 : 0;
                  const share = total > 0 ? (h.value / total) * 100 : 0;
                  return (
                    <tr
                      key={h.id}
                      className={`border-t border-[var(--c-border)] transition-colors hover:bg-[var(--c-surface-soft)] ${
                        h.status === "archived" ? "opacity-60" : ""
                      }`}
                    >
                      <td className="max-w-[260px] px-[18px] py-3.5 text-left">
                        <span
                          className="mr-2.5 inline-block h-2 w-2 rounded-[3px] align-middle"
                          style={{ background: allocColor(h.cls) }}
                        />
                        <Link
                          href={`/accounts/${h.id}`}
                          className="inline-block max-w-[180px] truncate align-middle font-medium hover:text-[var(--c-accent)]"
                        >
                          {h.name}
                        </Link>
                        {h.symbol && (
                          <span className="ml-[7px] text-[11px] font-medium text-[var(--c-muted)]">
                            {h.symbol}
                          </span>
                        )}
                      </td>
                      <td className="px-[18px] py-3.5 text-left text-[var(--c-muted)]">
                        {marketLabel[h.market] ?? h.market}
                      </td>
                      <td className="px-[18px] py-3.5 text-right">
                        <span className="inline-flex items-center justify-end gap-2.5">
                          <span className="h-1.5 w-14 overflow-hidden rounded-[3px] bg-[var(--c-surface-soft)]">
                            <span
                              className="block h-full rounded-[3px]"
                              style={{
                                width: `${share}%`,
                                background: allocColor(h.cls),
                              }}
                            />
                          </span>
                          <span className="w-9 text-right text-[11.5px] text-[var(--c-muted)] tnum">
                            {share.toFixed(1)}%
                          </span>
                        </span>
                      </td>
                      <td className="px-[18px] py-3.5 text-right font-semibold tnum">
                        {fmtTwd(h.value)}
                      </td>
                      <td
                        className={`px-[18px] py-3.5 text-right tnum ${
                          h.day == null ? "text-[var(--c-muted)]" : TONE_TEXT[toneCls(h.day)]
                        }`}
                      >
                        {dayCell(h.day)}
                      </td>
                      <td
                        className={`px-[18px] py-3.5 text-right tnum ${TONE_TEXT[toneCls(pnl)]}`}
                      >
                        {h.cost > 0 ? (
                          <>
                            <div className="font-semibold">
                              {sign(pnl)}
                              {fmtTwd(Math.abs(pnl))}
                            </div>
                            <div className="text-[11px] opacity-85">
                              {sign(pnl)}
                              {Math.abs(pct).toFixed(1)}%
                            </div>
                          </>
                        ) : (
                          <span className="text-[var(--c-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 手機：帳本列（去盒裝，靠底線分隔）*/}
          <div className="border-t border-[var(--c-border)] md:hidden">
            {rows.map((h) => {
              const pnl = h.value - h.cost;
              const pct = h.cost > 0 ? (pnl / h.cost) * 100 : 0;
              const share = total > 0 ? (h.value / total) * 100 : 0;
              return (
                <Link
                  key={h.id}
                  href={`/accounts/${h.id}`}
                  className={`block border-b border-[var(--c-border)] py-3.5 transition-colors hover:bg-[var(--c-surface-soft)] active:bg-[var(--c-accent-soft)] ${
                    h.status === "archived" ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ background: allocColor(h.cls) }}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {h.name}
                          {h.symbol && (
                            <span className="ml-[7px] text-[11px] text-[var(--c-muted)]">
                              {h.symbol}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--c-muted)]">
                          {marketLabel[h.market] ?? h.market} · {share.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tnum">{fmtTwd(h.value)}</div>
                      {h.cost > 0 && (
                        <div className={`text-[11px] tnum ${TONE_TEXT[toneCls(pnl)]}`}>
                          {sign(pnl)}
                          {Math.abs(pct).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 h-[5px] overflow-hidden rounded-[3px] bg-[var(--c-surface-soft)]">
                    <span
                      className="block h-full rounded-[3px]"
                      style={{ width: `${share}%`, background: allocColor(h.cls) }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function Th({
  children,
  align = "right",
  onClick,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`whitespace-nowrap px-[18px] py-3.5 ${
        align === "left" ? "text-left" : "text-right"
      } ${onClick ? "cursor-pointer select-none hover:text-[var(--c-text)]" : ""}`}
    >
      {children}
    </th>
  );
}

/* ---------- 組合 ---------- */
export function DashboardClient({ data }: { data: DashboardData }) {
  const s = data.summary;
  const alloc = (
    <AllocationCard
      allocation={data.allocation}
      allocTargets={data.allocTargets}
      total={s.total}
    />
  );
  // D3：指標 + 被動收入都沒料時，不留半欄空盒——配置改滿版 + 一行說明。
  const metricsHasContent = s.twrShowable || s.hasIncome;

  return (
    <div className="flex flex-col">
      <Hero s={s} series={data.series} />

      {/* 指標四格：物理卡片 shadow + 更強邊框（Vestox 卡片重量感）。
          首屏層級：緊接 Hero、置於趨勢圖之前，核心損益不被摺線擠到摺下。*/}
      <section className="mt-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-card)] border border-[var(--c-line-strong)] bg-[var(--c-border)] shadow-[var(--c-shadow)] sm:grid-cols-4">
          <HeroStat
            label="總成本"
            value={`NT$ ${fmtTwd(s.totalCost)}`}
            sub="cost basis"
          />
          <HeroStat
            label="未實現損益"
            value={`${sign(s.unrealized)}${fmtTwd(Math.abs(s.unrealized))}`}
            tone={toneCls(s.unrealized)}
            sub={`${sign(s.unrealizedPct)}${Math.abs(s.unrealizedPct).toFixed(1)}%`}
            primary
          />
          <HeroStat
            label="已實現"
            value={
              s.totalRealized === 0
                ? "—"
                : `${sign(s.totalRealized)}${fmtTwd(Math.abs(s.totalRealized))}`
            }
            tone={toneCls(s.totalRealized)}
            sub="realized"
          />
          {s.xirrShowable && s.xirr != null ? (
            <HeroStat
              label="年化 XIRR"
              value={`${sign(s.xirr)}${(Math.abs(s.xirr) * 100).toFixed(1)}%`}
              tone={toneCls(s.xirr)}
              sub="money-weighted"
            />
          ) : (
            <HeroStat
              label="年化 XIRR"
              value="—"
              sub="資料未滿 30 天"
            />
          )}
        </div>
      </section>

      <TrendSection
        series={data.series}
        perf={data.perf}
        benchmarks={data.benchmarks}
        hasPerf={data.hasPerf}
        today={data.today}
      />

      {/* 配置 + 指標：並列兩張卡片（Vestox 區塊物理感）*/}
      {metricsHasContent ? (
        <section className="mt-4 grid grid-cols-1 gap-4 min-[920px]:grid-cols-2">
          <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] transition-[transform,border-color] hover:-translate-y-[2px] hover:border-[var(--c-line-strong)] sm:p-6">
            {alloc}
          </div>
          <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] transition-[transform,border-color] hover:-translate-y-[2px] hover:border-[var(--c-line-strong)] sm:p-6">
            <MetricsCard s={s} />
          </div>
        </section>
      ) : (
        <section className="mt-4 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] transition-[transform,border-color] hover:-translate-y-[2px] hover:border-[var(--c-line-strong)] sm:p-6">
          {alloc}
          <p className="mt-5 border-t border-[var(--c-border)] pt-4 text-[12.5px] text-[var(--c-faint)]">
            績效指標待每日淨值快照滿 30 天後顯示（目前樣本不足）。
          </p>
        </section>
      )}

      <div className="mt-4 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow)]">
        <Holdings
          holdings={data.holdings}
          total={s.total}
          marketLabel={data.marketLabel}
          archivedCount={data.archivedCount}
          showArchived={data.showArchived}
        />
      </div>
    </div>
  );
}
