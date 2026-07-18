import { AppHeader } from "@/components/AppHeader";
import { ASSET_CLASS_LABEL } from "@/lib/dashboard-data";
import { todayTaipei } from "@/lib/dates";
import { fmtFull, fmtNum } from "@/lib/format";
import type {
  AccountStatusEvent,
  ReplayAccount,
  ReplaySnapshot,
  ReplayTransaction,
} from "@/lib/history-replay";
import {
  buildMonthlyReport,
  getMonthBounds,
} from "@/lib/monthly-report";
import { getUnreadCount } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { PrintReportButton } from "./PrintReportButton";

const LIMIT = 10_000;

type AccountRow = {
  id: string;
  name: string;
  asset_class: string;
  symbol: string | null;
  price_market: string;
  created_at: string;
};

type SnapshotRow = {
  account_id: string;
  snapshot_date: string;
  quantity: number;
  unit_price: number | null;
  fx_rate: number | null;
  value_base: number;
  cost_basis_twd: number | null;
  cost_basis_native: number | null;
  realized_pnl_twd: number | null;
  account_status: "active" | "archived" | null;
};

type StatusRow = {
  account_id: string;
  status: "active" | "archived";
  effective_at: string;
  source: "account_create" | "account_update" | "migration_baseline";
};

type TransactionRow = {
  account_id: string;
  type: string;
  cashflow_twd: number | null;
  realized_pnl: number | null;
  created_at: string;
};

type DecisionSummary = {
  id: string;
  asset_name: string;
  decision_type: string;
  decision_date?: string;
  review_date?: string;
};

