"use client";

// 儀表板圖表（手刻 SVG）。帳戶詳情頁另用 recharts 版（PortfolioCharts.tsx）。

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { fmtFull, fmtCompact } from "@/lib/format";
import {
  fmtAxisValue,
  labelCapacity,
  niceTicks,
  pickTickIndices,
} from "./chart-scale";

// 金額格式統一走 lib/format；fmtTwd 別名保留給既有匯入端。
export const fmtTwd = fmtFull;
export { fmtCompact };

// 資產類別配色（9 類 + fallback）。
// 色值定義在 globals.css，深淺兩個主題各一組：同一組 hex 在淺色底下對比不足，
// 圓環扇形會分不出來。這裡只引用 token，不放實際色值。
export const ALLOC_COLORS: Record<string, string> = {
  stock: "var(--c-accent)",
  fund: "var(--c-alloc-fund)",
  crypto: "var(--c-alloc-crypto)",
  precious_metal: "var(--c-alloc-metal)",
  liquid_cash: "var(--c-alloc-cash)",
  other_investment: "var(--c-alloc-other)",
  fixed_asset: "var(--c-alloc-fixed)",
  receivable: "var(--c-alloc-receivable)",
  liability: "var(--c-down)",
};
export const allocColor = (cls: string) => ALLOC_COLORS[cls] ?? "var(--c-muted)";

export type SeriesPoint = { date: string; value: number };
export type PerfPoint = {
  date: string;
  portfolio?: number;
  [key: string]: number | string | undefined;
};
export type BenchSeries = {
  key: string;
  label: string;
  color: string;
  dash?: string;
};
export type AllocDatum = {
  cls: string;
  label: string;
  value: number;
  pct: number;
};

/* ---------- Sparkline ---------- */
/* 測繪桌版本：不填漸層，改畫兩件量測用的東西——
   起點高度的虛線基準（一眼看出現在比 30 天前高或低），
   以及起點、終點各一根短刻度。終點再加一個實心方點標出「現在」。
   上下各留 3px，讓方點與刻度不被 viewBox 切掉。 */
export function Sparkline({
  data,
  w = 132,
  h = 40,
  up = true,
}: {
  data: SeriesPoint[];
  w?: number;
  h?: number;
  up?: boolean;
}) {
  if (data.length < 2) return null;
  const pad = 3;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const nx = (i: number) => (i / (data.length - 1)) * (w - pad * 2) + pad;
  const ny = (v: number) =>
    h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const d = vals
    .map((v, i) => `${i ? "L" : "M"}${nx(i).toFixed(1)},${ny(v).toFixed(1)}`)
    .join(" ");
  const stroke = up ? "var(--c-up)" : "var(--c-down)";
  const y0 = ny(vals[0]);
  const xEnd = nx(vals.length - 1);
  const yEnd = ny(vals[vals.length - 1]);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="overflow-visible">
      <line
        x1={pad}
        x2={w - pad}
        y1={y0}
        y2={y0}
        stroke="var(--c-line-strong)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <line x1={pad} x2={pad} y1={y0 - 4} y2={y0 + 4} stroke="var(--c-muted)" strokeWidth="1" />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="miter"
      />
      <rect x={xEnd - 2.5} y={yEnd - 2.5} width="5" height="5" fill={stroke} />
    </svg>
  );
}

