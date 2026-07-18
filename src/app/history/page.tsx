import { AppHeader } from "@/components/AppHeader";
import { ASSET_CLASS_LABEL } from "@/lib/dashboard-data";
import { todayTaipei } from "@/lib/dates";
import { fmtFull, fmtNum } from "@/lib/format";
import {
  attributePortfolioPeriod,
  replayPortfolioAsOf,
  type AccountStatusEvent,
  type ReplayAccount,
  type ReplaySnapshot,
  type ReplayTransaction,
} from "@/lib/history-replay";
import { getUnreadCount } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

const SNAPSHOT_LIMIT = 10_000;
const STATUS_LIMIT = 5_000;
const TRANSACTION_LIMIT = 5_000;

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

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; date?: string }>;
}) {
  const query = await searchParams;
  const today = todayTaipei();
  const endDate = validDate(query.date) && query.date! <= today ? query.date! : today;
  const monthStart = `${endDate.slice(0, 7)}-01`;
  const requestedStart = validDate(query.from) ? query.from! : monthStart;
  const startDate = requestedStart < endDate ? requestedStart : previousDate(endDate);

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
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUnreadCount(),
    supabase
      .from("accounts")
      .select("id,name,asset_class,symbol,price_market,created_at")
      .lte("created_at", `${endDate}T23:59:59+08:00`)
      .order("created_at", { ascending: true }),
    supabase
      .from("account_snapshots")
      .select(
        "account_id,snapshot_date,quantity,unit_price,fx_rate,value_base,cost_basis_twd,cost_basis_native,realized_pnl_twd,account_status",
      )
      .lte("snapshot_date", endDate)
      .order("snapshot_date", { ascending: true })
      .limit(SNAPSHOT_LIMIT),
    supabase
      .from("account_status_history")
      .select("account_id,status,effective_at,source")
      .lte("effective_at", `${endDate}T23:59:59+08:00`)
      .order("effective_at", { ascending: true })
      .limit(STATUS_LIMIT),
    supabase
      .from("transactions")
      .select("account_id,type,cashflow_twd,realized_pnl,created_at")
      .gt("created_at", `${startDate}T23:59:59+08:00`)
      .lte("created_at", `${endDate}T23:59:59+08:00`)
      .order("created_at", { ascending: true })
      .limit(TRANSACTION_LIMIT),
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
  const queryTruncated =
    snapshots.length >= SNAPSHOT_LIMIT ||
    statusEvents.length >= STATUS_LIMIT ||
    transactions.length >= TRANSACTION_LIMIT;

  const opening = replayPortfolioAsOf({
    targetDate: startDate,
    accounts,
    snapshots,
    statusEvents,
    sourceTruncated: snapshots.length >= SNAPSHOT_LIMIT || statusEvents.length >= STATUS_LIMIT,
  });
  const ending = replayPortfolioAsOf({
    targetDate: endDate,
    accounts,
    snapshots,
    statusEvents,
    sourceTruncated: snapshots.length >= SNAPSHOT_LIMIT || statusEvents.length >= STATUS_LIMIT,
  });
  const attribution = attributePortfolioPeriod({ opening, ending, snapshots, transactions });
  if (queryTruncated && !attribution.gaps.includes("交易或歷程查詢已達筆數上限")) {
    attribution.gaps.push("交易或歷程查詢已達筆數上限");
  }

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="history" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-[1080px] px-4 pb-28 pt-9 sm:px-6 lg:px-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-tight">歷史回放</h1>
            <p className="mt-1.5 text-[13.5px] text-[var(--c-muted)]">
              只使用指定日期以前已存在的快照；缺資料時保留缺口，不借用今天價格。
            </p>
          </div>
          <form method="GET" className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
            <DateInput name="from" label="期初日（不含）" value={startDate} max={previousDate(endDate)} />
            <DateInput name="date" label="回放日" value={endDate} max={today} />
            <button type="submit" className="h-[38px] rounded-[var(--r-control)] bg-[var(--c-accent)] px-4 text-[13px] font-semibold text-[var(--c-btn-strong-text)] hover:brightness-110">
              回放
            </button>
          </form>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Summary label={`${startDate} 期初`} value={opening.totalValueTwd} />
          <Summary label={`${endDate} 期末`} value={ending.totalValueTwd} />
          <Summary label="期間投入" value={attribution.contributionsTwd} signed />
          <Summary label="期間提領" value={attribution.withdrawalsTwd} signed />
        </section>

        <section className="mt-5 rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-medium">報酬歸因與對帳</h2>
              <p className="mt-1 text-[12px] text-[var(--c-muted)]">
                期初 + 投入 + 市價 + 匯率 + 收入 + 未解釋 = 期末 + 提領。配息與利息同時列為收入及已提領現金。
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${attribution.reconciled ? "bg-[color-mix(in_srgb,var(--c-up)_12%,transparent)] text-[var(--c-up)]" : "bg-[color-mix(in_srgb,var(--c-down)_12%,transparent)] text-[var(--c-down)]"}`}>
              {attribution.reconciled ? "相對容差內" : "有待解釋差額"}
            </span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <AttributionMetric label="市價效果" value={attribution.marketPriceEffectTwd} />
            <AttributionMetric label="匯率效果" value={attribution.fxEffectTwd} />
            <AttributionMetric label="股息／利息" value={attribution.incomeTwd} />
            <AttributionMetric label="未解釋差額" value={attribution.residualTwd} alert={!attribution.reconciled} />
          </dl>
          <div className="mt-4 border-t border-[var(--c-border)] pt-3 text-[11.5px] text-[var(--c-muted)]">
            已實現損益（備忘、不重複加總）：NT$ {fmtFull(attribution.realizedPnlMemoTwd)} · 相對容差：NT$ {fmtNum(attribution.toleranceTwd, 2)}（對帳規模的 0.1%）
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)]">
          <div className="border-b border-[var(--c-border)] px-5 py-4">
            <h2 className="font-serif text-xl font-medium">{endDate} 持倉</h2>
            <p className="mt-1 text-[12px] text-[var(--c-muted)]">{ending.holdings.length} 個回放帳戶 · 依當日 TWD 估值排序</p>
          </div>
          {ending.holdings.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[var(--c-muted)]">該日期沒有可回放的持倉。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="bg-[var(--c-surface-soft)] text-[11.5px] text-[var(--c-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">帳戶</th>
                    <th className="px-3 py-3 font-medium">類別</th>
                    <th className="px-3 py-3 text-right font-medium">數量</th>
                    <th className="px-3 py-3 text-right font-medium">單價</th>
                    <th className="px-3 py-3 text-right font-medium">匯率</th>
                    <th className="px-5 py-3 text-right font-medium">TWD 估值</th>
                  </tr>
                </thead>
                <tbody>
                  {ending.holdings.map((holding) => (
                    <tr key={holding.accountId} className="border-t border-[var(--c-border)] first:border-t-0">
                      <td className="px-5 py-3.5">
                        <div className="font-medium">{holding.name}{holding.symbol ? ` · ${holding.symbol}` : ""}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-[var(--c-faint)] tnum">
                          快照 {holding.snapshotDate}
                          {holding.carriedForward && <span className="rounded bg-[var(--c-surface-soft)] px-1.5 py-0.5">carry-forward</span>}
                          {!holding.statusKnown && <span>狀態歷程不完整</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-[var(--c-muted)]">{ASSET_CLASS_LABEL[holding.assetClass] ?? holding.assetClass}</td>
                      <td className="px-3 py-3.5 text-right tnum">{fmtNum(holding.quantity, 8)}</td>
                      <td className="px-3 py-3.5 text-right tnum">{fmtNum(holding.unitPrice, 4)}</td>
                      <td className="px-3 py-3.5 text-right tnum">{fmtNum(holding.fxRate, 4)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold tnum">NT$ {fmtFull(holding.valueTwd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {attribution.gaps.length > 0 && (
          <section className="mt-5 rounded-[var(--r-card)] border border-[color-mix(in_srgb,var(--c-down)_25%,var(--c-border))] bg-[var(--c-surface)] p-5">
            <h2 className="text-[13px] font-semibold text-[var(--c-down)]">資料缺口與限制</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[12px] leading-5 text-[var(--c-muted)]">
              {attribution.gaps.map((gap) => <li key={gap}>{gap}</li>)}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function DateInput({ name, label, value, max }: { name: string; label: string; value: string; max: string }) {
  return (
    <label className="text-[11px] text-[var(--c-muted)]">
      {label}
      <input type="date" name={name} defaultValue={value} max={max} className="mt-1 block h-[38px] rounded-[var(--r-control)] border border-[var(--c-border)] bg-[var(--c-surface-soft)] px-2.5 text-[12.5px] text-[var(--c-text)]" />
    </label>
  );
}

function Summary({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
      <div className="text-[11px] text-[var(--c-muted)]">{label}</div>
      <div className="mt-1 text-[18px] font-semibold tnum">{signed && value > 0 ? "+" : ""}NT$ {fmtFull(value)}</div>
    </div>
  );
}

function AttributionMetric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div>
      <dt className="text-[11.5px] text-[var(--c-muted)]">{label}</dt>
      <dd className={`mt-1 text-[15px] font-semibold tnum ${alert ? "text-[var(--c-down)]" : value > 0 ? "text-[var(--c-up)]" : value < 0 ? "text-[var(--c-down)]" : ""}`}>
        {value > 0 ? "+" : ""}NT$ {fmtFull(value)}
      </dd>
    </div>
  );
}

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00+08:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }) === value;
}

function previousDate(value: string): string {
  const date = new Date(`${value}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function nullableNumber(value: number | null): number | null {
  return value == null || !Number.isFinite(Number(value)) ? null : Number(value);
}
