import {
  type DashboardData,
  type Holding,
  type AllocTarget,
} from "@/components/dashboard/DashboardClient";
import type {
  AllocDatum,
  BenchSeries,
  PerfPoint,
} from "@/components/dashboard/DashboardCharts";
import { computeXirr } from "@/lib/xirr";
import {
  buildTwrSeries,
  computeMaxDrawdown,
  computeSharpe,
  computeTwr,
  forwardFillBenchmarks,
} from "@/lib/metrics";
import { todayTaipei } from "@/lib/dates";

// 總覽資料組裝：rows in → DashboardData out，純函數、無 I/O。
// 從 page.tsx 原樣抽出（計算行為不變），供兩個呼叫端共用：
// - src/app/page.tsx：Supabase 查詢 + 外部行情 API
// - src/app/demo/page.tsx：demo-data 生成器（同一條計算管線，不是寫死的展示數字）

export type AccountRow = {
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

export type CashflowRow = { created_at: string; cashflow_twd: number };
export type IncomeRow = {
  created_at: string;
  type: string;
  cashflow_twd: number | null;
};
export type SnapshotRow = {
  account_id: string;
  snapshot_date: string;
  value_base: number;
};
export type DailyClose = { date: string; close: number };
export type FxRate = { date: string; rate: number };

export type DashboardInputs = {
  accounts: AccountRow[];
  showArchived: boolean;
  cfRows: CashflowRow[];
  incomeRows: IncomeRow[];
  allocationTargets: Record<string, number>;
  snapRows: SnapshotRow[];
  bench: { tw0050: DailyClose[]; spy: DailyClose[]; qqq: DailyClose[] };
  fxHistory: FxRate[];
  /** demo 用：固定時間讓輸出可重現。省略 = 現在。 */
  now?: Date;
  today?: string;
};

export const ASSET_CLASS_LABEL: Record<string, string> = {
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

export const MARKET_LABEL: Record<string, string> = {
  us: "美股",
  tw: "台股",
  crypto: "加密貨幣",
  manual: "手動",
};

export function valueOf(a: AccountRow): number {
  if (a.price_market === "manual") return Number(a.manual_value_base ?? 0);
  const unit = Number(a.last_unit_price ?? 0);
  const fx = Number(a.last_fx_rate ?? 1);
  return Number(a.quantity) * unit * fx;
}

export function buildDashboardData(input: DashboardInputs): DashboardData {
  const {
    accounts,
    showArchived,
    cfRows,
    incomeRows,
    allocationTargets: targets,
    snapRows,
    bench,
    fxHistory,
  } = input;

  const allAccounts = accounts;
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
  const totalPnlPct = totalCost > 0 ? (totalUnrealized / totalCost) * 100 : 0;

  // XIRR：只納入 active 帳戶的現金流 + 今天的 active 帳戶總值（terminal value）。
  // cashflows 與 terminal value 使用同一個 active account set，
  // 避免 archived 帳戶歷史負現金流進入計算但終值未計入而低估報酬率。
  const activeTotal = activeAccounts.reduce((s, a) => s + valueOf(a), 0);
  const cashflows = cfRows
    .map((r) => ({
      amount: Number(r.cashflow_twd),
      when: new Date(r.created_at),
    }))
    .filter((c) => Number.isFinite(c.amount) && c.amount !== 0);
  const now = input.now ?? new Date();
  if (activeTotal > 0) cashflows.push({ amount: activeTotal, when: now });
  const xirr = computeXirr(cashflows);
  // 資料 < 30 天時，年化會把短期波動放大成失真值，直接隱藏比顯示誤導值好。
  const xirrSpanDays =
    cashflows.length > 1
      ? (now.getTime() - Math.min(...cashflows.map((c) => c.when.getTime()))) /
        86_400_000
      : 0;
  const xirrShowable = xirr !== null && xirrSpanDays >= 30;

  // 被動收入：dividend + interest 的 cashflow_twd 加總（cashflow > 0 表示收到）。
  const incomeAll = incomeRows.filter((r) => Number(r.cashflow_twd ?? 0) > 0);

  const nowMs = now.getTime();
  const ytdStartMs = new Date(
    `${now.getFullYear()}-01-01T00:00:00+08:00`,
  ).getTime();
  const rolling12mStartMs = nowMs - 365 * 86_400_000;

  let incomeYtd = 0;
  let incomeRolling12m = 0;
  let dividendAll = 0;
  let interestAll = 0;
  for (const r of incomeAll) {
    const t = new Date(r.created_at).getTime();
    const amt = Number(r.cashflow_twd ?? 0);
    if (t >= ytdStartMs) incomeYtd += amt;
    if (t >= rolling12mStartMs) incomeRolling12m += amt;
    if (r.type === "dividend") dividendAll += amt;
    else if (r.type === "interest") interestAll += amt;
  }
  const monthlyAvg12m = incomeRolling12m / 12;
  const yieldOnCost = totalCost > 0 ? (incomeRolling12m / totalCost) * 100 : 0;
  const hasIncome = incomeAll.length > 0;
  const latestUpdate = list
    .map((a) => a.last_priced_at)
    .filter((x): x is string => !!x)
    .sort()
    .pop();

  // 配置：依 asset_class 分組（用 active 帳戶）
  const byClass = new Map<string, number>();
  for (const a of activeAccounts) {
    byClass.set(a.asset_class, (byClass.get(a.asset_class) ?? 0) + valueOf(a));
  }
  // donut 只吃正值切片（負值在圓餅無意義，沿用既有行為）
  const allocation: AllocDatum[] = [...byClass.entries()]
    .filter(([, value]) => value > 0)
    .map(([cls, value]) => ({
      cls,
      label: ASSET_CLASS_LABEL[cls] ?? cls,
      value,
      pct: activeTotal > 0 ? (value / activeTotal) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const classKeys = Array.from(
    new Set<string>([...byClass.keys(), ...Object.keys(targets)]),
  );
  const allocTargets: AllocTarget[] = classKeys
    .map((cls) => ({
      cls,
      label: ASSET_CLASS_LABEL[cls] ?? cls,
      actual:
        activeTotal > 0 ? ((byClass.get(cls) ?? 0) / activeTotal) * 100 : 0,
      target: Number(targets[cls] ?? 0),
    }))
    .sort((a, b) => b.actual + b.target - a.actual - a.target);

  // 折線 + 今日變化：account_snapshots
  // - byDate 加總成淨資產日序列（趨勢圖）
  // - byAccount 取每帳戶最近兩筆快照，算「今日」漲跌（收盤對收盤）
  const byDate = new Map<string, number>();
  const byAccount = new Map<string, { date: string; value: number }[]>();
  for (const s of snapRows) {
    const v = Number(s.value_base);
    byDate.set(s.snapshot_date, (byDate.get(s.snapshot_date) ?? 0) + v);
    const arr = byAccount.get(s.account_id) ?? [];
    arr.push({ date: s.snapshot_date, value: v });
    byAccount.set(s.account_id, arr);
  }
  const lineData = [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const hasLine = lineData.length >= 2;

  // 每帳戶今日漲跌（小數）：最近兩筆快照差。不足兩筆 → null。
  const accountDay = new Map<string, number | null>();
  for (const [id, arr] of byAccount) {
    if (arr.length < 2) {
      accountDay.set(id, null);
      continue;
    }
    const prev = arr[arr.length - 2].value;
    const last = arr[arr.length - 1].value;
    accountDay.set(id, prev > 0 ? (last - prev) / prev : null);
  }

  // 組合今日變化（TWD + %）：淨資產日序列最後兩筆差。
  let dayChange: number | null = null;
  let dayChangePct: number | null = null;
  if (hasLine) {
    const prev = lineData[lineData.length - 2].value;
    const last = lineData[lineData.length - 1].value;
    dayChange = last - prev;
    dayChangePct = prev > 0 ? ((last - prev) / prev) * 100 : null;
  }

  // 進階指標：用每日淨值快照 + cashflows
  const snapshotsForMetrics = lineData.map((p) => ({
    date: p.date,
    value: p.value,
  }));
  // TWR / Sharpe 使用 TWR 慣例（正數=投入組合，負數=取出），且不含 terminal value。
  // terminal value 已體現在最後一筆 snapshot，不應再作為 cashflow 傳入。
  // 從 cfRows 直接組建，而非從已加入 terminal value 的 cashflows 組建。
  const cashflowsForMetrics = cfRows
    .filter((c) => c.cashflow_twd !== null && Number(c.cashflow_twd) !== 0)
    .map((c) => ({
      date: new Date(c.created_at).toLocaleDateString("en-CA", {
        timeZone: "Asia/Taipei",
      }),
      amount: -Number(c.cashflow_twd), // XIRR 慣例翻轉 → TWR 慣例：買入(負)→正，賣出(正)→負
    }));
  const twrShowable = snapshotsForMetrics.length >= 30;
  const twrResult = twrShowable
    ? computeTwr(snapshotsForMetrics, cashflowsForMetrics)
    : null;
  const drawdown = twrShowable ? computeMaxDrawdown(snapshotsForMetrics) : null;
  const sharpe = twrShowable
    ? computeSharpe(snapshotsForMetrics, cashflowsForMetrics, 0.015)
    : null;

  // 大盤對照：SPY/QQQ 的 USD close × 當日匯率換成 TWD 後再比較（同幣別 base）。
  // 匯率 forward-fill：取日期 d 的匯率時，若 d 無值用 <= d 的最近一筆。
  const fxSorted = [...fxHistory].sort((a, b) => a.date.localeCompare(b.date));
  function fxAt(date: string): number | null {
    let last: number | null = null;
    for (const r of fxSorted) {
      if (r.date <= date) last = r.rate;
      else break;
    }
    return last;
  }

  const perfMap = new Map<string, PerfPoint>();
  const twrIndexSeries = buildTwrSeries(
    snapshotsForMetrics,
    cashflowsForMetrics,
  );
  const twrByDate = new Map(twrIndexSeries.map((p) => [p.date, p.index]));
  for (const p of lineData) {
    const idx = twrByDate.get(p.date);
    if (idx !== undefined) {
      perfMap.set(p.date, { date: p.date, portfolio: idx });
    }
  }
  for (const r of bench.tw0050) {
    const ex = perfMap.get(r.date) ?? { date: r.date };
    ex.tw0050 = Number(r.close);
    perfMap.set(r.date, ex);
  }
  for (const r of bench.spy) {
    const fx = fxAt(r.date);
    if (fx === null) continue;
    const ex = perfMap.get(r.date) ?? { date: r.date };
    ex.spy = Number(r.close) * fx;
    perfMap.set(r.date, ex);
  }
  for (const r of bench.qqq) {
    const fx = fxAt(r.date);
    if (fx === null) continue;
    const ex = perfMap.get(r.date) ?? { date: r.date };
    ex.qqq = Number(r.close) * fx;
    perfMap.set(r.date, ex);
  }
  const perfData = [...perfMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  forwardFillBenchmarks(perfData, ["spy", "qqq", "tw0050"]);
  // benchmark 配色採設計稿（冷藍 / 紫 / 綠），與組合的金色拉開對比。
  const benchmarks: BenchSeries[] = [
    { key: "spy", label: "S&P 500", color: "#7FA8C9", dash: "6 4" },
    { key: "qqq", label: "Nasdaq 100", color: "#9C93C5", dash: "3 5" },
    { key: "tw0050", label: "台股 0050", color: "#7FBFA3", dash: "2 4" },
  ];
  const hasPerf =
    perfData.length >= 2 &&
    (bench.tw0050.length > 0 || bench.spy.length > 0 || bench.qqq.length > 0);

  // holdings：交給 client 排序 / 算佔比
  const holdings: Holding[] = list.map((a) => ({
    id: a.id,
    name: a.name,
    symbol: a.symbol,
    market: a.price_market,
    cls: a.asset_class,
    value: valueOf(a),
    cost: Number(a.cost_basis_twd ?? 0),
    realized: Number(a.realized_pnl_twd ?? 0),
    day: accountDay.get(a.id) ?? null,
    status: a.status,
  }));

  return {
    summary: {
      total,
      totalCost,
      unrealized: totalUnrealized,
      unrealizedPct: totalPnlPct,
      totalRealized,
      xirr,
      xirrShowable,
      dayChange,
      dayChangePct,
      accounts: list.length,
      lastUpdate: latestUpdate ?? null,
      twrCum: twrResult?.total ?? null,
      twrAnn: twrResult?.annualized ?? null,
      maxDrawdown: drawdown?.pct ?? null,
      ddPeak: drawdown?.peakDate ?? null,
      ddTrough: drawdown?.troughDate ?? null,
      sharpe,
      twrShowable,
      hasIncome,
      incomeYtd,
      income12m: incomeRolling12m,
      monthlyAvg: monthlyAvg12m,
      yieldOnCost,
      dividendAll,
      interestAll,
    },
    series: lineData,
    perf: perfData,
    benchmarks,
    hasPerf,
    allocation,
    allocTargets,
    holdings,
    marketLabel: MARKET_LABEL,
    today: input.today ?? todayTaipei(),
    archivedCount,
    showArchived,
  };
}