/* ---------- 淨值面積圖（描繪動畫 + hover）---------- */
export function TrendChart({
  data,
  height = 300,
}: {
  data: SeriesPoint[];
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [len, setLen] = useState(0);

  useEffect(() => {
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  // 描繪動畫：掛載後（非同步）觸發 stroke-dashoffset → 0。
  // 切換區間時由父層的 key 重新掛載本元件來重播。
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 40);
    return () => clearTimeout(t);
  }, []);

  const padT = 16;
  const padB = 30;
  const padL = 52;
  const padR = 16;
  const H = height;
  const vals = data.map((d) => d.value);
  // 值域交給 niceTicks 決定：刻度落在整數，首尾刻度就是值域端點。
  // 原本是 min/max 上下各推 12% 當留白，那段留白沒有刻度，等於白白吃掉
  // 兩成的繪圖高度，線的振幅被壓扁。
  const { lo, hi, ticks } = niceTicks(Math.min(...vals), Math.max(...vals));
  const nx = (i: number) => padL + (i / (data.length - 1)) * (w - padL - padR);
  const ny = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  const line = data
    .map((d, i) => `${i ? "L" : "M"}${nx(i).toFixed(1)},${ny(d.value).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${nx(data.length - 1)},${H - padB} L${nx(0)},${
    H - padB
  } Z`;

  useEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength());
  }, [line]);

  const setFromClientX = useCallback(
    (clientX: number) => {
      if (!wrapRef.current || data.length < 2) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      let idx = Math.round(((x - padL) / (w - padL - padR)) * (data.length - 1));
      idx = Math.max(0, Math.min(data.length - 1, idx));
      setHover(idx);
    },
    [w, data.length],
  );
  const onMove = useCallback(
    (e: React.MouseEvent) => setFromClientX(e.clientX),
    [setFromClientX],
  );
  // 觸控 scrubbing：touch-action pan-y 讓水平滑動歸圖表、垂直保留給頁面捲動
  const onTouch = useCallback(
    (e: React.TouchEvent) => setFromClientX(e.touches[0].clientX),
    [setFromClientX],
  );
  // 鍵盤逐日移動；Home/End 跳頭尾
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (data.length < 2) return;
      const cur = hover ?? data.length - 1;
      let next: number | null = null;
      if (e.key === "ArrowLeft") next = Math.max(0, cur - 1);
      else if (e.key === "ArrowRight") next = Math.min(data.length - 1, cur + 1);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = data.length - 1;
      else if (e.key === "Escape") {
        setHover(null);
        return;
      }
      if (next !== null) {
        e.preventDefault();
        setHover(next);
      }
    },
    [hover, data.length],
  );

  const hi_ =
    hover != null && Number.isFinite(hover) && hover < data.length
      ? data[hover]
      : null;

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-[var(--r-control)]"
      style={{ touchAction: "pan-y" }}
      tabIndex={0}
      role="group"
      aria-roledescription="互動圖表"
      aria-label="淨資產趨勢圖。左右方向鍵逐日檢視，Home/End 跳至頭尾。"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      onTouchStart={onTouch}
      onTouchMove={onTouch}
      onKeyDown={onKeyDown}
    >
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--c-accent)" stopOpacity="0.20" />
            <stop offset="0.7" stopColor="var(--c-accent)" stopOpacity="0.05" />
            <stop offset="1" stopColor="var(--c-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={w - padR}
              y1={ny(t)}
              y2={ny(t)}
              stroke="var(--c-grid)"
              strokeWidth="1"
            />
            {/* 基線對齊格線中央。原本是 y = ny(t) - 4 把字擺在格線「上方」，
                最高那條的標籤落在 y=12，貼著 SVG 頂緣，而且字與格線沒有對齊，
                讀者得自己判斷這個數字屬於哪條線。 */}
            <text
              x={padL - 8}
              y={ny(t)}
              className="amt tnum text-[length:var(--fs-axis)]"
              fill="var(--c-faint)"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {fmtAxisValue(t)}
            </text>
          </g>
        ))}
        {data.length >= 3 &&
          pickTickIndices(data.length, labelCapacity(w - padL - padR)).map(
            (di, i, all) => (
              <text
                key={di}
                x={nx(di)}
                y={H - 8}
                className="text-[length:var(--fs-axis)]"
                fill="var(--c-faint)"
                textAnchor={
                  i === 0 ? "start" : i === all.length - 1 ? "end" : "middle"
                }
              >
                {data[di].date.slice(5).replace("-", "/")}
              </text>
            ),
          )}
        <path
          className="chart-reveal"
          d={area}
          fill="url(#trendFill)"
          opacity={drawn ? 1 : 0}
          style={{ transition: "opacity .34s ease" }}
        />
        <path
          ref={pathRef}
          className="chart-reveal"
          d={line}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: len,
            strokeDashoffset: drawn ? 0 : len,
            transition: "stroke-dashoffset .34s cubic-bezier(.4,0,.2,1)",
          }}
        />
        {hi_ && (
          <g>
            <line
              x1={nx(hover!)}
              x2={nx(hover!)}
              y1={padT}
              y2={H - padB}
              stroke="var(--c-accent)"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.5"
            />
            <circle
              cx={nx(hover!)}
              cy={ny(hi_.value)}
              r="4.5"
              fill="var(--c-accent)"
              stroke="var(--c-page)"
              strokeWidth="2"
            />
          </g>
        )}
        {!hi_ && (
          <circle
            className="chart-reveal"
            cx={nx(data.length - 1)}
            cy={ny(data[data.length - 1].value)}
            r="3.5"
            fill="var(--c-accent)"
            stroke="var(--c-surface)"
            strokeWidth="2"
            opacity={drawn ? 1 : 0}
            style={{ transition: "opacity .34s ease" }}
          />
        )}
      </svg>
      {hi_ && (
        <div
          className="tooltip-pop pointer-events-none absolute top-1.5 z-[5] -translate-x-1/2 whitespace-nowrap rounded-[var(--r-card)] border border-[var(--c-line-strong)] bg-[var(--c-surface-soft)] px-[11px] py-2 shadow-[var(--c-shadow)]"
          style={{ left: Math.min(Math.max(nx(hover!), 70), w - 70) }}
        >
          <div className="amt font-mono text-base font-semibold">
            NT$ {fmtTwd(hi_.value)}
          </div>
          <div className="mt-px text-[length:var(--fs-micro)] text-[var(--c-muted)]">
            {hi_.date}
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {hi_ ? `${hi_.date}，淨資產 ${fmtTwd(hi_.value)} 元` : ""}
      </span>
    </div>
  );
}

