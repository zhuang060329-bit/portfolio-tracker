import { DemoV1Header } from "@/components/DemoV1Header";
import { todayTaipei } from "@/lib/dates";
import { buildDemoV1Data } from "@/lib/demo-v1-data";
import { fmtFull, fmtNum } from "@/lib/format";
import { buildMonthlyReport, getMonthBounds } from "@/lib/monthly-report";
import { PrintReportButton } from "@/app/reports/monthly/PrintReportButton";

export default async function DemoReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const today = todayTaipei();
  const { month } = await searchParams;
  const currentMonth = today.slice(0, 7);
  let requested = getMonthBounds(month ?? currentMonth);
  if (!requested || requested.startDate > today) requested = getMonthBounds(currentMonth)!;
  const bounds = requested.month === currentMonth ? { ...requested, endDate: today } : requested;
  const data = buildDemoV1Data(bounds.endDate);
  const report = buildMonthlyReport({ bounds, accounts: data.accounts, snapshots: data.snapshots, statusEvents: data.statusEvents, transactions: data.transactions });
  const newDecisions = data.decisions.filter((decision) => decision.decisionDate >= bounds.startDate && decision.decisionDate <= bounds.endDate);
  const due = data.decisions.filter((decision) => decision.status === "open" && decision.reviewDate <= bounds.endDate);
  const reviewed = data.decisions.filter((decision) => decision.status === "reviewed");
  return (
    <div className="report-shell min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="report" />
      <main className="report-page mx-auto max-w-[960px] px-4 pb-24 pt-8 sm:px-6">
        <header className="report-block flex flex-wrap items-start justify-between gap-4 border-b border-[var(--c-line-strong)] pb-5">
          <div><div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--c-accent)]">Deterministic Demo Report</div><h1 className="mt-2 font-serif text-4xl font-medium">{bounds.month} 月度投資報告</h1><p className="mt-2 text-[11.5px] text-[var(--c-muted)]">資料截止 {bounds.endDate} 23:59（Asia/Taipei）· 全部為固定示範資料</p></div>
          <div className="flex items-end gap-3">
            <form method="GET" className="no-print"><label className="text-[10.5px] text-[var(--c-muted)]">示範月份<input type="month" name="month" defaultValue={bounds.month} max={currentMonth} className="mt-1 block h-10 rounded-lg border border-[var(--c-border)] px-3 text-[12.5px]" /></label><button type="submit" className="mt-2 h-9 w-full rounded-lg border border-[var(--c-border)] text-[12px]">產生</button></form>
            <PrintReportButton />
          </div>
        </header>
        <section className="report-block mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="期初淨值" value={`NT$ ${fmtFull(report.opening.totalValueTwd)}`} /><Kpi label="期末淨值" value={`NT$ ${fmtFull(report.ending.totalValueTwd)}`} /><Kpi label="淨投入" value={`NT$ ${fmtFull(report.netContributionTwd)}`} /><Kpi label="TWR" value={report.twr == null ? "資料不足" : `${(report.twr * 100).toFixed(2)}%`} /><Kpi label="XIRR 年化" value={report.xirrAnnualized == null ? "資料不足" : `${(report.xirrAnnualized * 100).toFixed(2)}%`} />
        </section>
        <section className="report-block mt-5 rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5"><h2 className="font-serif text-xl font-medium">報酬歸因</h2><div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><Metric label="市價" value={report.attribution.marketPriceEffectTwd} /><Metric label="匯率" value={report.attribution.fxEffectTwd} /><Metric label="股息／利息" value={report.attribution.incomeTwd} /><Metric label="未解釋" value={report.attribution.residualTwd} /></div></section>
        <section className="report-block mt-5 grid gap-5 rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:grid-cols-3"><TextBlock title="新增決策" value={`${newDecisions.length} 筆`} detail={newDecisions.map((decision) => decision.assetName).join("、")} /><TextBlock title="到期未檢討" value={`${due.length} 筆`} detail={due.map((decision) => decision.assetName).join("、")} /><TextBlock title="完成檢討" value={`${reviewed.length} 筆`} detail={reviewed.map((decision) => `${decision.assetName} 品質 ${decision.quality}/3`).join("、")} /></section>
        <section className="report-block mt-5 rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5"><h2 className="font-serif text-xl font-medium">風險與資料健康</h2><p className="mt-3 text-[12px] text-[var(--c-muted)]">最高單一持倉 {fmtNum(report.topConcentrationPct, 2)}% · 最大回撤 {report.maxDrawdown ? `${(report.maxDrawdown.pct * 100).toFixed(2)}%` : "資料不足"} · {report.dataGaps.length} 項資料說明</p>{report.dataGaps.length > 0 && <ul className="mt-2 list-disc pl-5 text-[11.5px] text-[var(--c-muted)]">{report.dataGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>}</section>
        <footer className="report-block mt-6 border-t border-[var(--c-border)] pt-4 text-[10.5px] leading-5 text-[var(--c-faint)]">此為功能示範，不含真實使用者資料。數字僅用於測試計算與列印流程，不構成投資建議。</footer>
      </main>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) { return <div className="report-card rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3"><div className="text-[10.5px] text-[var(--c-muted)]">{label}</div><div className="amt mt-1 text-[16px] font-semibold tnum">{value}</div></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div><div className="text-[10.5px] text-[var(--c-muted)]">{label}</div><div className="amt mt-1 font-semibold tnum">{value > 0 ? "+" : ""}NT$ {fmtFull(value)}</div></div>; }
function TextBlock({ title, value, detail }: { title: string; value: string; detail: string }) { return <div><h2 className="text-[11px] text-[var(--c-muted)]">{title}</h2><div className="mt-1 text-lg font-semibold">{value}</div><p className="mt-1 text-[11.5px] text-[var(--c-muted)]">{detail || "無紀錄"}</p></div>; }
