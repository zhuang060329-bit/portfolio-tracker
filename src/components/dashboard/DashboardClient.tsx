"use client";

import Link from "next/link";
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

export function DashboardClient({
  data,
  demo = false,
}: {
  data: DashboardData;
  demo?: boolean;
}) {
  const summary = data.summary;

  if (!demo && data.holdings.length === 0) {
    return <FirstRun />;
  }

  const allocation = (
    <AllocationCard
      allocation={data.allocation}
      allocTargets={data.allocTargets}
      total={summary.total}
    />
  );
  const metricsHasContent = summary.twrShowable || summary.hasIncome;

  return (
    <div className="flex flex-col">
      <Hero s={summary} series={data.series} demo={demo} />

      <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-border)]">
        <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
          <HeroStat
            label="投入成本"
            mask
            value={`NT$ ${fmtTwd(summary.totalCost)}`}
            sub="目前持有部位"
          />
          <HeroStat
            label="未實現損益"
            mask
            value={`${sign(summary.unrealized)}${fmtTwd(Math.abs(summary.unrealized))}`}
            tone={toneCls(summary.unrealized)}
            sub={`${sign(summary.unrealizedPct)}${Math.abs(summary.unrealizedPct).toFixed(1)}%`}
            primary
          />
          <HeroStat
            label="累計已實現"
            value={
              summary.totalRealized === 0
                ? "—"
                : `${sign(summary.totalRealized)}${fmtTwd(Math.abs(summary.totalRealized))}`
            }
            mask
            tone={toneCls(summary.totalRealized)}
            sub="賣出與現金收益"
          />
          {summary.xirrShowable && summary.xirr != null ? (
            <HeroStat
              label="年化 XIRR"
              value={`${sign(summary.xirr)}${(Math.abs(summary.xirr) * 100).toFixed(1)}%`}
              tone={toneCls(summary.xirr)}
              sub="資金加權報酬"
            />
          ) : (
            <HeroStat
              label="年化 XIRR"
              value="—"
              sub="現金流跨度未滿 90 天"
            />
          )}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)]">
        <Holdings
          demo={demo}
          holdings={data.holdings}
          total={summary.total}
          marketLabel={data.marketLabel}
          archivedCount={data.archivedCount}
          showArchived={data.showArchived}
        />
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
        <section className="mt-5 grid grid-cols-1 gap-3 min-[920px]:grid-cols-2">
          <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-6">
            {allocation}
          </div>
          <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-6">
            <MetricsCard s={summary} />
          </div>
        </section>
      ) : (
        <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-6">
          {allocation}
          <p className="mt-5 border-t border-[var(--c-border)] pt-4 text-[12px] text-[var(--c-faint)]">
            TWR、回撤與 Sharpe 會在每日淨值快照滿 30 天後顯示。
          </p>
        </section>
      )}
    </div>
  );
}

function FirstRun() {
  return (
    <section className="mx-auto mt-14 max-w-[520px] rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-11 text-center sm:px-8">
      <svg
        width="26"
        height="26"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        className="mx-auto text-[var(--c-accent)]"
      >
        <path d="M8 1 L15 8 L8 15 L1 8 Z" />
      </svg>
      <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.02em]">
        從第一個資產開始
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--c-muted)]">
        建立帳戶後，這裡會開始累積淨值趨勢、損益、配置與大盤對照。
        已有歷史紀錄時，也可以直接從 CSV 匯入。
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/accounts/new"
          className="rounded-[var(--r-control)] bg-[var(--c-accent)] px-5 py-2.5 text-[13px] font-semibold text-[var(--c-btn-strong-text)] hover:brightness-110"
        >
          建立第一個帳戶
        </Link>
        <Link
          href="/activity"
          className="rounded-[var(--r-control)] border border-[var(--c-border)] px-5 py-2.5 text-[13px] font-medium text-[var(--c-muted)] hover:border-[var(--c-line-strong)] hover:text-[var(--c-text)]"
        >
          匯入 CSV
        </Link>
      </div>
    </section>
  );
}
