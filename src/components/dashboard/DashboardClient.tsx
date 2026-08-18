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

  /* 三級層級。區分手段是「有沒有容器 + 間距 + 字級」，不是圓角或陰影深淺：
     改版前五個區塊全是同一套 rounded+border+surface，權重一模一樣，
     眼睛沒有進入點（V1）。實測那層 border 對底色只有 1.25:1，
     問題從來不是邊界太弱，而是五個東西都戴著同一頂帽子。

     一級 頂部摘要（Hero + 四格關鍵指標）：無容器，落在 page 背景。
     二級 核心資料（持倉帳本、淨資產趨勢）：唯二保留 surface 容器的區塊。
     三級 輔助（資產配置、績效指標）：無容器，靠頂部 hairline 分區。 */
  return (
    <div className="flex flex-col">
      <Hero s={summary} series={data.series} demo={demo} />

      {/* 容器底色透出成 1px 分隔線，四格之間有線、外圍沒有框。
          原本這層還包著卡片殼，等於「卡片裡再放四張卡」（V6）。

          負邊距抵銷格子自己的左右內距：這四格屬於一級，左緣要跟 Hero 對齊。
          不抵銷的話量出來是 88px，而 Hero 與三級都在 68px（實測）。
          外緣溢出的部分是格子自身的 page 底色，看不出來；抵銷量恆不大於
          main 的 gutter（16/24/28 對 16/20/20），不會產生水平捲動。 */}
      <section className="-mx-4 bg-[var(--c-border)] sm:-mx-5">
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

      {/* 二級起點。與一級之間拉開 36px，是全頁最大的一段間距，
          用留白把「摘要」和「明細」切成兩塊。二級彼此只隔 16px，讀起來成一組。 */}
      <section className="mt-9 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)]">
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

      {/* 三級。脫掉容器落回 page 背景，靠頂線分區；桌機兩欄之間用垂直細線，
          手機上下排時改水平線。與二級之間隔 40px，把「這是附註」講清楚。 */}
      {metricsHasContent ? (
        <section className="mt-10 grid grid-cols-1 border-t border-[var(--c-border)] pt-7 min-[920px]:grid-cols-2">
          <div className="min-[920px]:pr-8">{allocation}</div>
          <div className="mt-8 border-t border-[var(--c-border)] pt-7 min-[920px]:mt-0 min-[920px]:border-l min-[920px]:border-t-0 min-[920px]:pl-8 min-[920px]:pt-0">
            <MetricsCard s={summary} />
          </div>
        </section>
      ) : (
        <section className="mt-10 border-t border-[var(--c-border)] pt-7">
          {allocation}
          <p className="mt-6 text-[12px] text-[var(--c-faint)]">
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