type ReviewSummary = {
  reviewed_at: string;
  decision_quality: number;
  reflection: string;
  investment_decisions: { asset_name: string } | null;
};

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const today = todayTaipei();
  const currentMonth = today.slice(0, 7);
  let bounds = getMonthBounds(month ?? currentMonth);
  if (!bounds || bounds.startDate > today) bounds = getMonthBounds(currentMonth)!;
  if (bounds.month === currentMonth) bounds = { ...bounds, endDate: today };

  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    unreadCount,
    { data: accountData },
    { data: snapshotData },
    { data: statusData },
    { data: transactionData },
    { data: newDecisionData },
    { data: dueDecisionData },
    { data: reviewData },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUnreadCount(),
    supabase
      .from("accounts")
      .select("id,name,asset_class,symbol,price_market,created_at")
      .lte("created_at", `${bounds.endDate}T23:59:59+08:00`)
      .order("created_at", { ascending: true }),
    supabase
      .from("account_snapshots")
      .select("account_id,snapshot_date,quantity,unit_price,fx_rate,value_base,cost_basis_twd,cost_basis_native,realized_pnl_twd,account_status")
      .lte("snapshot_date", bounds.endDate)
      .order("snapshot_date", { ascending: true })
      .limit(LIMIT),
    supabase
      .from("account_status_history")
      .select("account_id,status,effective_at,source")
      .lte("effective_at", `${bounds.endDate}T23:59:59+08:00`)
      .order("effective_at", { ascending: true })
      .limit(LIMIT),
    supabase
      .from("transactions")
      .select("account_id,type,cashflow_twd,realized_pnl,created_at")
      .gt("created_at", `${bounds.openingDate}T23:59:59+08:00`)
      .lte("created_at", `${bounds.endDate}T23:59:59+08:00`)
      .order("created_at", { ascending: true })
      .limit(LIMIT),
    supabase
      .from("investment_decisions")
      .select("id,asset_name,decision_type,decision_date")
      .gte("decision_date", bounds.startDate)
      .lte("decision_date", bounds.endDate)
      .order("decision_date", { ascending: true }),
    supabase
      .from("investment_decisions")
      .select("id,asset_name,decision_type,review_date")
      .eq("status", "open")
      .gte("review_date", bounds.startDate)
      .lte("review_date", bounds.endDate)
      .order("review_date", { ascending: true }),
    supabase
      .from("decision_reviews")
      .select("reviewed_at,decision_quality,reflection,investment_decisions(asset_name)")
      .gte("reviewed_at", `${bounds.startDate}T00:00:00+08:00`)
      .lte("reviewed_at", `${bounds.endDate}T23:59:59+08:00`)
      .order("reviewed_at", { ascending: true }),
  ]);

  const accounts = ((accountData ?? []) as AccountRow[]).map<ReplayAccount>((account) => ({
    id: account.id,
    name: account.name,
    assetClass: account.asset_class,
    symbol: account.symbol,
    priceMarket: account.price_market,
    createdAt: account.created_at,
  }));
  const snapshots = ((snapshotData ?? []) as SnapshotRow[]).map<ReplaySnapshot>((snapshot) => ({
    accountId: snapshot.account_id,
    date: snapshot.snapshot_date,
    quantity: Number(snapshot.quantity),
    unitPrice: nullableNumber(snapshot.unit_price),
    fxRate: nullableNumber(snapshot.fx_rate),
    valueBase: Number(snapshot.value_base),
    costBasisTwd: nullableNumber(snapshot.cost_basis_twd),
    costBasisNative: nullableNumber(snapshot.cost_basis_native),
    realizedPnlTwd: nullableNumber(snapshot.realized_pnl_twd),
    accountStatus: snapshot.account_status,
  }));
  const statusEvents = ((statusData ?? []) as StatusRow[]).map<AccountStatusEvent>((event) => ({
    accountId: event.account_id,
    status: event.status,
    effectiveAt: event.effective_at,
    source: event.source,
  }));
  const transactions = ((transactionData ?? []) as TransactionRow[]).map<ReplayTransaction>((transaction) => ({
    accountId: transaction.account_id,
    type: transaction.type,
    cashflowTwd: nullableNumber(transaction.cashflow_twd),
    realizedPnlTwd: nullableNumber(transaction.realized_pnl),
    createdAt: transaction.created_at,
  }));
  const sourceTruncated =
    snapshots.length >= LIMIT || statusEvents.length >= LIMIT || transactions.length >= LIMIT;
  const report = buildMonthlyReport({
    bounds,
    accounts,
    snapshots,
    statusEvents,
    transactions,
    sourceTruncated,
  });
  if (sourceTruncated) report.dataGaps.push("資料查詢已達 10,000 筆上限");

  const newDecisions = (newDecisionData ?? []) as DecisionSummary[];
  const dueDecisions = (dueDecisionData ?? []) as DecisionSummary[];
  const reviews = (reviewData ?? []) as unknown as ReviewSummary[];
  const generatedAt = new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });

  return (
    <div className="report-shell min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="reports" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="report-page mx-auto max-w-[1040px] px-4 pb-28 pt-9 sm:px-6">
        <header className="report-block flex flex-wrap items-start justify-between gap-5 border-b border-[var(--c-line-strong)] pb-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-accent)]">StackWorth Monthly Report</div>
            <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">{bounds.month} 月度投資報告</h1>
            <p className="mt-2 text-[12px] text-[var(--c-muted)]">
              資料區間 {bounds.startDate} 至 {bounds.endDate} · 產生時間 {generatedAt}（Asia/Taipei）
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <form method="GET" className="no-print">
              <label className="text-[11px] text-[var(--c-muted)]">
                報告月份
                <input type="month" name="month" defaultValue={bounds.month} max={currentMonth} className="mt-1 block h-10 rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-[13px]" />
              </label>
              <button type="submit" className="mt-2 h-9 w-full rounded-[var(--r-control)] border border-[var(--c-border)] text-[12px] hover:bg-[var(--c-surface-soft)]">產生月報</button>
            </form>
            <PrintReportButton />
          </div>
        </header>

        <section className="report-block mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="期初淨值" value={`NT$ ${fmtFull(report.opening.totalValueTwd)}`} mask />
          <Kpi label="期末淨值" value={`NT$ ${fmtFull(report.ending.totalValueTwd)}`} mask />
          <Kpi label="淨投入" value={`${report.netContributionTwd > 0 ? "+" : ""}NT$ ${fmtFull(report.netContributionTwd)}`} mask />
          <Kpi label="當月 TWR" value={formatPercent(report.twr)} />
          <Kpi label="XIRR（年化）" value={formatPercent(report.xirrAnnualized)} />
        </section>

        <ReportSection title="報酬歸因">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ReportMetric label="市價效果" value={report.attribution.marketPriceEffectTwd} />
            <ReportMetric label="匯率效果" value={report.attribution.fxEffectTwd} />
            <ReportMetric label="股息與利息" value={report.attribution.incomeTwd} />
            <ReportMetric label="未解釋差額" value={report.attribution.residualTwd} warning={!report.attribution.reconciled} />
          </dl>
          <p className="mt-4 text-[11.5px] text-[var(--c-muted)]">
            對帳狀態：{report.attribution.reconciled ? "相對容差內" : "超出相對容差"} · 容差 NT$ {fmtNum(report.attribution.toleranceTwd, 2)} · 已實現損益 NT$ {fmtFull(report.attribution.realizedPnlMemoTwd)}
          </p>
        </ReportSection>

        <div className="report-block mt-5 grid gap-5 lg:grid-cols-2">
          <ReportSection title="資產配置變化" nested>
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] text-[var(--c-muted)]"><tr><th className="pb-2 font-medium">類別</th><th className="pb-2 text-right font-medium">期初</th><th className="pb-2 text-right font-medium">期末</th><th className="pb-2 text-right font-medium">變動</th></tr></thead>
              <tbody>
                {allocationRows(report.openingAllocation, report.endingAllocation).map((row) => (
                  <tr key={row.key} className="border-t border-[var(--c-border)]">
                    <td className="py-2">{ASSET_CLASS_LABEL[row.key] ?? row.key}</td><td className="py-2 text-right tnum">{fmtNum(row.opening, 2)}%</td><td className="py-2 text-right tnum">{fmtNum(row.ending, 2)}%</td><td className="py-2 text-right tnum">{row.change > 0 ? "+" : ""}{fmtNum(row.change, 2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ReportSection>
          <ReportSection title="風險與來源" nested>
            <dl className="grid grid-cols-2 gap-4">
              <TextMetric label="最大回撤" value={report.maxDrawdown ? `${(report.maxDrawdown.pct * 100).toFixed(2)}%` : "資料不足"} />
              <TextMetric label="最高單一持倉" value={`${fmtNum(report.topConcentrationPct, 2)}%`} />
              <TextMetric label="最大上漲來源" value={sourceText(report.largestPositiveSource)} mask />
              <TextMetric label="最大下跌來源" value={sourceText(report.largestNegativeSource)} mask />
            </dl>
          </ReportSection>
        </div>

        <ReportSection title="投資決策">
          <div className="grid gap-5 md:grid-cols-3">
            <DecisionList title={`本月新增（${newDecisions.length}）`} rows={newDecisions.map((decision) => ({ id: decision.id, text: `${decision.decision_date} · ${decision.asset_name}` }))} />
            <DecisionList title={`本月到期未檢討（${dueDecisions.length}）`} rows={dueDecisions.map((decision) => ({ id: decision.id, text: `${decision.review_date} · ${decision.asset_name}` }))} />
            <DecisionList title={`本月完成檢討（${reviews.length}）`} rows={reviews.map((review) => ({ id: `${review.reviewed_at}-${review.investment_decisions?.asset_name ?? "deleted"}`, text: `${review.investment_decisions?.asset_name ?? "已刪除決策"} · 品質 ${review.decision_quality}/3 · ${review.reflection}` }))} />
          </div>
        </ReportSection>

        <ReportSection title="資料健康狀態">
          <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
            <span className={`rounded-full px-2.5 py-1 font-semibold ${report.dataGaps.length === 0 ? "bg-[color-mix(in_srgb,var(--c-up)_12%,transparent)] text-[var(--c-up)]" : "bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)] text-[var(--c-down)]"}`}>
              {report.dataGaps.length === 0 ? "未發現缺口" : `${report.dataGaps.length} 項缺口`}
            </span>
            <span className="text-[var(--c-muted)]">期末持倉 {report.ending.holdings.length} · 快照資料 {snapshots.length} 筆</span>
          </div>
          {report.dataGaps.length > 0 && <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[11.5px] leading-5 text-[var(--c-muted)]">{report.dataGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>}
        </ReportSection>

        <footer className="report-block mt-7 border-t border-[var(--c-border)] pt-4 text-[10.5px] leading-5 text-[var(--c-faint)]">
          本報告依 StackWorth 中已記錄的帳戶、交易與快照計算，可能受缺失價格、缺失現金流、報價延遲與歷史欄位不足影響。內容僅供個人紀錄與檢討，不構成投資、稅務或法律建議。過去績效不代表未來結果。
        </footer>
      </main>
    </div>
  );
}

function Kpi({ label, value, mask = false }: { label: string; value: string; mask?: boolean }) {
  return <div className="report-card rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3"><div className="text-[10.5px] text-[var(--c-muted)]">{label}</div><div className={`mt-1 text-[16px] font-semibold tnum ${mask ? "amt" : ""}`}>{value}</div></div>;
}

function ReportSection({ title, children, nested = false }: { title: string; children: React.ReactNode; nested?: boolean }) {
  return <section className={`report-block ${nested ? "" : "mt-5"} rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-6`}><h2 className="mb-4 font-serif text-xl font-medium">{title}</h2>{children}</section>;
}

function ReportMetric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div><dt className="text-[11px] text-[var(--c-muted)]">{label}</dt><dd className={`amt mt-1 text-[15px] font-semibold tnum ${warning ? "text-[var(--c-down)]" : value > 0 ? "text-[var(--c-up)]" : value < 0 ? "text-[var(--c-down)]" : ""}`}>{value > 0 ? "+" : ""}NT$ {fmtFull(value)}</dd></div>;
}

function TextMetric({ label, value, mask = false }: { label: string; value: string; mask?: boolean }) {
  return <div><dt className="text-[11px] text-[var(--c-muted)]">{label}</dt><dd className={`mt-1 text-[13px] font-semibold ${mask ? "amt" : ""}`}>{value}</dd></div>;
}

function DecisionList({ title, rows }: { title: string; rows: { id: string; text: string }[] }) {
  return <div><h3 className="text-[12px] font-semibold">{title}</h3>{rows.length === 0 ? <p className="mt-2 text-[11.5px] text-[var(--c-faint)]">無紀錄</p> : <ul className="mt-2 space-y-2 text-[11.5px] leading-5 text-[var(--c-muted)]">{rows.map((row) => <li key={row.id} className="line-clamp-3">{row.text}</li>)}</ul>}</div>;
}

function allocationRows(opening: Record<string, number>, ending: Record<string, number>) {
  return [...new Set([...Object.keys(opening), ...Object.keys(ending)])].sort().map((key) => ({ key, opening: opening[key] ?? 0, ending: ending[key] ?? 0, change: (ending[key] ?? 0) - (opening[key] ?? 0) }));
}

function sourceText(source: { name: string; impactTwd: number } | null): string {
  return source ? `${source.name} · ${source.impactTwd > 0 ? "+" : ""}NT$ ${fmtFull(source.impactTwd)}` : "無可辨識來源";
}

function formatPercent(value: number | null): string {
  return value == null ? "資料不足" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function nullableNumber(value: number | null): number | null {
  return value == null || !Number.isFinite(Number(value)) ? null : Number(value);
}
