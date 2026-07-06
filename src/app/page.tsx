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
  // 三個彼此無依賴的讀取併批；後續交易/快照查詢要先有 activeAccountIds，故 accounts 在第一批
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
  const activeAccounts = allAccounts.filter((a) => a.status !== "archived");
  const activeAccountIds = activeAccounts.map((a) => a.id);

  // 第二批：交易 / 收入 / 快照 / profile 彼此無依賴，併批。
  // 口徑：首頁一律「目前組合」= active 帳戶。收入與快照都鎖 active，
  // 否則歸檔帳戶的歷史收入會混進 YTD / 配息率，歷史快照會留在趨勢曲線裡，
  // 而 TWR 的現金流又只看 active → 歸檔瞬間被誤判成無提領的資產暴跌。
  // XIRR 用現金流也只查 active（builder 內的 terminal value 同一個 set）。
  const hasActive = activeAccountIds.length > 0;
  const [cfRes, incomeRes, profileRes, snapsRes] = await Promise.all([
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
  const cfRows = cfRes.data;
  const incomeRows = incomeRes.data;
  const snaps = snapsRes.data;
  const targets =
    ((profileRes.data?.allocation_targets ?? {}) as Record<string, number>) ||
    {};

  const snapRows = (snaps ?? []) as SnapshotRow[];

  // 大盤對照：從第一筆 snapshot 日開始，平行抓 0050 + SPY/QQQ + USD/TWD 歷史匯率。
  // 至少兩個不同日期才抓（與趨勢圖 hasLine 門檻一致）。
  const dates = new Set(snapRows.map((s) => s.snapshot_date));
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

  // 大盤來源缺席偵測：靜默空陣列會讓使用者分不清是沒資料還是抓不到。
  // 只在「該抓而抓不到」時提示；金鑰未設是最常見成因，單獨點名。
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
    showArchived,
    cfRows: (cfRows ?? []) as CashflowRow[],
    incomeRows: (incomeRows ?? []) as IncomeRow[],
    allocationTargets: targets,
    snapRows,
    bench: { tw0050, spy: spyUsd, qqq: qqqUsd, btc: btcTwd },
    fxHistory,
    benchNotice,
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
