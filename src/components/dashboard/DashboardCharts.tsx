"use client";

// 儀表板圖表（手刻 SVG）。帳戶詳情頁另用 recharts 版（PortfolioCharts.tsx）。

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { fmtFull, fmtCompact } from "@/lib/format";

// 金額格式統一走 lib/format；fmtTwd 別名保留給既有匯入端。
export const fmtTwd = fmtFull;
export { fmtCompact };

// 資產類別配色（9 類 + fallback）
export const ALLOC_COLORS: Record<string, string> = {
  stock: "var(--c-accent)",
  fund: "#7FA8C9",
  crypto: "#C5956B",
  precious_metal: "#E0B15F",
  liquid_cash: "#7FBFA3",
  other_investment: "#B0926A",
  fixed_asset: "#9C8AA5",
  receivable: "#7FB0B5",
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
  // 漸層 id 需穩定且唯一；useId 的 ":" 不合 url(#) 語法，去掉。
  const id = "sp" + useId().replace(/:/g, "");
  if (data.length < 2) return null;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const nx = (i: number) => (i / (data.length - 1)) * w;
  const ny = (v: number) => h - ((v - min) / (max - min || 1)) * h;
  const d = vals
    .map((v, i) => `${i ? "L" : "M"}${nx(i).toFixed(1)},${ny(v).toFixed(1)}`)
    .join(" ");
  const stroke = up ? "var(--c-up)" : "var(--c-down)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.12 || 1;
  const lo = min - pad;
  const hi = max + pad;
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

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + t * (hi - lo));
  const hi_ =
    hover != null && Number.isFinite(hover) && hover < data.length
      ? data[hover]
      : null;

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)]"
      style={{ touchAction: "pan-y" }}
      tabIndex={0}
      role="application"
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
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={w - padR}
              y1={ny(t)}
              y2={ny(t)}
              stroke="var(--c-border)"
              strokeWidth="1"
            />
            <text
              x={padL - 6}
              y={ny(t) - 4}
              className="amt tnum"
              fontSize={10}
              fill="var(--c-faint)"
              textAnchor="end"
            >
              {fmtCompact(t)}
            </text>
          </g>
        ))}
        {data.length >= 3 &&
          [0, Math.floor((data.length - 1) / 2), data.length - 1].map((di) => (
            <text
              key={di}
              x={nx(di)}
              y={H - 8}
              fontSize={10}
              fill="var(--c-faint)"
              textAnchor={
                di === 0 ? "start" : di === data.length - 1 ? "end" : "middle"
              }
            >
              {data[di].date.slice(5).replace("-", "/")}
            </text>
          ))}
        <path
          d={area}
          fill="url(#trendFill)"
          opacity={drawn ? 1 : 0}
          style={{ transition: "opacity .6s ease .3s" }}
        />
        <path
          ref={pathRef}
          d={line}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: len,
            strokeDashoffset: drawn ? 0 : len,
            transition: "stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)",
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
            cx={nx(data.length - 1)}
            cy={ny(data[data.length - 1].value)}
            r="3.5"
            fill="var(--c-accent)"
            stroke="var(--c-surface)"
            strokeWidth="2"
            opacity={drawn ? 1 : 0}
            style={{ transition: "opacity .6s ease 1s" }}
          />
        )}
      </svg>
      {hi_ && (
        <div
          className="tooltip-pop pointer-events-none absolute top-1.5 z-[5] -translate-x-1/2 whitespace-nowrap rounded-[10px] border border-[var(--c-line-strong)] bg-[var(--c-surface-soft)] px-[11px] py-2 shadow-[var(--c-shadow)]"
          style={{ left: Math.min(Math.max(nx(hover!), 70), w - 70) }}
        >
          <div className="amt font-serif text-base font-semibold">
            NT$ {fmtTwd(hi_.value)}
          </div>
          <div className="mt-px text-[11px] text-[var(--c-muted)]">
            {hi_.date}
          </div>
        </div>
      )}
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
  const min = all.length ? Math.min(...all) : 95;
  const max = all.length ? Math.max(...all) : 105;
  const pad = (max - min) * 0.1 || 1;
  const lo = min - pad;
  const hi = max + pad;
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
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + t * (hi - lo));

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)]"
      style={{ touchAction: "pan-y" }}
      tabIndex={0}
      role="application"
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
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={w - padR}
              y1={ny(t)}
              y2={ny(t)}
              stroke="var(--c-border)"
              strokeWidth="1"
            />
            <text
              x={padL - 6}
              y={ny(t) - 4}
              className="tnum"
              fontSize={10}
              fill="var(--c-faint)"
              textAnchor="end"
            >
              {t.toFixed(0)}
            </text>
          </g>
        ))}
        {data.length > 1 && (
          <>
            <text
              x={nx(0)}
              y={H - 8}
              fontSize={10}
              fill="var(--c-faint)"
              textAnchor="start"
            >
              {data[0].date.slice(5).replace("-", "/")}
            </text>
            {data.length > 60 && (() => {
              const midI = Math.floor((data.length - 1) / 2);
              const midDate = data[midI].date;
              const sameYear =
                data[0].date.slice(0, 4) === data[data.length - 1].date.slice(0, 4);
              const label = sameYear
                ? midDate.slice(5).replace("-", "/")
                : midDate.slice(0, 7).replace("-", "/");
              return (
                <text
                  x={nx(midI)}
                  y={H - 8}
                  fontSize={10}
                  fill="var(--c-faint)"
                  textAnchor="middle"
                >
                  {label}
                </text>
              );
            })()}
            <text
              x={nx(data.length - 1)}
              y={H - 8}
              fontSize={10}
              fill="var(--c-faint)"
              textAnchor="end"
            >
              {data[data.length - 1].date.slice(5).replace("-", "/")}
            </text>
          </>
        )}
        {keys.map((k) => (
          <path
            key={k}
            d={solidPathOf(k)}
            fill="none"
            stroke={colorOf(k)}
            strokeWidth={k === "portfolio" ? 2.75 : 1.6}
            strokeDasharray={dashOf(k)}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={drawn ? (k === "portfolio" ? 1 : 0.72) : 0}
            style={{ transition: "opacity .7s ease" }}
          />
        ))}
        {keys.map((k) => {
          const gd = gapPathOf(k);
          if (!gd) return null;
          return (
            <path
              key={`gap-${k}`}
              d={gd}
              fill="none"
              stroke={colorOf(k)}
              strokeWidth={k === "portfolio" ? 1.5 : 1.2}
              strokeDasharray="2 5"
              strokeLinecap="round"
              opacity={drawn ? 0.35 : 0}
              style={{ transition: "opacity .7s ease" }}
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
          className="tooltip-pop pointer-events-none absolute top-1.5 z-[5] -translate-x-1/2 whitespace-nowrap rounded-[10px] border border-[var(--c-line-strong)] bg-[var(--c-surface-soft)] px-[11px] py-2 shadow-[var(--c-shadow)]"
          style={{ left: Math.min(Math.max(nx(hover), 90), w - 90) }}
        >
          <div className="mb-1 text-[11px] text-[var(--c-muted)]">
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
    </div>
  );
}

/* ---------- 配置甜甜圈 ---------- */
export function Donut({
  data,
  size = 188,
  onHover,
  hoverCls,
}: {
  data: AllocDatum[];
  size?: number;
  onHover?: (cls: string | null) => void;
  hoverCls?: string | null;
}) {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const rad = r - 14;
  const inner = rad - 26;
  // 用前綴和算每段起訖角度（從 -90° 起、順時針），避免在 render 內突變外層變數。
  const angles = data.map((d) => (d.pct / 100) * 360);
  const segs = data.map((d, i) => {
    const start = -90 + angles.slice(0, i).reduce((sum, a) => sum + a, 0);
    return { ...d, start, end: start + angles[i] };
  });
  const arc = (a0: number, a1: number) => {
    const p = (a: number, rr: number): [number, number] => [
      cx + rr * Math.cos((a * Math.PI) / 180),
      cy + rr * Math.sin((a * Math.PI) / 180),
    ];
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = p(a0, rad);
    const [x1, y1] = p(a1, rad);
    const [x2, y2] = p(a1, inner);
    const [x3, y3] = p(a0, inner);
    return `M${x0},${y0} A${rad},${rad} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${inner},${inner} 0 ${large} 0 ${x3},${y3} Z`;
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segs.map((s) => {
        const dim = hoverCls && hoverCls !== s.cls;
        return (
          <path
            key={s.cls}
            d={arc(s.start, s.end)}
            fill={allocColor(s.cls)}
            opacity={dim ? 0.32 : 1}
            onMouseEnter={() => onHover?.(s.cls)}
            onMouseLeave={() => onHover?.(null)}
            style={{ transition: "opacity .2s", cursor: "default" }}
          />
        );
      })}
    </svg>
  );
}
