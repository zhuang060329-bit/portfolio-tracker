import { DemoV1Header } from "@/components/DemoV1Header";
import { PageHead, Stat, StatStrip } from "@/components/survey";
import { todayTaipei } from "@/lib/dates";
import { buildDemoV1Data } from "@/lib/demo-v1-data";
import { fmtFull, fmtNum } from "@/lib/format";
import {
  attributePortfolioPeriod,
  buildScopeAdjustments,
  replayPortfolioAsOf,
} from "@/lib/history-replay";
import { getMonthBounds } from "@/lib/monthly-report";

export default async function DemoHistoryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const today = todayTaipei();
  const targetDate = date && validDate(date) && date <= today ? date : today;
  const data = buildDemoV1Data(today);
  const openingDate = getMonthBounds(today.slice(0, 7))!.openingDate;
  const opening = replayPortfolioAsOf({ targetDate: openingDate, accounts: data.accounts, snapshots: data.snapshots, statusEvents: data.statusEvents });
  const ending = replayPortfolioAsOf({ targetDate: targetDate, accounts: data.accounts, snapshots: data.snapshots, statusEvents: data.statusEvents });
  const scope = buildScopeAdjustments({ fromExclusive: openingDate, toInclusive: targetDate, snapshots: data.snapshots, statusEvents: data.statusEvents });
  const attribution = attributePortfolioPeriod({ opening, ending, snapshots: data.snapshots, transactions: data.transactions, scopeContributionTwd: scope.contributionTwd, scopeWithdrawalTwd: scope.withdrawalTwd, scopeGaps: scope.gaps });
  return (
    <div className="min-h-dvh bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="history" />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[980px] px-4 pb-24 pt-8 sm:px-6">
        <PageHead
          label={`回放區間 ${openingDate} → ${targetDate}`}
          title="歷史回放"
          sub="日期改變只會選用該日以前的固定快照。"
          action={
            <form method="GET" className="flex items-end gap-2">
              <label className="text-[length:var(--fs-micro)] text-[var(--c-muted)]">
                回放日
                <input type="date" name="date" min={openingDate} max={today} defaultValue={targetDate} className="mt-1 block h-11 border border-[var(--c-line-strong)] px-3 text-[length:var(--fs-sm)] tnum sm:h-10" />
              </label>
              <button className="h-11 btn btn-primary btn-fit sm:h-10">回放</button>
            </form>
          }
        />
        <StatStrip cols={4} className="mt-6">
          <Stat label="期初淨值" mask value={`NT$ ${fmtFull(opening.totalValueTwd)}`} />
          <Stat label="回放淨值" mask value={`NT$ ${fmtFull(ending.totalValueTwd)}`} />
          <Stat label="市價效果" mask value={<Signed value={attribution.marketPriceEffectTwd} />} />
          <Stat label="匯率效果" mask value={<Signed value={attribution.fxEffectTwd} />} />
        </StatStrip>
        <section className="mt-6 border border-[var(--c-border)] bg-[var(--c-surface)]">
          {ending.holdings.map((holding, index) => {
            const pct = ending.totalValueTwd > 0 ? (holding.valueTwd / ending.totalValueTwd) * 100 : 0;
            return (
              <div key={holding.accountId} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_7.5rem] ${index > 0 ? "border-t border-[var(--c-border-soft)]" : ""}`}>
                <div className="min-w-0">
                  <div className="truncate text-[length:var(--fs-sm)] font-medium">
                    {holding.name}
                    {holding.symbol && <span className="ml-1.5 text-[var(--c-faint)] tnum">{holding.symbol}</span>}
                  </div>
                  <div className="mt-0.5 text-[length:var(--fs-micro)] text-[var(--c-faint)]">
                    快照 <span className="tnum">{holding.snapshotDate}</span>
                    {holding.carriedForward && " · 沿用前一筆快照"}
                  </div>
                </div>
                <div className="amt text-right text-[length:var(--fs-md)] font-semibold tnum">NT$ {fmtFull(holding.valueTwd)}</div>
                {/* 配置量尺：跟首頁持倉帳本同一個讀法，細軌上一段實線長度＝佔比 */}
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <span aria-hidden="true" className="relative h-[3px] flex-1 bg-[var(--c-border-soft)]">
                    <span className="absolute inset-y-0 left-0 bg-[var(--c-accent)]" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </span>
                  <span className="w-12 text-right text-[length:var(--fs-micro)] text-[var(--c-muted)] tnum">{fmtNum(pct, 1)}%</span>
                </div>
              </div>
            );
          })}
        </section>
        {attribution.gaps.length > 0 && <p className="mt-4 text-[length:var(--fs-micro)] leading-5 text-[var(--c-muted)]">資料說明：{attribution.gaps.join("；")}</p>}
      </main>
    </div>
  );
}

// 帶正負號的金額。只有號與數字，顏色由呼叫端決定——歸因效果是拆解不是損益，不上漲跌色。
function Signed({ value }: { value: number }) {
  return <>{value > 0 ? "+" : value < 0 ? "−" : ""}NT$ {fmtFull(Math.abs(value))}</>;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00+08:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }) === value;
}
