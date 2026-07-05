import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountActions } from "./AccountActions";
import { RecurringPlans, type Plan } from "./RecurringPlans";
import { NetWorthPanel } from "@/components/NetWorthPanel";
import { AppHeader } from "@/components/AppHeader";
import { computeXirr } from "@/lib/xirr";
import { getUnreadCount } from "@/lib/notifications";
import { fmtFull as fmtTwd, fmtNum, fmtUpdatedAt } from "@/lib/format";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";

const MARKET_LABEL: Record<string, string> = {
  us: "美股",
  tw: "台股",
  crypto: "加密貨幣",
  manual: "手動",
};

const TXN_LABEL: Record<string, string> = {
  create: "新建帳戶",
  adjust_quantity: "調整數量",
  adjust_balance: "修改餘額",
  price_update: "更新價格",
  sell: "賣出",
  dividend: "配息",
  interest: "利息",
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

type Market = "us" | "tw" | "crypto" | "manual";

export default async function AccountDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = await getUnreadCount();

  const { data: account } = await supabase
    .from("accounts")
    .select(
      "id,name,asset_class,price_market,symbol,quantity,native_currency,last_unit_price,last_fx_rate,manual_value_base,last_priced_at,created_at,cost_basis_twd,cost_basis_native,realized_pnl_twd,status",
    )
    .eq("id", id)
    .single();
  if (!account) notFound();

  const { data: txns } = await supabase
    .from("transactions")
    .select(
      "id,type,quantity_after,unit_price,fx_rate,value_after_base,realized_pnl,cashflow_twd,note,created_at",
    )
    .eq("account_id", id)
    .order("created_at", { ascending: false });

  const { data: plansData } = await supabase
    .from("recurring_plans")
    .select(
      "id,amount_twd,day_of_month,start_date,next_run_date,last_run_date,active,note",
    )
    .eq("account_id", id)
    .order("active", { ascending: false })
    .order("next_run_date", { ascending: true });
  const plans = (plansData ?? []) as Plan[];

  const { data: snapsData } = await supabase
    .from("account_snapshots")
    .select("snapshot_date,value_base")
    .eq("account_id", id)
    .order("snapshot_date", { ascending: true });
  const lineData = ((snapsData ?? []) as {
    snapshot_date: string;
    value_base: number;
  }[]).map((s) => ({ date: s.snapshot_date, value: Number(s.value_base) }));
  const hasTrend = lineData.length >= 2;

  const isManual = account.price_market === "manual";
  const valueBase = isManual
    ? Number(account.manual_value_base ?? 0)
    : Number(account.quantity) *
      Number(account.last_unit_price ?? 0) *
      Number(account.last_fx_rate ?? 1);
  const cost = Number(account.cost_basis_twd ?? 0);
  const costNative = Number(account.cost_basis_native ?? 0);
  const realized = Number(account.realized_pnl_twd ?? 0);
  const pnl = valueBase - cost;
  const totalReturn = pnl + realized;
  const pct = cost > 0 ? ((valueBase - cost) / cost) * 100 : 0;

  // FX 拆解 PnL：當原幣成本 ≠ TWD 成本（即 avg_cost_fx ≠ 1，例如美股 USD）才有意義
  const avgCostFx = costNative > 0 ? cost / costNative : 1;
  const hasFxComponent =
    !isManual &&
    Number.isFinite(avgCostFx) &&
    Math.abs(avgCostFx - 1) > 0.0001 &&
    Number(account.quantity) > 0;
  const curPrice = Number(account.last_unit_price ?? 0);
  const curFx = Number(account.last_fx_rate ?? 1);
  const avgCostNative = Number(account.quantity) > 0 ? costNative / Number(account.quantity) : 0;
  const marketPnl = hasFxComponent
    ? Number(account.quantity) * (curPrice - avgCostNative) * avgCostFx
    : 0;
  const fxPnl = hasFxComponent
    ? Number(account.quantity) * curPrice * (curFx - avgCostFx)
    : 0;
  const tone = (n: number) =>
    n > 0 ? "text-[var(--c-up)]" : n < 0 ? "text-[var(--c-down)]" : "text-[var(--c-muted)]";
  const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
  const pnlClass = tone(pnl);
  const pnlSign = sign(pnl);

  // 本帳戶 XIRR
  const accountCashflows = ((txns ?? []) as {
    cashflow_twd: number | null;
    created_at: string;
  }[])
    .map((t) => ({
      amount: Number(t.cashflow_twd),
      when: new Date(t.created_at),
    }))
    .filter((c) => Number.isFinite(c.amount) && c.amount !== 0);
  const now = new Date();
  if (valueBase > 0) {
    accountCashflows.push({ amount: valueBase, when: now });
  }
  const accountXirr = computeXirr(accountCashflows);
  // 跨度不足 30 天就不顯示年化（避免短期波動年化後失真）
  const accountXirrSpan =
    accountCashflows.length > 1
      ? (now.getTime() -
          Math.min(...accountCashflows.map((c) => c.when.getTime()))) /
        86_400_000
      : 0;
  const accountXirrShowable = accountXirr !== null && accountXirrSpan >= 30;

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="accounts" userEmail={user?.email} unreadCount={unreadCount} />

      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 text-sm">
          <Link
            href="/"
            className="text-[var(--c-muted)] transition-colors hover:text-[var(--c-text)]"
          >
            ← 回總覽
          </Link>
        </div>

        {/* === 帳戶 header === */}
        <header className="border-b border-[var(--c-border)] pb-6">
          {account.status === "archived" && (
            <div className="mb-3 rounded-[var(--r-control)] border border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface))] px-3 py-2 text-xs text-[var(--c-accent)]">
              此帳戶已歸檔。cron 不會自動抓價，首頁總值不計入此帳戶。
            </div>
          )}
          <p className="text-xs tracking-wider text-[var(--c-muted)]">
            {MARKET_LABEL[account.price_market] ?? account.price_market}
            {account.symbol ? ` · ${account.symbol}` : ""}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
            {account.name}
          </h1>
          <p className="mt-4 flex items-baseline gap-2 font-serif">
            <span className="text-2xl font-medium text-[var(--c-muted)]">NT$</span>
            <span className="amt text-4xl font-semibold tracking-tight tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
              {fmtTwd(valueBase)}
            </span>
          </p>
          {!isManual && cost > 0 && (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
              <span>
                <span className="text-[var(--c-muted)]">成本</span>
                <span className="amt ml-2 text-[var(--c-text)]">NT$ {fmtTwd(cost)}</span>
              </span>
              <span>
                <span className="text-[var(--c-muted)]">未實現</span>
                <span className={`amt ml-2 font-medium ${pnlClass}`}>
                  {pnlSign}NT$ {fmtTwd(Math.abs(pnl))}
                </span>
                <span className={`ml-1 ${pnlClass}`}>
                  ({pnlSign}
                  {Math.abs(pct).toFixed(2)}%)
                </span>
              </span>
              {realized !== 0 && (
                <>
                  <span>
                    <span className="text-[var(--c-muted)]">已實現</span>
                    <span className={`amt ml-2 font-medium ${tone(realized)}`}>
                      {sign(realized)}NT$ {fmtTwd(Math.abs(realized))}
                    </span>
                  </span>
                  <span>
                    <span className="text-[var(--c-muted)]">總報酬</span>
                    <span className={`amt ml-2 font-medium ${tone(totalReturn)}`}>
                      {sign(totalReturn)}NT$ {fmtTwd(Math.abs(totalReturn))}
                    </span>
                  </span>
                </>
              )}
              {accountXirrShowable && accountXirr !== null && (
                <span>
                  <span className="text-[var(--c-muted)]">年化 XIRR</span>
                  <span className={`ml-2 font-medium ${tone(accountXirr)}`}>
                    {sign(accountXirr)}
                    {Math.abs(accountXirr * 100).toFixed(2)}%
                  </span>
                </span>
              )}
              {!accountXirrShowable && accountXirr !== null && (
                <span className="text-[10px] text-[var(--c-faint)]">
                  年化暫不顯示（資料未滿 30 天）
                </span>
              )}
            </div>
          )}
          {hasFxComponent && (
            <p className="mt-2 text-xs tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--c-muted)]">
              <span>未實現拆解：</span>
              <span className={`amt ml-2 ${tone(marketPnl)}`}>
                {sign(marketPnl)}
                {fmtTwd(Math.abs(marketPnl))}
              </span>
              <span className="ml-1">標的</span>
              <span className="mx-2 text-[var(--c-faint)]">+</span>
              <span className={`amt ${tone(fxPnl)}`}>
                {sign(fxPnl)}
                {fmtTwd(Math.abs(fxPnl))}
              </span>
              <span className="ml-1">匯率</span>
              <span className="ml-2 text-[10px] text-[var(--c-faint)]">
                (avg cost FX {avgCostFx.toFixed(4)} → 現在 {curFx.toFixed(4)})
              </span>
            </p>
          )}
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            報價更新於{" "}
            <span className="text-[var(--c-text)]">{account.last_priced_at ? fmtUpdatedAt(account.last_priced_at) : "—"}</span>{" "}
            {!isManual && <RefreshPricesButton />}
            {!isManual && (
              <>
                <span className="mx-2 text-[var(--c-faint)]">·</span>
                <span className="amt">{fmtNum(Number(account.quantity), 8)}</span> ×{" "}
                {account.native_currency} {fmtNum(account.last_unit_price, 4)}
                {Number(account.last_fx_rate) !== 1 && (
                  <>
                    {" "}
                    × 匯率 {fmtNum(Number(account.last_fx_rate), 4)}
                  </>
                )}
              </>
            )}
          </p>
        </header>

        {/* === 單一帳戶趨勢 === */}
        {hasTrend && (
          <section className="mt-6">
            <div className="rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow)]">
              <h2 className="text-lg font-semibold tracking-tight">
                帳戶趨勢
              </h2>
              <p className="mt-1 text-xs text-[var(--c-muted)]">
                此帳戶每日估值（基於 account_snapshots）
              </p>
              <div className="mt-3">
                <div className="amt-chart">
                  <NetWorthPanel data={lineData} />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === Actions === */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold tracking-tight">操作</h2>
          <div className="mt-3">
            <AccountActions
              accountId={account.id}
              market={account.price_market as Market}
              currentQty={Number(account.quantity)}
              currentBalance={Number(account.manual_value_base ?? 0)}
              currentPrice={Number(account.last_unit_price ?? 0)}
              currentFx={Number(account.last_fx_rate ?? 1)}
              nativeCurrency={account.native_currency}
              currentCost={cost}
              status={(account.status as "active" | "archived") ?? "active"}
            />
          </div>
        </section>

        {/* === Recurring plans（非手動才顯示） === */}
        {!isManual && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">
              定期定額
            </h2>
            <p className="mt-1 text-xs text-[var(--c-muted)]">
              定期定額計劃。「立即執行」會依當下市價換算股數買入，並把下次執行日推到下個月。
            </p>
            <div className="mt-3">
              <RecurringPlans plans={plans} accountId={account.id} />
            </div>
          </section>
        )}

        {/* === 變動記錄 === */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">變動記錄</h2>
          <div className="mt-3 overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow)]">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--c-border)] bg-[var(--c-surface-soft)] text-xs tracking-wider text-[var(--c-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">類型</th>
                  <th className="px-4 py-3 text-right font-semibold">持有後</th>
                  <th className="px-4 py-3 text-right font-semibold">單價</th>
                  <th className="px-4 py-3 text-right font-semibold">匯率</th>
                  <th className="px-4 py-3 text-right font-semibold">市值（TWD）</th>
                  <th className="px-4 py-3 text-right font-semibold">現金流</th>
                  <th className="px-4 py-3 text-right font-semibold">已實現</th>
                  <th className="px-4 py-3 text-left font-semibold">時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border-soft)]">
                {(txns ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-sm text-[var(--c-muted)]"
                    >
                      無變動記錄
                    </td>
                  </tr>
                )}
                {((txns ?? []) as {
                  id: string;
                  type: string;
                  quantity_after: number | null;
                  unit_price: number | null;
                  fx_rate: number | null;
                  value_after_base: number | null;
                  realized_pnl: number | null;
                  cashflow_twd: number | null;
                  created_at: string;
                }[]).map((t) => {
                  const cf = t.cashflow_twd === null ? null : Number(t.cashflow_twd);
                  const rp =
                    t.realized_pnl === null ? null : Number(t.realized_pnl);
                  return (
                    <tr key={t.id} className="hover:bg-[var(--c-surface-soft)]">
                      <td className="px-4 py-2.5">
                        {TXN_LABEL[t.type] ?? t.type}
                      </td>
                      <td className="amt px-4 py-2.5 text-right tabular-nums">
                        {fmtNum(t.quantity_after, 8)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fmtNum(t.unit_price, 4)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--c-muted)]">
                        {fmtNum(t.fx_rate, 4)}
                      </td>
                      <td className="amt px-4 py-2.5 text-right font-semibold tabular-nums">
                        {fmtTwd(Number(t.value_after_base ?? 0))}
                      </td>
                      <td
                        className={`amt px-4 py-2.5 text-right tabular-nums ${cf === null ? "text-[var(--c-faint)]" : cf > 0 ? "text-[var(--c-up)]" : cf < 0 ? "text-[var(--c-down)]" : "text-[var(--c-muted)]"}`}
                      >
                        {cf === null
                          ? "—"
                          : `${cf > 0 ? "+" : cf < 0 ? "−" : ""}${fmtTwd(Math.abs(cf))}`}
                      </td>
                      <td
                        className={`amt px-4 py-2.5 text-right tabular-nums ${rp === null || rp === 0 ? "text-[var(--c-faint)]" : rp > 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}`}
                      >
                        {rp === null || rp === 0
                          ? "—"
                          : `${rp > 0 ? "+" : "−"}${fmtTwd(Math.abs(rp))}`}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--c-muted)]">
                        {fmtTime(t.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
