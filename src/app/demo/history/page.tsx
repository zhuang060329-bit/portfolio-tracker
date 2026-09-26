import { DemoV1Header } from "@/components/DemoV1Header";
import { PageHead, Panel, Stat, StatStrip, Tag } from "@/components/survey";
import { todayTaipei } from "@/lib/dates";
import { buildDemoV1Data } from "@/lib/demo-v1-data";
import { fmtFull, fmtNum } from "@/lib/format";
import {
  type AttributionResult,
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
  const openingValueOf = new Map(opening.holdings.map((holding) => [holding.accountId, holding.valueTwd]));
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
        <Bridge attribution={attribution} openingDate={openingDate} targetDate={targetDate} />
        <Panel className="mt-6" title="回放日持倉" sub="條長＝佔回放淨值比例" flush>
          {ending.holdings.map((holding, index) => {
            const pct = ending.totalValueTwd > 0 ? (holding.valueTwd / ending.totalValueTwd) * 100 : 0;
            const openingValue = openingValueOf.get(holding.accountId);
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
                    {openingValue != null && (
                      <>
                        {" · 期初 "}
                        <span className="amt tnum">NT$ {fmtFull(openingValue)}</span>
                      </>
                    )}
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
        </Panel>
        {attribution.gaps.length > 0 && <p className="mt-4 text-[length:var(--fs-micro)] leading-5 text-[var(--c-muted)]">資料說明：{attribution.gaps.join("；")}</p>}
      </main>
    </div>
  );
}

type BridgeRow = { key: string; label: string; note?: string; value: number; total?: boolean; alert?: boolean };

/* 淨值變動拆解：期初 → 各項流量 → 回放淨值，像測量導線一樣逐站累加。
   恆等式照 attributePortfolioPeriod：
   期初 + 投入 + 範圍加入 + 市價 + 匯率 + 收入 + 未解釋 − 提領 − 範圍移出 ＝ 期末。
   每列的條從中軸往左（減）或往右（加）長，長度相對於最大的一項流量——
   刻意不用從 0 起算的瀑布圖，因為流量只有淨值的幾個百分點，照絕對尺度畫會看不見。
   歸因是拆解不是損益，所以條一律測量藍；只有未解釋差額超出容差時換朱砂虛線加「注意」。 */
function Bridge({ attribution: a, openingDate, targetDate }: { attribution: AttributionResult; openingDate: string; targetDate: string }) {
  const flows: BridgeRow[] = [
    { key: "contrib", label: "期間投入", value: a.contributionsTwd },
    ...(a.scopeContributionTwd !== 0 ? [{ key: "scope-in", label: "範圍加入", note: "帳戶納入組合", value: a.scopeContributionTwd }] : []),
    { key: "market", label: "市價效果", value: a.marketPriceEffectTwd },
    { key: "fx", label: "匯率效果", value: a.fxEffectTwd },
    { key: "income", label: "股息／利息", value: a.incomeTwd },
    { key: "withdraw", label: "期間提領", note: "含配息與利息轉出", value: -a.withdrawalsTwd },
    ...(a.scopeWithdrawalTwd !== 0 ? [{ key: "scope-out", label: "範圍移出", note: "帳戶移出組合", value: -a.scopeWithdrawalTwd }] : []),
    { key: "residual", label: "未解釋差額", value: a.residualTwd, alert: !a.reconciled },
  ];
  const rows: BridgeRow[] = [
    { key: "open", label: "期初淨值", note: openingDate, value: a.openingValueTwd, total: true },
    ...flows,
    { key: "end", label: "回放淨值", note: targetDate, value: a.endingValueTwd, total: true },
  ];
  const scale = Math.max(...flows.map((row) => Math.abs(row.value)), 1);
  return (
    <Panel
      className="mt-6"
      title="淨值變動拆解"
      sub={<Tag tone={a.reconciled ? "up" : "annot"}>{a.reconciled ? "對帳在容差內" : "有待解釋差額"}</Tag>}
      flush
    >
      <div aria-hidden="true" className="hidden grid-cols-[minmax(0,11rem)_minmax(0,1fr)_9.5rem] gap-x-5 border-b border-[var(--c-line-strong)] px-5 py-2 text-[length:var(--fs-micro)] font-semibold tracking-[0.06em] text-[var(--c-muted)] sm:grid">
        <span>項目</span>
        <span className="flex justify-between">
          <span>減</span>
          <span>加</span>
        </span>
        <span className="text-right">金額</span>
      </div>
      <dl>
        {rows.map((row) => {
          const width = row.total ? 0 : (Math.abs(row.value) / scale) * 50;
          const negative = row.value < 0;
          return (
            <div
              key={row.key}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1.5 px-5 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_9.5rem] ${
                row.key === "end" ? "border-t border-[var(--c-line-strong)]" : row.key === "open" ? "" : "border-t border-[var(--c-border-soft)]"
              }`}
            >
              <dt className="min-w-0">
                <span className={`text-[length:var(--fs-sm)] ${row.total ? "font-semibold" : ""}`}>{row.label}</span>
                {row.note && <span className="ml-2 text-[length:var(--fs-micro)] text-[var(--c-faint)] tnum">{row.note}</span>}
                {row.alert && (
                  <span className="ml-2 text-[length:var(--fs-micro)] font-semibold text-[var(--c-annot-text)]">注意</span>
                )}
              </dt>
              <dd className={`amt text-right tnum sm:order-last ${row.total ? "text-[length:var(--fs-md)] font-semibold" : "text-[length:var(--fs-sm)]"} ${row.alert ? "text-[var(--c-annot-text)]" : ""}`}>
                {row.total ? `NT$ ${fmtFull(row.value)}` : <Signed value={row.value} />}
              </dd>
              {/* 中軸量尺：總額列只畫軸，不畫條 */}
              <div aria-hidden="true" className="relative col-span-2 h-2.5 sm:col-span-1">
                <span className="absolute inset-y-[-6px] left-1/2 w-px bg-[var(--c-line-strong)]" />
                {width > 0 && (
                  <span
                    className={`absolute inset-y-0 ${row.alert ? "border border-dashed border-[var(--c-annot)]" : "bg-[var(--c-accent)]"}`}
                    style={negative ? { right: "50%", width: `${width}%` } : { left: "50%", width: `${Math.max(width, 0.4)}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </dl>
      <p className="border-t border-[var(--c-border-soft)] px-5 py-3 text-[length:var(--fs-micro)] leading-5 text-[var(--c-faint)]">
        條長相對於最大的一項流量，不是淨值的絕對比例。已實現損益 <span className="amt tnum">NT$ {fmtFull(a.realizedPnlMemoTwd)}</span> 只作備忘，不重複加總；
        相對容差 <span className="amt tnum">NT$ {fmtNum(a.toleranceTwd, 2)}</span>（對帳規模的 0.1%）。
      </p>
    </Panel>
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
