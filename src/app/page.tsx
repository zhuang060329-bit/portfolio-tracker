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
import { getUnreadCount } from "@/lib/notifications";

// 本頁只負責 I/O（Supabase 查詢 + 外部行情 API），
// rows → DashboardData 的組裝在 buildDashboardData（純函數，與 /demo 共用）。
// 未登入會被 proxy 導向 /login。
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = await getUnreadCount();

  const { data: accounts } = await supabase
    .from("accounts")
    .select(
      "id,name,asset_class,price_market,symbol,quantity,native_currency,last_unit_price,last_fx_rate,manual_value_base,last_priced_at,cost_basis_twd,realized_pnl_twd,status",
    )
    .order("created_at", { ascending: true });

  const allAccounts = (accounts ?? []) as AccountRow[];
  const activeAccounts = allAccounts.filter((a) => a.status !== "archived");
  const activeAccountIds = activeAccounts.map((a) => a.id);

  // XIRR 用現金流：只查 active 帳戶（builder 內的 terminal value 也用 active set）。
  const { data: cfRows } =
    activeAccountIds.length > 0
      ? await supabase
          .from("transactions")
          .select("created_at,cashflow_twd")
          .not("cashflow_twd", "is", null)
          .in("account_id", activeAccountIds)
      : { data: null as CashflowRow[] | null };

  const { data: incomeRows } = await supabase
    .from("transactions")
    .select("created_at,type,cashflow_twd")
    .in("type", ["dividend", "interest"]);

  const { data: profile } = await supabase
    .from("profiles")
    .select("allocation_targets")
    .single();
  const targets =
    ((profile?.allocation_targets ?? {}) as Record<string, number>) || {};

  const { data: snaps } = await supabase
    .from("account_snapshots")
    .select("account_id,snapshot_date,value_base")
    .order("snapshot_date", { ascending: true });
  const snapRows = (snaps ?? []) as SnapshotRow[];

  // 大盤對照：從第一筆 snapshot 日開始，平行抓 0050 + SPY/QQQ + USD/TWD 歷史匯率。
  // 至少兩個不同日期才抓（與趨勢圖 hasLine 門檻一致）。
  const dates = new Set(snapRows.map((s) => s.snapshot_date));
  const hasLine = dates.size >= 2;
  const startDate = hasLine ? [...dates].sort()[0] : "";
  const [tw0050, spyUsd, qqqUsd, fxHistory] = hasLine
    ? await Promise.all([
        fetchTwDailyClose("0050", startDate),
        fetchUsDailyClose("SPY", startDate),
        fetchUsDailyClose("QQQ", startDate),
        fetchUsdTwdHistory(startDate),
      ])
    : [[], [], [], []];

  const dashboard = buildDashboardData({
    accounts: allAccounts,
    showArchived,
    cfRows: (cfRows ?? []) as CashflowRow[],
    incomeRows: (incomeRows ?? []) as IncomeRow[],
    allocationTargets: targets,
    snapRows,
    bench: { tw0050, spy: spyUsd, qqq: qqqUsd },
    fxHistory,
  });

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="portfolio" userEmail={user?.email} unreadCount={unreadCount} />
      {/* FAB 只列非手動 active 帳戶（手動帳戶不適用 addByAmount） */}
      <QuickAddFab
        accounts={activeAccounts
          .filter((a) => a.price_market !== "manual")
          .map((a) => ({
            id: a.id,
            name: a.name,
            symbol: a.symbol,
            price_market: a.price_market,
            native_currency: a.native_currency,
            last_unit_price: a.last_unit_price,
            last_fx_rate: a.last_fx_rate,
          }))}
      />

      <main className="mx-auto max-w-[1200px] px-7 py-9 pb-28">
        <DashboardClient data={dashboard} />
      </main>
    </div>
  );
}
