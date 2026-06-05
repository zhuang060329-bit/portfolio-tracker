import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AllocationPie } from "@/components/PortfolioCharts";
import type { PerfDatum, PerfSeries } from "@/components/PortfolioCharts";
import { NetWorthPanel } from "@/components/NetWorthPanel";
import { PerformancePanel } from "@/components/PerformancePanel";
import { AppHeader } from "@/components/AppHeader";
import { AllocationTargets, type AllocRow } from "@/components/AllocationTargets";
import { computeXirr } from "@/lib/xirr";
import {
  computeMaxDrawdown,
  computeSharpe,
  computeTwr,
} from "@/lib/metrics";
import { fetchUsDailyClose } from "@/lib/prices/twelvedata";
import { fetchUsdTwdHistory } from "@/lib/prices/fx";
import { getUnreadCount } from "@/lib/notifications";
import { QuickAddFab } from "@/components/QuickAddFab";

function MetricCard({
  label,
  value,
  tone = "",
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface-soft)] p-3">
      <div className="text-[10px] tracking-wider text-[var(--c-faint)]">
        {label}
      </div>
      <div
        className={`mt-1 font-serif text-xl font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] ${tone}`}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-[var(--c-faint)]">{hint}</div>
      )}
    </div>
  );
}

// 抓 0050（FinMind）作為大盤基準。1 小時快取。
async function fetchTw0050(startDate: string) {
  if (!startDate) return [];
  try {
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=0050&start_date=${startDate}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.FINMIND_TOKEN ?? ""}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return ((json?.data ?? []) as { date: string; close: number }[]).filter(
      (r) => Number.isFinite(Number(r.close)),
    );
  } catch {
    return [];
  }
}

type AccountRow = {
  id: string;
  name: string;
  asset_class: string;
  price_market: string;
  symbol: string | null;
  quantity: number;
  native_currency: string;
  last_unit_price: number | null;
  last_fx_rate: number;
  manual_value_base: number | null;
  last_priced_at: string | null;
  cost_basis_twd: number;
  realized_pnl_twd: number;
  status: string;
};

// PnL 顯示工具：國際慣例 — 賺綠虧紅（與英文金融介面一致）。
function pnlClass(n: number): string {
  if (n > 0) return "text-emerald-700 dark:text-emerald-400";
  if (n < 0) return "text-rose-700 dark:text-rose-400";
  return "text-[var(--c-muted)]";
}
function pnlSign(n: number): string {
  return n > 0 ? "+" : n < 0 ? "−" : "";
}
function pnlPct(value: number, cost: number): number {
  return cost > 0 ? ((value - cost) / cost) * 100 : 0;
}

const ASSET_CLASS_LABEL: Record<string, string> = {
  liquid_cash: "流動資金",
  fund: "基金",
  stock: "股票",
  crypto: "加密貨幣",
  precious_metal: "貴金屬",
  other_investment: "其他投資",
  fixed_asset: "固定資產",
  receivable: "應收款",
  liability: "負債",
};

const MARKET_LABEL: Record<string, string> = {
  us: "美股",
  tw: "台股",
  crypto: "加密貨幣",
  manual: "手動",
};

function valueOf(a: AccountRow): number {
  if (a.price_market === "manual") return Number(a.manual_value_base ?? 0);
  const unit = Number(a.last_unit_price ?? 0);
  const fx = Number(a.last_fx_rate ?? 1);
  return Number(a.quantity) * unit * fx;
}

const fmtTwd = (n: number) =>
  n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });

