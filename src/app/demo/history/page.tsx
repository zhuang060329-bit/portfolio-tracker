import { DemoV1Header } from "@/components/DemoV1Header";
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
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="history" />
      <main className="mx-auto max-w-[980px] px-4 pb-24 pt-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="font-serif text-3xl font-medium">歷史回放 Demo</h1><p className="mt-1.5 text-[13px] text-[var(--c-muted)]">日期改變只會選用該日以前的固定快照。</p></div>
          <form method="GET" className="flex items-end gap-2"><label className="text-[11px] text-[var(--c-muted)]">回放日<input type="date" name="date" min={openingDate} max={today} defaultValue={targetDate} className="mt-1 block h-10 rounded-lg border border-[var(--c-border)] px-3 text-[13px]" /></label><button className="h-10 rounded-lg bg-[var(--c-accent)] px-4 text-[13px] font-semibold text-[var(--c-btn-strong-text)]">回放</button></form>
        </div>
        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card label="期初淨值" value={opening.totalValueTwd} /><Card label="回放淨值" value={ending.totalValueTwd} /><Card label="市價效果" value={attribution.marketPriceEffectTwd} /><Card label="匯率效果" value={attribution.fxEffectTwd} />
        </section>
        <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)]">
          {ending.holdings.map((holding, index) => <div key={holding.accountId} className={`flex items-center gap-3 px-5 py-4 ${index > 0 ? "border-t border-[var(--c-border)]" : ""}`}><div className="min-w-0 flex-1"><div className="font-medium">{holding.name}{holding.symbol ? ` · ${holding.symbol}` : ""}</div><div className="mt-1 text-[10.5px] text-[var(--c-faint)]">快照 {holding.snapshotDate}{holding.carriedForward ? " · carry-forward" : ""}</div></div><div className="amt font-semibold tnum">NT$ {fmtFull(holding.valueTwd)}</div><div className="w-16 text-right text-[11.5px] text-[var(--c-muted)] tnum">{ending.totalValueTwd > 0 ? fmtNum((holding.valueTwd / ending.totalValueTwd) * 100, 1) : "0"}%</div></div>)}
        </section>
        {attribution.gaps.length > 0 && <p className="mt-4 text-[11.5px] text-[var(--c-muted)]">資料說明：{attribution.gaps.join("；")}</p>}
      </main>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3"><div className="text-[10.5px] text-[var(--c-muted)]">{label}</div><div className="amt mt-1 text-[17px] font-semibold tnum">NT$ {fmtFull(value)}</div></div>;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00+08:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }) === value;
}