/* ---------- 大盤對照多線圖（區間起點 = 100）---------- */
export function BenchChart({
  data,
  series,
  height = 300,
  active,
}: {
  data: PerfPoint[];
  series: BenchSeries[];
  height?: number;
  active: Record<string, boolean>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  // 淡入動畫：掛載後（非同步）觸發。切換區間由父層 key 重播。
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 40);
    return () => clearTimeout(t);
  }, []);

  const padT = 16;
  const padB = 30;
  const padL = 52;
  const padR = 16;
  const H = height;
  const keys = ["portfolio", ...series.map((s) => s.key)].filter(
    (k) => active[k],
  );

  // 真實資料是稀疏的（組合只在快照日有值、benchmark 只在交易日有值），
  // 所以 normalize 時用「區間內第一個有值」當基準，缺值點標 null 並在連線時跨接。
  const norm: Record<string, (number | null)[]> = {};
  for (const k of keys) {
    let base: number | null = null;
    for (const d of data) {
      const v = d[k];
      if (typeof v === "number") {
        base = v;
        break;
      }
    }
    norm[k] = data.map((d) => {
      const v = d[k];
      return base && base > 0 && typeof v === "number" ? (v / base) * 100 : null;
    });
  }

  const all = keys.flatMap((k) =>
    norm[k].filter((v): v is number => v != null),
  );
  const { lo, hi, ticks } = niceTicks(
    all.length ? Math.min(...all) : 95,
    all.length ? Math.max(...all) : 105,
  );
  const nx = (i: number) => padL + (i / (data.length - 1)) * (w - padL - padR);
  const ny = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const colorOf = (k: string) =>
    k === "portfolio"
      ? "var(--c-accent)"
      : (series.find((s) => s.key === k)?.color ?? "var(--c-muted)");
  const dashOf = (k: string) =>
    k === "portfolio" ? undefined : series.find((s) => s.key === k)?.dash;

  // 實線段：只連相鄰都有值的點，null 點不跨接。
  const solidPathOf = (k: string) => {
    let d = "";
    let lastI: number | null = null;
    norm[k].forEach((v, i) => {
      if (v == null) { lastI = null; return; }
      d += `${lastI === null ? "M" : "L"}${nx(i).toFixed(1)},${ny(v).toFixed(1)} `;
      lastI = i;
    });
    return d.trim();
  };

  // 橋接虛線：跨越 null 空缺，連接缺口兩端點，讓使用者看出資料有斷層。
  const gapPathOf = (k: string) => {
    let d = "";
    let lastNonNull: { i: number; v: number } | null = null;
    let inGap = false;
    norm[k].forEach((v, i) => {
      if (v != null) {
        if (inGap && lastNonNull != null) {
          d += `M${nx(lastNonNull.i).toFixed(1)},${ny(lastNonNull.v).toFixed(1)} L${nx(i).toFixed(1)},${ny(v).toFixed(1)} `;
          inGap = false;
        }
        lastNonNull = { i, v };
      } else {
        if (lastNonNull != null) inGap = true;
      }
    });
    return d.trim();
  };

  const setFromClientX = (clientX: number) => {
    if (!wrapRef.current || data.length < 2) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const idx = Math.round(
      ((clientX - rect.left - padL) / (w - padL - padR)) * (data.length - 1),
    );
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  };
  const onMove = (e: React.MouseEvent) => setFromClientX(e.clientX);
  const onTouch = (e: React.TouchEvent) => setFromClientX(e.touches[0].clientX);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (data.length < 2) return;
    const cur = hover ?? data.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = Math.max(0, cur - 1);
    else if (e.key === "ArrowRight") next = Math.min(data.length - 1, cur + 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = data.length - 1;
    else if (e.key === "Escape") {
      setHover(null);
      return;
    }
    if (next !== null) {
      e.preventDefault();
      setHover(next);
    }
  };
  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-[var(--r-control)]"
      style={{ touchAction: "pan-y" }}
      tabIndex={0}
      role="group"
      aria-roledescription="互動圖表"
      aria-label="組合與大盤對照圖。左右方向鍵逐日檢視，Home/End 跳至頭尾。"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      onTouchStart={onTouch}
      onTouchMove={onTouch}
      onKeyDown={onKeyDown}
    >
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        style={{ display: "block", overflow: "visible" }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={w - padR}
              y1={ny(t)}
              y2={ny(t)}
              stroke="var(--c-grid)"
              strokeWidth="1"
            />
            <text
              x={padL - 8}
              y={ny(t)}
              className="tnum text-[length:var(--fs-axis)]"
              fill="var(--c-faint)"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {t.toFixed(0)}
            </text>
          </g>
        ))}
        {/* 起點 100 是這張圖的判讀基準，畫實一點讓「贏了大盤還輸了」一眼看出。 */}
        {lo < 100 && hi > 100 && (
          <line
            x1={padL}
            x2={w - padR}
            y1={ny(100)}
            y2={ny(100)}
            stroke="var(--c-line-strong)"
            strokeWidth="1"
          />
        )}
        {data.length > 1 &&
          pickTickIndices(data.length, labelCapacity(w - padL - padR)).map(
            (di, i, all) => {
              const sameYear =
                data[0].date.slice(0, 4) ===
                data[data.length - 1].date.slice(0, 4);
              const date = data[di].date;
              const label =
                sameYear || i === 0 || i === all.length - 1
                  ? date.slice(5).replace("-", "/")
                  : date.slice(0, 7).replace("-", "/");
              return (
                <text
                  key={di}
                  x={nx(di)}
                  y={H - 8}
                  className="text-[length:var(--fs-axis)]"
                  fill="var(--c-faint)"
                  textAnchor={
                    i === 0 ? "start" : i === all.length - 1 ? "end" : "middle"
                  }
                >
                  {label}
                </text>
              );
            },
          )}
        {keys.map((k) => (
          <path
            key={k}
            className="chart-reveal"
            d={solidPathOf(k)}
            fill="none"
            stroke={colorOf(k)}
            strokeWidth={k === "portfolio" ? 2.75 : 1.6}
            strokeDasharray={dashOf(k)}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={drawn ? (k === "portfolio" ? 1 : 0.72) : 0}
            style={{ transition: "opacity .34s ease" }}
          />
        ))}
        {keys.map((k) => {
          const gd = gapPathOf(k);
          if (!gd) return null;
          return (
            <path
              key={`gap-${k}`}
              className="chart-reveal"
              d={gd}
              fill="none"
              stroke={colorOf(k)}
              strokeWidth={k === "portfolio" ? 1.5 : 1.2}
              strokeDasharray="2 5"
              strokeLinecap="round"
              opacity={drawn ? 0.35 : 0}
              style={{ transition: "opacity .34s ease" }}
            />
          );
        })}
        {hover != null && hover < data.length && (
          <line
            x1={nx(hover)}
            x2={nx(hover)}
            y1={padT}
            y2={H - padB}
            stroke="var(--c-muted)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.4"
          />
        )}
        {hover != null && hover < data.length &&
          keys.map((k) => {
            const v = norm[k][hover];
            if (v == null) return null;
            return (
              <circle
                key={k}
                cx={nx(hover)}
                cy={ny(v)}
                r="3.5"
                fill={colorOf(k)}
                stroke="var(--c-page)"
                strokeWidth="1.5"
              />
            );
          })}
      </svg>
      {hover != null && hover < data.length && (
        <div
          className="tooltip-pop pointer-events-none absolute top-1.5 z-[5] -translate-x-1/2 whitespace-nowrap rounded-[var(--r-card)] border border-[var(--c-line-strong)] bg-[var(--c-surface-soft)] px-[11px] py-2 shadow-[var(--c-shadow)]"
          style={{ left: Math.min(Math.max(nx(hover), 90), w - 90) }}
        >
          <div className="mb-1 text-[length:var(--fs-micro)] text-[var(--c-muted)]">
            {data[hover].date}
          </div>
          {keys.map((k) => {
            const v = norm[k][hover];
            if (v == null) return null;
            return (
              <div
                key={k}
                className="mt-[3px] flex items-center gap-[7px] text-xs"
              >
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: colorOf(k) }}
                />
                <span className="text-[var(--c-muted)]">
                  {k === "portfolio"
                    ? "我的組合"
                    : (series.find((s) => s.key === k)?.label ?? k)}
                </span>
                <span
                  className="ml-auto font-semibold tnum"
                  style={{ color: v >= 100 ? "var(--c-up)" : "var(--c-down)" }}
                >
                  {v >= 100 ? "+" : "−"}
                  {Math.abs(v - 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {hover != null && hover < data.length
          ? `${data[hover].date}，${keys
              .map((key) => {
                const value = norm[key][hover];
                if (value == null) return null;
                const label =
                  key === "portfolio"
                    ? "我的組合"
                    : (series.find((item) => item.key === key)?.label ?? key);
                return `${label} ${value >= 100 ? "上漲" : "下跌"} ${Math.abs(value - 100).toFixed(1)}%`;
              })
              .filter(Boolean)
              .join("，")}`
          : ""}
      </span>
    </div>
  );
}