const fmtNum = (n: number | null, max = 8) =>
  n === null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("en-US", { maximumFractionDigits: max });

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-CA") : "—";

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
  const archivedCount = allAccounts.length - activeAccounts.length;
  const list = showArchived ? allAccounts : activeAccounts;
  const total = list.reduce((sum, a) => sum + valueOf(a), 0);
  const totalCost = list.reduce(
    (sum, a) => sum + Number(a.cost_basis_twd ?? 0),
    0,
  );
  const totalRealized = list.reduce(
    (sum, a) => sum + Number(a.realized_pnl_twd ?? 0),
    0,
  );
  const totalUnrealized = total - totalCost;
  const totalPnl = totalUnrealized; // 預設「P/L」= 未實現（沿用既有命名）
  const totalPnlPct = pnlPct(total, totalCost);
  const totalReturn = totalUnrealized + totalRealized;

  // XIRR：跨所有帳戶的現金流 + 今天的當前淨值
  const { data: cfRows } = await supabase
    .from("transactions")
    .select("created_at,cashflow_twd")
    .not("cashflow_twd", "is", null);
  const cashflows = ((cfRows ?? []) as {
    created_at: string;
    cashflow_twd: number;
  }[])
    .map((r) => ({ amount: Number(r.cashflow_twd), when: new Date(r.created_at) }))
    .filter((c) => Number.isFinite(c.amount) && c.amount !== 0);
  const now = new Date();
  if (total > 0) cashflows.push({ amount: total, when: now });
  const xirr = computeXirr(cashflows);
  // 資料 < 30 天時，年化會把短期波動放大成失真值（例如 5 天虧 10% 變 -99% 年化），
  // 直接隱藏比顯示誤導值好。
  const xirrSpanDays =
    cashflows.length > 1
      ? (now.getTime() -
          Math.min(...cashflows.map((c) => c.when.getTime()))) /
        86_400_000
      : 0;
  const xirrShowable = xirr !== null && xirrSpanDays >= 30;
  const latestUpdate = list
    .map((a) => a.last_priced_at)
    .filter((x): x is string => !!x)
    .sort()
    .pop();

  // 圓餅：依 asset_class 分組（用 active 帳戶算配置）
  const byClass = new Map<string, number>();
  for (const a of activeAccounts) {
    byClass.set(a.asset_class, (byClass.get(a.asset_class) ?? 0) + valueOf(a));
  }
  const pieData = [...byClass.entries()]
    .map(([cls, value]) => ({
      label: ASSET_CLASS_LABEL[cls] ?? cls,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  // 配置目標：讀 profile.allocation_targets
  const { data: profile } = await supabase
    .from("profiles")
    .select("allocation_targets")
    .single();
  const targets =
    ((profile?.allocation_targets ?? {}) as Record<string, number>) || {};
  const activeTotal = activeAccounts.reduce((s, a) => s + valueOf(a), 0);
  const classKeys = Array.from(
    new Set<string>([...byClass.keys(), ...Object.keys(targets)]),
  );
  const allocRows: AllocRow[] = classKeys
    .map((cls) => ({
      cls,
      actual:
        activeTotal > 0 ? ((byClass.get(cls) ?? 0) / activeTotal) * 100 : 0,
      target: Number(targets[cls] ?? 0),
    }))
    .sort((a, b) => b.actual + b.target - a.actual - a.target);

  // 折線：account_snapshots 按 snapshot_date 加總
  const { data: snaps } = await supabase
    .from("account_snapshots")
    .select("snapshot_date,value_base")
    .order("snapshot_date", { ascending: true });
  const byDate = new Map<string, number>();
  for (const s of (snaps ?? []) as { snapshot_date: string; value_base: number }[]) {
    byDate.set(
      s.snapshot_date,
      (byDate.get(s.snapshot_date) ?? 0) + Number(s.value_base),
    );
  }
  const lineData = [...byDate.entries()].map(([date, value]) => ({ date, value }));
  const hasLine = lineData.length >= 2;
  const hasPie = pieData.length >= 1 && total > 0;

  // 進階指標：用 account_snapshots（lineData）+ 同樣的 cashflows。
  // TWR 把現金流影響扣掉，看「策略本身」報酬；最大回撤看下行風險；
  // Sharpe 用 252 交易日年化、台幣定存約 1.5% 當無風險利率。
  // 30 天以下不顯示（樣本太少不可靠）。
  const snapshotsForMetrics = lineData.map((p) => ({
    date: p.date,
    value: p.value,
  }));
  const cashflowsForMetrics = cashflows.map((c) => ({
    date: c.when.toISOString().slice(0, 10),
    amount: c.amount,
  }));
  const twrShowable = snapshotsForMetrics.length >= 30;
  const twrResult = twrShowable
    ? computeTwr(snapshotsForMetrics, cashflowsForMetrics)
    : null;
  const drawdown = twrShowable
    ? computeMaxDrawdown(snapshotsForMetrics)
    : null;
  const sharpe = twrShowable
    ? computeSharpe(snapshotsForMetrics, cashflowsForMetrics, 0.015)
    : null;

  // 大盤對照：從第一筆 snapshot 日開始，平行抓 0050 + SPY/QQQ + USD/TWD 歷史匯率。
  //
  // 為什麼要抓匯率？組合用 TWD 估值，SPY/QQQ 是 USD close；如果直接各自 normalize，
  // 美元匯率變化會偷偷算在組合那邊（美元漲時看起來「我贏 SPY」其實是匯率贏），
  // 兩條線不在同一個 base。修法：把 SPY/QQQ 的 USD close × 當日匯率換成 TWD 後再存。
  //
  // 週末/假日匯率沒資料，用「最近一個交易日」forward-fill。
  const startDate = hasLine ? lineData[0].date : "";
  const [tw0050, spyUsd, qqqUsd, fxHistory] = hasLine
    ? await Promise.all([
        fetchTw0050(startDate),
        fetchUsDailyClose("SPY", startDate),
        fetchUsDailyClose("QQQ", startDate),
        fetchUsdTwdHistory(startDate),
      ])
    : [[], [], [], []];

  // 建立日期 -> 匯率 map，並 forward-fill：
  // 取日期 d 的匯率時，若 d 本身沒值，用 <= d 的最近一筆。
  const fxSorted = [...fxHistory].sort((a, b) => a.date.localeCompare(b.date));
  function fxAt(date: string): number | null {
    // 線性掃描：fxSorted 通常 <500 筆，效能不是問題。
    let last: number | null = null;
    for (const r of fxSorted) {
      if (r.date <= date) last = r.rate;
      else break;
    }
    return last;
  }

  const perfMap = new Map<string, PerfDatum>();
  // portfolio 原始 TWD 估值（未 normalize，由 client 依範圍 re-normalize）
  for (const p of lineData) {
    perfMap.set(p.date, { date: p.date, portfolio: p.value });
  }
  // 0050 本身就是 TWD，直接用 close
  for (const r of tw0050) {
    const ex = perfMap.get(r.date) ?? { date: r.date };
    ex.tw0050 = Number(r.close);
    perfMap.set(r.date, ex);
  }
  // SPY / QQQ 必須換成 TWD 才能跟組合在同一個 base 比較
  for (const r of spyUsd) {
    const fx = fxAt(r.date);
    if (fx === null) continue;
    const ex = perfMap.get(r.date) ?? { date: r.date };
    ex.spy = Number(r.close) * fx;
    perfMap.set(r.date, ex);
  }
  for (const r of qqqUsd) {
    const fx = fxAt(r.date);
    if (fx === null) continue;
    const ex = perfMap.get(r.date) ?? { date: r.date };
    ex.qqq = Number(r.close) * fx;
    perfMap.set(r.date, ex);
  }
  const perfData = [...perfMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const perfSeries: PerfSeries[] = [
    { key: "spy", label: "S&P 500（SPY，TWD）", color: "#3B82F6", dash: "6 4" },
    { key: "qqq", label: "Nasdaq 100（QQQ，TWD）", color: "#A855F7", dash: "4 4" },
    { key: "tw0050", label: "0050（台股）", color: "#10B981", dash: "2 4" },
  ];
  const hasPerf =
    perfData.length >= 2 &&
    (tw0050.length > 0 || spyUsd.length > 0 || qqqUsd.length > 0);

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

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* === 總淨資產 hero === */}
        <section className="border-b border-[var(--c-border)] pb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--c-muted)]">
            總淨資產
          </p>
          <p className="mt-2 flex items-baseline gap-2 font-serif">
            <span className="text-2xl font-medium text-[var(--c-muted)] sm:text-3xl">
              NT$
            </span>
            <span className="text-4xl font-semibold tracking-tight tabular-nums [font-variant-numeric:lining-nums_tabular-nums] sm:text-5xl">
              {fmtTwd(total)}
            </span>
          </p>
          {totalCost > 0 && (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
              <span>
                <span className="text-[var(--c-muted)]">成本</span>
                <span className="ml-2 text-[var(--c-text)]">
                  NT$ {fmtTwd(totalCost)}
                </span>
              </span>
              <span>
                <span className="text-[var(--c-muted)]">未實現</span>
                <span className={`ml-2 font-medium ${pnlClass(totalPnl)}`}>
                  {pnlSign(totalPnl)}NT$ {fmtTwd(Math.abs(totalPnl))}
                </span>
                <span className={`ml-1 ${pnlClass(totalPnl)}`}>
                  ({pnlSign(totalPnl)}
                  {Math.abs(totalPnlPct).toFixed(2)}%)
                </span>
              </span>
              {totalRealized !== 0 && (
                <>
                  <span>
                    <span className="text-[var(--c-muted)]">已實現</span>
                    <span
                      className={`ml-2 font-medium ${pnlClass(totalRealized)}`}
                    >
                      {pnlSign(totalRealized)}NT$ {fmtTwd(Math.abs(totalRealized))}
                    </span>
                  </span>
                  <span>
                    <span className="text-[var(--c-muted)]">總報酬</span>
                    <span className={`ml-2 font-medium ${pnlClass(totalReturn)}`}>
                      {pnlSign(totalReturn)}NT$ {fmtTwd(Math.abs(totalReturn))}
                    </span>
                  </span>
                </>
              )}
              {xirrShowable && xirr !== null && (
                <span>
                  <span className="text-[var(--c-muted)]">年化（XIRR）</span>
                  <span className={`ml-2 font-medium ${pnlClass(xirr)}`}>
                    {pnlSign(xirr)}
                    {Math.abs(xirr * 100).toFixed(2)}%
                  </span>
                </span>
              )}
              {!xirrShowable && xirr !== null && (
                <span className="text-[10px] text-[var(--c-faint)]">
                  年化暫不顯示（資料未滿 30 天，短期年化會嚴重失真）
                </span>
              )}
            </div>
          )}
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            報價更新於{" "}
            <span className="text-[var(--c-text)]">{fmtDate(latestUpdate ?? null)}</span>
            <span className="mx-2 text-[var(--c-faint)]">·</span>
            共 {list.length} 個帳戶
          </p>
        </section>

        {/* === 圖表區（有資產才顯示） === */}
        {(hasPie || hasLine) && (
          <section className="mt-8 flex flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {hasPie && (
                <div className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm">
                  <h2 className="font-serif text-lg font-semibold tracking-tight">
                    資產配置
                  </h2>
                  <p className="mt-1 text-xs text-[var(--c-muted)]">依資產類別分佈</p>
                  <div className="mt-3">
                    <AllocationPie data={pieData} />
                  </div>
                </div>
              )}
              <div className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm">
                <h2 className="font-serif text-lg font-semibold tracking-tight">
                  淨資產趨勢
                </h2>
                <p className="mt-1 text-xs text-[var(--c-muted)]">
                  {hasLine
                    ? "歷史每日淨資產（基於 account_snapshots）"
                    : "至少要兩天以上的快照才會出現折線——明天再來看。"}
                </p>
                <div className="mt-3">
                  {hasLine ? (
                    <NetWorthPanel data={lineData} />
                  ) : (
                    <div className="flex h-[260px] items-center justify-center text-sm text-[var(--c-faint)]">
                      明天會有第二筆快照，折線才會出現。
                    </div>
                  )}
                </div>
              </div>
            </div>
            {hasPerf && (
              <div className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm">
                <h2 className="font-serif text-lg font-semibold tracking-tight">
                  績效對照
                </h2>
                <p className="mt-1 text-xs text-[var(--c-muted)]">
                  與 S&amp;P 500、Nasdaq 100、台股 0050 比較。SPY/QQQ 已換算成 TWD，與組合同幣別；每條線以所選範圍起點 = 100 normalize；點下方標籤可切換顯示。
                </p>
                <div className="mt-3">
                  <PerformancePanel data={perfData} benchmarks={perfSeries} />
                </div>
              </div>
            )}
            {allocRows.length > 0 && <AllocationTargets rows={allocRows} />}
          </section>
        )}

        {/* === 進階績效指標 === */}
        {(twrResult || drawdown || sharpe !== null) && (
          <section className="mt-8 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm">
            <h2 className="font-serif text-lg font-semibold tracking-tight">
              績效指標
            </h2>
            <p className="mt-1 text-xs text-[var(--c-muted)]">
              基於每日淨值快照計算。TWR 剔除現金流時機影響，反映策略本身；
              最大回撤看下行風險；Sharpe 用台幣定存 1.5% 當無風險利率。
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {twrResult && (
                <MetricCard
                  label="TWR（累積）"
                  value={`${twrResult.total >= 0 ? "+" : "−"}${(Math.abs(twrResult.total) * 100).toFixed(2)}%`}
                  tone={
                    twrResult.total > 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : twrResult.total < 0
                        ? "text-rose-700 dark:text-rose-400"
                        : ""
                  }
                  hint="策略本身報酬，不受現金流時機影響"
                />
              )}
              {twrResult && (
                <MetricCard
                  label="TWR（年化）"
                  value={`${twrResult.annualized >= 0 ? "+" : "−"}${(Math.abs(twrResult.annualized) * 100).toFixed(2)}%`}
                  tone={
                    twrResult.annualized > 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : twrResult.annualized < 0
                        ? "text-rose-700 dark:text-rose-400"
                        : ""
                  }
                  hint="可與 SPY / 0050 同時間區間比較"
                />
              )}
              {drawdown && (
                <MetricCard
                  label="最大回撤"
                  value={`−${(Math.abs(drawdown.pct) * 100).toFixed(2)}%`}
                  tone="text-rose-700 dark:text-rose-400"
                  hint={`${drawdown.peakDate} → ${drawdown.troughDate}`}
                />
              )}
              {sharpe !== null && (
                <MetricCard
                  label="Sharpe ratio"
                  value={sharpe.toFixed(2)}
                  tone={
                    sharpe > 1
                      ? "text-emerald-700 dark:text-emerald-400"
                      : sharpe < 0
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-[var(--c-muted)]"
                  }
                  hint=">1 算優秀；<0 表示報酬不如無風險利率"
                />
              )}
            </div>
            {!twrShowable && (
              <p className="mt-3 text-[10px] text-[var(--c-faint)]">
                快照不足 30 天，指標暫不顯示（樣本太少結果不可靠）。
              </p>
            )}
          </section>
        )}

        {/* === Holdings === */}
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-semibold tracking-tight">
                持有資產
              </h2>
              <p className="mt-1 text-sm text-[var(--c-muted)]">
                所有帳戶的目前估值，TWD 為基準幣別。
                {archivedCount > 0 && (
                  <>
                    <span className="mx-2 text-[var(--c-faint)]">·</span>
                    <Link
                      href={showArchived ? "/" : "/?archived=1"}
                      className="text-[var(--c-muted)] underline hover:text-[var(--c-text)]"
                    >
                      {showArchived
                        ? `隱藏 ${archivedCount} 個已歸檔`
                        : `顯示 ${archivedCount} 個已歸檔`}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <Link
              href="/accounts/new"
              className="shrink-0 rounded-sm bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              ＋ 新增帳戶
            </Link>
          </div>

          {list.length === 0 ? (
            <div className="mt-6 rounded-md border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center">
              <p className="text-sm text-[var(--c-muted)]">
                還沒有任何帳戶。點右上「＋ 新增帳戶」建立第一個。
              </p>
            </div>
          ) : (
            <>
              {/* 桌機：表格 */}
              <div className="mt-6 hidden overflow-hidden rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] shadow-sm md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--c-border)] bg-[var(--c-surface-soft)] text-xs tracking-wider text-[var(--c-muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">帳戶</th>
                      <th className="px-4 py-3 text-left font-semibold">市場</th>
                      <th className="px-4 py-3 text-right font-semibold">持有</th>
                      <th className="px-4 py-3 text-right font-semibold">
                        單價（原幣）
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        成本（TWD）
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        市值（TWD）
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        未實現
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        已實現
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">更新日</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--c-border-soft)]">
                    {list.map((a) => {
                      const value = valueOf(a);
                      const cost = Number(a.cost_basis_twd ?? 0);
                      const realized = Number(a.realized_pnl_twd ?? 0);
                      const pnl = value - cost;
                      const pct = pnlPct(value, cost);
                      return (
                        <tr
                          key={a.id}
                          className={`hover:bg-[var(--c-surface-soft)] ${a.status === "archived" ? "opacity-60" : ""}`}
                        >
                          <td className="px-4 py-3 font-medium">
                            <Link
                              href={`/accounts/${a.id}`}
                              className="text-[var(--c-text)] hover:text-[var(--c-accent)] hover:underline"
                            >
                              {a.name}
                            </Link>
                            {a.symbol && (
                              <span className="ml-2 text-xs text-[var(--c-muted)]">
                                {a.symbol}
                              </span>
                            )}
                            {a.status === "archived" && (
                              <span className="ml-2 rounded-sm bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 text-[10px] tracking-wider text-amber-800 dark:text-amber-300">
                                已歸檔
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[var(--c-muted)]">
                            {MARKET_LABEL[a.price_market] ?? a.price_market}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {a.price_market === "manual"
                              ? "—"
                              : fmtNum(Number(a.quantity), 8)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {a.price_market === "manual"
                              ? "—"
                              : `${a.native_currency} ${fmtNum(a.last_unit_price, 4)}`}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[var(--c-muted)]">
                            {fmtTwd(cost)}
                          </td>
                          <td className="px-4 py-3 text-right text-base font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                            {fmtTwd(value)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums [font-variant-numeric:lining-nums_tabular-nums] ${pnlClass(pnl)}`}
                          >
                            {a.price_market === "manual" ? (
                              <span className="text-[var(--c-muted)]">—</span>
                            ) : (
                              <>
                                <div className="font-semibold">
                                  {pnlSign(pnl)}
                                  {fmtTwd(Math.abs(pnl))}
                                </div>
                                <div className="text-[10px] opacity-80">
                                  {pnlSign(pnl)}
                                  {Math.abs(pct).toFixed(2)}%
                                </div>
                              </>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums [font-variant-numeric:lining-nums_tabular-nums] ${pnlClass(realized)}`}
                          >
                            {realized === 0 ? (
                              <span className="text-[var(--c-muted)]">—</span>
                            ) : (
                              <span className="font-medium">
                                {pnlSign(realized)}
                                {fmtTwd(Math.abs(realized))}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[var(--c-muted)]">
                            {fmtDate(a.last_priced_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-[var(--c-border)] bg-[var(--c-surface-soft)] text-sm">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-right font-semibold text-[var(--c-muted)]"
                      >
                        合計
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--c-muted)]">
                        {fmtTwd(totalCost)}
                      </td>
                      <td className="px-4 py-3 text-right text-base font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                        {fmtTwd(total)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums [font-variant-numeric:lining-nums_tabular-nums] ${pnlClass(totalPnl)}`}
                      >
                        <div className="font-bold">
                          {pnlSign(totalPnl)}
                          {fmtTwd(Math.abs(totalPnl))}
                        </div>
                        <div className="text-[10px] opacity-80">
                          {pnlSign(totalPnl)}
                          {Math.abs(totalPnlPct).toFixed(2)}%
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums [font-variant-numeric:lining-nums_tabular-nums] ${pnlClass(totalRealized)}`}
                      >
                        {totalRealized === 0 ? (
                          <span className="text-[var(--c-muted)]">—</span>
                        ) : (
                          <span className="font-bold">
                            {pnlSign(totalRealized)}
                            {fmtTwd(Math.abs(totalRealized))}
                          </span>
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 手機：卡片 stack */}
              <div className="mt-6 flex flex-col gap-3 md:hidden">
                {list.map((a) => {
                  const value = valueOf(a);
                  const cost = Number(a.cost_basis_twd ?? 0);
                  const realized = Number(a.realized_pnl_twd ?? 0);
                  const pnl = value - cost;
                  const pct = pnlPct(value, cost);
                  return (
                    <Link
                      key={a.id}
                      href={`/accounts/${a.id}`}
                      className="block rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm hover:bg-[var(--c-surface-soft)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{a.name}</div>
                          <div className="text-xs text-[var(--c-muted)]">
                            {MARKET_LABEL[a.price_market] ?? a.price_market}
                            {a.symbol ? ` · ${a.symbol}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                            {fmtTwd(value)}
                          </div>
                          <div className="text-[10px] text-[var(--c-muted)]">TWD</div>
                        </div>
                      </div>
                      {a.price_market !== "manual" && (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-[10px] tracking-wider text-[var(--c-faint)]">
                              持有
                            </div>
                            <div className="tabular-nums text-[var(--c-muted)]">
                              {fmtNum(Number(a.quantity), 8)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] tracking-wider text-[var(--c-faint)]">
                              成本
                            </div>
                            <div className="tabular-nums text-[var(--c-muted)]">
                              {fmtTwd(cost)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] tracking-wider text-[var(--c-faint)]">
                              未實現
                            </div>
                            <div
                              className={`font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] ${pnlClass(pnl)}`}
                            >
                              {pnlSign(pnl)}
                              {fmtTwd(Math.abs(pnl))}
                            </div>
                            <div className={`text-[10px] ${pnlClass(pnl)}`}>
                              {pnlSign(pnl)}
                              {Math.abs(pct).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      )}
                      {realized !== 0 && (
                        <div className="mt-2 flex justify-between border-t border-[var(--c-border-soft)] pt-2 text-xs">
                          <span className="text-[10px] tracking-wider text-[var(--c-faint)]">
                            已實現
                          </span>
                          <span
                            className={`font-medium tabular-nums ${pnlClass(realized)}`}
                          >
                            {pnlSign(realized)}NT$ {fmtTwd(Math.abs(realized))}
                          </span>
                        </div>
                      )}
                    </Link>
                  );
                })}
                <div className="flex items-center justify-between rounded-md bg-[var(--c-accent)] px-4 py-3 text-white">
                  <span className="text-xs tracking-wider opacity-90">
                    合計
                  </span>
                  <span className="font-serif text-lg font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                    NT$ {fmtTwd(total)}
                  </span>
                </div>
                {totalCost > 0 && (
                  <div className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--c-muted)]">成本</span>
                      <span className="tabular-nums">NT$ {fmtTwd(totalCost)}</span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-[var(--c-muted)]">未實現</span>
                      <span
                        className={`font-medium tabular-nums ${pnlClass(totalPnl)}`}
                      >
                        {pnlSign(totalPnl)}NT$ {fmtTwd(Math.abs(totalPnl))} (
                        {pnlSign(totalPnl)}
                        {Math.abs(totalPnlPct).toFixed(2)}%)
                      </span>
                    </div>
                    {totalRealized !== 0 && (
                      <div className="mt-1 flex justify-between">
                        <span className="text-[var(--c-muted)]">已實現</span>
                        <span
                          className={`font-medium tabular-nums ${pnlClass(totalRealized)}`}
                        >
                          {pnlSign(totalRealized)}NT${" "}
                          {fmtTwd(Math.abs(totalRealized))}
                        </span>
                      </div>
                    )}
                    {xirrShowable && xirr !== null && (
                      <div className="mt-1 flex justify-between">
                        <span className="text-[var(--c-muted)]">年化 XIRR</span>
                        <span
                          className={`font-medium tabular-nums ${pnlClass(xirr)}`}
                        >
                          {pnlSign(xirr)}
                          {Math.abs(xirr * 100).toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
