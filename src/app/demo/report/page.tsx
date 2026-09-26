import { DemoV1Header } from "@/components/DemoV1Header";
import { PageHead, Stat, StatStrip, SurveyLabel } from "@/components/survey";
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
    <div className="report-shell min-h-dvh bg-[var(--c-page)] text-[var(--c-text)]">
      <DemoV1Header active="report" />
      <main id="main" tabIndex={-1} className="report-page mx-auto max-w-[960px] px-4 pb-24 pt-8 sm:px-6">
        <PageHead
          className="report-block"
          label="月度報告 · 示範資料"
          title={`${bounds.month} 月度投資報告`}
          sub={<>資料截止 <span className="tnum">{bounds.endDate}</span> 23:59（Asia/Taipei）· 全部為固定示範資料</>}
          action={
            <div className="flex items-end gap-2">
              <form method="GET" className="no-print flex items-end gap-2">
                <label className="text-[length:var(--fs-micro)] text-[var(--c-muted)]">
                  示範月份
                  <input type="month" name="month" defaultValue={bounds.month} max={currentMonth} className="mt-1 block h-10 border border-[var(--c-line-strong)] px-3 text-[length:var(--fs-sm)] tnum" />
                </label>
                <button type="submit" className="btn btn-outline h-10">產生</button>
              </form>
              <PrintReportButton />
            </div>
          }
        />
        {/* 格子各自帶 report-card：列印時整段不被分頁切開，底色也會被列印樣式換成白 */}
        <StatStrip cols={5} className="mt-6">
          <Stat className="report-card" label="期初淨值" mask value={`NT$ ${fmtFull(report.opening.totalValueTwd)}`} />
          <Stat className="report-card" label="期末淨值" mask value={`NT$ ${fmtFull(report.ending.totalValueTwd)}`} />
          <Stat className="report-card" label="淨投入" mask value={`NT$ ${fmtFull(report.netContributionTwd)}`} />
          <Stat className="report-card" label="TWR" value={report.twr == null ? "資料不足" : `${(report.twr * 100).toFixed(2)}%`} />
          <Stat className="report-card col-span-2 sm:col-span-1" label="XIRR 年化" value={report.xirrAnnualized == null ? "資料不足" : `${(report.xirrAnnualized * 100).toFixed(2)}%`} />
        </StatStrip>
        <Block title="報酬歸因" sub="扣除資金進出後的淨值變動；前三項解釋不到的部分列為未解釋">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Metric label="市價" value={report.attribution.marketPriceEffectTwd} />
            <Metric label="匯率" value={report.attribution.fxEffectTwd} />
            <Metric label="股息／利息" value={report.attribution.incomeTwd} />
            <Metric label="未解釋" value={report.attribution.residualTwd} />
          </div>
        </Block>
        <Block title="決策日誌">
          <div className="grid gap-5 sm:grid-cols-3">
            <TextBlock title="新增決策" value={newDecisions.length} detail={newDecisions.map((decision) => decision.assetName).join("、")} />
            <TextBlock title="到期未檢討" value={due.length} detail={due.map((decision) => decision.assetName).join("、")} />
            <TextBlock title="完成檢討" value={reviewed.length} detail={reviewed.map((decision) => `${decision.assetName} 品質 ${decision.quality}/3`).join("、")} />
          </div>
        </Block>
        <Block title="風險與資料健康">
          <p className="text-[length:var(--fs-sm)] text-[var(--c-muted)]">
            最高單一持倉 <span className="font-semibold text-[var(--c-text)] tnum">{fmtNum(report.topConcentrationPct, 2)}%</span>
            {" · "}最大回撤 <span className="font-semibold text-[var(--c-text)] tnum">{report.maxDrawdown ? `${(report.maxDrawdown.pct * 100).toFixed(2)}%` : "資料不足"}</span>
            {" · "}<span className="tnum">{report.dataGaps.length}</span> 項資料說明
          </p>
          {report.dataGaps.length > 0 && <ul className="mt-2 list-disc pl-5 text-[length:var(--fs-micro)] leading-5 text-[var(--c-muted)]">{report.dataGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>}
        </Block>
        <footer className="report-block mt-6 border-t border-[var(--c-border)] pt-4 text-[length:var(--fs-micro)] leading-5 text-[var(--c-faint)]">此為功能示範，不含真實使用者資料。數字僅用於測試計算與列印流程，不構成投資建議。</footer>
      </main>
    </div>
  );
}

// 報告的一個段落：方框、標題列底下一條髮絲線。保留 report-block 給列印樣式用。
function Block({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="report-block mt-6 border border-[var(--c-border)] bg-[var(--c-surface)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--c-border-soft)] px-5 py-3">
        <h2 className="text-[length:var(--fs-lg)] font-semibold">{title}</h2>
        {sub && <p className="text-[length:var(--fs-micro)] text-[var(--c-faint)]">{sub}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// 歸因只是拆解，不是損益，所以不上漲跌色，只帶號。
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <SurveyLabel>{label}</SurveyLabel>
      <div className="amt mt-1.5 text-[length:var(--fs-md)] font-semibold tnum">{value > 0 ? "+" : value < 0 ? "−" : ""}NT$ {fmtFull(Math.abs(value))}</div>
    </div>
  );
}

function TextBlock({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <div>
      <SurveyLabel>{title}</SurveyLabel>
      <div className="mt-1.5 text-[length:var(--fs-xl)] font-semibold tnum">{value}<span className="ml-1 text-[length:var(--fs-sm)] font-normal text-[var(--c-muted)]">筆</span></div>
      <p className="mt-1 text-[length:var(--fs-micro)] leading-5 text-[var(--c-muted)]">{detail || "無紀錄"}</p>
    </div>
  );
}
