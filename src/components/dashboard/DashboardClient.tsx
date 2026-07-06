"use client";

// 儀表板組合層：資料由 server 端算好傳入，子模組見同目錄各檔。

import { Hero, HeroStat } from "./Hero";
import { fmtTwd } from "./DashboardCharts";
import { sign, toneCls } from "./shared";
import { TrendSection } from "./TrendSection";
import { AllocationCard } from "./AllocationCard";
import { MetricsCard } from "./MetricsCard";
import { Holdings } from "./Holdings";
export type {
  DashSummary,
  AllocTarget,
  Holding,
  DashboardData,
} from "./types";
import type { DashboardData } from "./types";

/* ---------- 組合 ---------- */
// demo：/demo 路由用。關掉會撞 auth 的互動 —
// 刷新鈕（server action）、新增帳戶、帳戶連結（詳情頁需登入）。
export function DashboardClient({
  data,
  demo = false,
}: {
  data: DashboardData;
  demo?: boolean;
}) {
  const s = data.summary;
  const alloc = (
    <AllocationCard
      allocation={data.allocation}
      allocTargets={data.allocTargets}
      total={s.total}
    />
  );
  // 指標 + 被動收入都沒料時，不留半欄空盒——配置改滿版 + 一行說明。
  const metricsHasContent = s.twrShowable || s.hasIncome;

  return (
    <div className="flex flex-col">
      <Hero s={s} series={data.series} demo={demo} />

      {/* 指標四格：置於趨勢圖之前，核心損益不被摺線擠到摺下 */}
      <section className="mt-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-card)] border border-[var(--c-line-strong)] bg-[var(--c-border)] shadow-[var(--c-shadow)] sm:grid-cols-4">
          <HeroStat
            label="總成本"
            mask
            value={`NT$ ${fmtTwd(s.totalCost)}`}
            sub="cost basis"
          />
          <HeroStat
            label="未實現損益"
            mask
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
            mask
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
        benchNotice={data.benchNotice}
        today={data.today}
      />

      
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
          demo={demo}
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
