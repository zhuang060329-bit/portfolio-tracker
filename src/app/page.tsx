import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { QuickAddFab } from "@/components/QuickAddFab";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import {
  buildDashboardData,
  type AccountRow,
  type CashflowRow,
  type IncomeRow,
  type SnapshotRow,
} from "@/lib/dashboard-data";
import { fetchUsDailyClose } from "@/lib/prices/twelvedata";
import { fetchUsdTwdHistory } from "@/lib/prices/fx";
import { fetchTwDailyClose } from "@/lib/prices/finmind";
import { fetchBtcDailyCloseTwd } from "@/lib/prices/coingecko";
import { getUnreadCount } from "@/lib/notifications";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";

  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    unreadCount,
    { data: accounts },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUnreadCount(),
    supabase
      .from("accounts")
      .select(
        "id,name,asset_class,price_market,symbol,quantity,native_currency,last_unit_price,last_fx_rate,manual_value_base,last_priced_at,cost_basis_twd,realized_pnl_twd,status",
      )
      .order("created_at", { ascending: true }),
  ]);

  const allAccounts = (accounts ?? []) as AccountRow[];
  const activeAccounts = allAccounts.filter((account) => account.status !== "archived");
  const activeAccountIds = activeAccounts.map((account) => account.id);

  // 總覽金融指標只使用 active portfolio；封存切換只影響持倉帳本。
  const hasActive = activeAccountIds.length > 0;
  const [cashflowResult, incomeResult, profileResult, snapshotResult] =
    await Promise.all([
      hasActive
        ? supabase
            .from("transactions")
            .select("created_at,cashflow_twd")
            .not("cashflow_twd", "is", null)
            .in("account_id", activeAccountIds)
        : Promise.resolve({ data: null as CashflowRow[] | null }),
      hasActive
        ? supabase
            .from("transactions")
            .select("created_at,type,cashflow_twd")
            .in("type", ["dividend", "interest"])
            .in("account_id", activeAccountIds)
        : Promise.resolve({ data: null as IncomeRow[] | null }),
      supabase.from("profiles").select("allocation_targets").single(),
      hasActive
        ? supabase
            .from("account_snapshots")
            .select("account_id,snapshot_date,value_base")
            .in("account_id", activeAccountIds)
            .order("snapshot_date", { ascending: true })
        : Promise.resolve({ data: null as SnapshotRow[] | null }),
    ]);

  const cashflowRows = cashflowResult.data;
  const incomeRows = incomeResult.data;
  const snapshotRows = (snapshotResult.data ?? []) as SnapshotRow[];
  const targets =
    ((profileResult.data?.allocation_targets ?? {}) as Record<string, number>) ||
    {};

  // Benchmark 從第一筆 active portfolio 快照日起算。
  const dates = new Set(snapshotRows.map((snapshot) => snapshot.snapshot_date));
  const hasLine = dates.size >= 2;
  const startDate = hasLine ? [...dates].sort()[0] : "";
  const [tw0050, spyUsd, qqqUsd, btcTwd, fxHistory] = hasLine
    ? await Promise.all([
        fetchTwDailyClose("0050", startDate),
        fetchUsDailyClose("SPY", startDate),
        fetchUsDailyClose("QQQ", startDate),
        fetchBtcDailyCloseTwd(startDate),
        fetchUsdTwdHistory(startDate),
      ])
    : [[], [], [], [], []];

  let benchNotice: string | null = null;
  if (hasLine) {
    const missing: string[] = [];
    if (spyUsd.length === 0 || qqqUsd.length === 0 || fxHistory.length === 0) {
      missing.push(
        process.env.TWELVE_DATA_API_KEY
          ? "SPY/QQQ"
          : "SPY/QQQ（未設定 TWELVE_DATA_API_KEY）",
      );
    }
    if (tw0050.length === 0) missing.push("0050");
    if (btcTwd.length === 0) missing.push("BTC");
    if (missing.length > 0) {
      benchNotice = `${missing.join("、")} 目前取不到資料，對照線會缺席`;
    }
  }

  const dashboard = buildDashboardData({
    accounts: allAccounts,
    includeArchivedHoldings: showArchived,
    cfRows: (cashflowRows ?? []) as CashflowRow[],
    incomeRows: (incomeRows ?? []) as IncomeRow[],
    allocationTargets: targets,
    snapRows: snapshotRows,
    bench: { tw0050, spy: spyUsd, qqq: qqqUsd, btc: btcTwd },
    fxHistory,
    benchNotice,
  });

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader
        active="portfolio"
        userEmail={user?.email}
        unreadCount={unreadCount}
      />
      <QuickAddFab
        accounts={activeAccounts
          .filter((account) => account.price_market !== "manual")
          .map((account) => ({
            id: account.id,
            name: account.name,
            symbol: account.symbol,
            price_market: account.price_market,
            native_currency: account.native_currency,
            last_unit_price: account.last_unit_price,
            last_fx_rate: account.last_fx_rate,
          }))}
      />

      <main className="mx-auto max-w-[1200px] px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:px-7 lg:pt-8">
        <DashboardClient data={dashboard} />
      </main>
    </div>
  );
}
