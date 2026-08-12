"use client";

import { Sparkline, type SeriesPoint } from "./DashboardCharts";
import { fmtUpdatedAt } from "@/lib/format";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import type { DashSummary } from "./types";
import { sign, TONE_TEXT, type Tone } from "./shared";
import { useCountUp } from "./useCountUp";

export function Hero({
  s,
  series,
  demo,
}: {
  s: DashSummary;
  series: SeriesPoint[];
  demo?: boolean;
}) {
  const total = useCountUp(s.total);
  const recent = series.slice(-30);
  const hasDay = s.dayChange != null && s.dayChangePct != null;
  const change30 =
    recent.length >= 2 ? recent[recent.length - 1].value - recent[0].value : 0;
  const up30 = change30 >= 0;

  return (
    <section className="grid grid-cols-1 gap-6 border-b border-[var(--c-border)] pb-7 pt-4 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-end sm:gap-8 sm:pb-8 sm:pt-7">
      <div className="min-w-0">
        {/* 原本的 h1 內容就是金額本身，讀屏使用者按標題鍵跳到頁首會聽到一串數字，
            而且金額每次刷新報價都變，頁面等於沒有穩定的名字。
            金額降級成 div，標題另外用 sr-only 給。sr-only 是 clip-path 不是
            display:none，元素仍留在無障礙樹裡，而 CardHead 用 h2，層級接得上。 */}
        <h1 className="sr-only">投資組合總覽</h1>
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--c-muted)]">
          總淨資產
        </p>
        <div className="mt-3 flex min-w-0 items-baseline gap-2 font-serif">
          <span className="shrink-0 text-[14px] font-medium text-[var(--c-faint)] sm:text-[16px]">
            NT$
          </span>
          {/* 這裡原本用 truncate，數字的頂端會被切掉。
              truncate 帶的是 overflow:hidden，而 leading-[0.92] 讓行框（0.92em）
              比 Newsreader 自身的字框（1.008em）矮，上下各溢出約 2.75px，
              於是被裁。實測 62.5px 字級下墨水頂端在基線上方 45.9px，
              行框只給到 43.25px，短少 2.65px——切的是數字上緣。

              改用 whitespace-nowrap：保留不換行，但不裁切，垂直排版一格未動
              （拉高 leading 或補 padding 都會讓這塊長高約 6px）。
              truncate 原本要防的水平溢出實測用不到：375px 下可用寬度 305px，
              連 NT$9,999,999,999 都只要 265px。 */}
          <span className="amt min-w-0 whitespace-nowrap text-[clamp(40px,7vw,68px)] font-medium leading-[0.92] tracking-[-0.045em] tnum">
            {Math.round(total).toLocaleString("en-US")}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2 text-[12px] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
          {hasDay && (
            <span className={`font-semibold tnum ${TONE_TEXT[s.dayChange! >= 0 ? "up" : "down"]}`}>
              <span className="amt">
                {sign(s.dayChange!)}NT${" "}
                {Math.abs(Math.round(s.dayChange!)).toLocaleString("en-US")}
              </span>
              <span className="ml-1.5">
                {sign(s.dayChangePct!)}
                {Math.abs(s.dayChangePct!).toFixed(2)}%
              </span>
              <span className="ml-2 font-normal text-[var(--c-faint)]">今日</span>
            </span>
          )}
          <span className="flex flex-wrap items-center gap-1 text-[var(--c-muted)]">
            報價 {s.lastUpdate ? fmtUpdatedAt(s.lastUpdate) : "—"}
            <span className="text-[var(--c-faint)]">·</span>
            {s.accounts} 個帳戶
            {!demo && <RefreshPricesButton />}
          </span>
        </div>
      </div>

      {recent.length >= 2 && (
        <div className="border-t border-[var(--c-border)] pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold tracking-[0.06em] text-[var(--c-muted)]">
              近 30 日
            </span>
            <span
              className={`amt text-[11px] font-semibold tnum ${up30 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}`}
            >
              {sign(change30)}NT${" "}
              {Math.abs(Math.round(change30)).toLocaleString("en-US")}
            </span>
          </div>
          <Sparkline data={recent} w={164} h={42} up={up30} />
        </div>
      )}
    </section>
  );
}

export function HeroStat({
  label,
  value,
  tone,
  sub,
  primary,
  mask,
}: {
  label: string;
  value: string;
  tone?: Tone;
  sub?: string;
  primary?: boolean;
  mask?: boolean;
}) {
  return (
    <div className="min-w-0 bg-[var(--c-surface)] px-4 py-4 sm:px-5 sm:py-[18px]">
      <div className="text-[11px] font-medium text-[var(--c-muted)]">{label}</div>
      <div
        className={`mt-2 truncate ${primary ? "text-[23px]" : "text-[20px]"} font-semibold tracking-[-0.025em] tnum ${
          tone ? TONE_TEXT[tone] : ""
        } ${mask ? "amt" : ""}`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-[var(--c-faint)]">{sub}</div>}
    </div>
  );
}
