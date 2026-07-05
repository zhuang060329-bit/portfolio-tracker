import type { DashboardInputs, AccountRow } from "@/lib/dashboard-data";

// /demo 頁的資料生成器：輸出 DashboardInputs，走與真實頁相同的 buildDashboardData。
// 展示的是同一條計算管線（XIRR / TWR / Sharpe / 回撤 / 配置），不是寫死的漂亮數字。
//
// 確定性：所有隨機值來自 hash(symbol + date) 的偽隨機，
// 同一天永遠長一樣；隔天回訪只是序列往後多長一天，歷史不變。
// 價格路徑從固定 EPOCH 起算的幾何隨機漫步；平日才有報酬（BTC 全年無休），
// benchmark 只產生交易日 close，讓 forwardFillBenchmarks 走真實的補值路徑。

const EPOCH = "2025-01-01";

/* ---------- 確定性偽隨機 ---------- */

function hashStr(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 標準常態（Box-Muller），由 key 決定、可重現 */
function gauss(key: string): number {
  const rng = mulberry32(hashStr(key));
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/* ---------- 日期工具 ---------- */

function* eachDay(from: string, to: string): Generator<string> {
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

function isWeekend(date: string): boolean {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/* ---------- 價格路徑 ---------- */

type PathSpec = {
  base: number;
  /** 每日漂移（幾何） */
  mu: number;
  /** 每日波動 */
  sigma: number;
  /** 週末是否有報酬（BTC true，股票 / 匯率 false） */
  trades247: boolean;
};

const PATHS: Record<string, PathSpec> = {
  VOO: { base: 520, mu: 0.00032, sigma: 0.009, trades247: false },
  "0050": { base: 195, mu: 0.00026, sigma: 0.01, trades247: false },
  BTC: { base: 96000, mu: 0.00055, sigma: 0.032, trades247: true },
  USDTWD: { base: 32.1, mu: 0, sigma: 0.0015, trades247: false },
  SPY: { base: 610, mu: 0.00030, sigma: 0.0088, trades247: false },
  QQQ: { base: 540, mu: 0.00040, sigma: 0.012, trades247: false },
};

// 2026 年初插一段回檔行情：風險資產齊跌，讓最大回撤與 benchmark 對照有戲可看。
// 沒有這段的話隨機漫步太順，demo 一眼假。
const BEAR = { from: "2026-02-02", to: "2026-03-13", mu: -0.0025 };

/** symbol 在 date 的價格：EPOCH 起逐日累積對數報酬（只依賴 symbol+date，永遠可重現） */
function buildPriceSeries(
  symbol: string,
  endDate: string,
): Map<string, number> {
  const spec = PATHS[symbol];
  const out = new Map<string, number>();
  let logP = Math.log(spec.base);
  for (const d of eachDay(EPOCH, endDate)) {
    if (spec.trades247 || !isWeekend(d)) {
      const inBear =
        symbol !== "USDTWD" && d >= BEAR.from && d <= BEAR.to;
      const mu = inBear ? BEAR.mu : spec.mu;
      logP += mu + spec.sigma * gauss(`${symbol}:${d}`);
    }
    out.set(d, Math.exp(logP));
  }
  return out;
}

/* ---------- Demo 組合 ---------- */

type Ledger = {
  qty: number;
  cost: number; // 剩餘成本（移動平均法）
  realized: number;
};

export function buildDemoInputs(today: string): DashboardInputs {
  const price = {
    VOO: buildPriceSeries("VOO", today),
    "0050": buildPriceSeries("0050", today),
    BTC: buildPriceSeries("BTC", today),
    fx: buildPriceSeries("USDTWD", today),
  };

  const cfRows: DashboardInputs["cfRows"] = [];
  const incomeRows: DashboardInputs["incomeRows"] = [];
  const snapRows: DashboardInputs["snapRows"] = [];

  const ledgers: Record<string, Ledger> = {
    voo: { qty: 0, cost: 0, realized: 0 },
    tw0050: { qty: 0, cost: 0, realized: 0 },
    btc: { qty: 0, cost: 0, realized: 0 },
  };

  // TWD 單價（美元資產含當日匯率）
  const unitTwd = (acc: string, d: string): number => {
    if (acc === "voo") return price.VOO.get(d)! * price.fx.get(d)!;
    if (acc === "btc") return price.BTC.get(d)! * price.fx.get(d)!;
    return price["0050"].get(d)!;
  };

  const buy = (acc: string, d: string, amountTwd: number) => {
    const p = unitTwd(acc, d);
    ledgers[acc].qty += amountTwd / p;
    ledgers[acc].cost += amountTwd;
    cfRows.push({ created_at: `${d}T09:30:00+08:00`, cashflow_twd: -amountTwd });
  };

  const sell = (acc: string, d: string, amountTwd: number) => {
    const l = ledgers[acc];
    const p = unitTwd(acc, d);
    const qtySold = amountTwd / p;
    const avgCost = l.cost / l.qty;
    l.realized += amountTwd - avgCost * qtySold;
    l.cost -= avgCost * qtySold;
    l.qty -= qtySold;
    cfRows.push({ created_at: `${d}T10:00:00+08:00`, cashflow_twd: amountTwd });
  };

  /* 手動帳戶：現金（兩次調整）、黃金存摺（緩漲） */
  const cashAt = (d: string): number =>
    d >= "2026-03-01" ? 265_000 : d >= "2025-08-01" ? 230_000 : 190_000;
  const goldAt = (d: string): number => {
    // 緩慢上行 + 小波動
    const days =
      (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) /
        86_400_000 +
      1;
    return Math.round(58_000 * (1 + 0.00035 * days) + 900 * gauss(`GOLD:${d}`));
  };

  const income = (d: string, type: "dividend" | "interest", amt: number) => {
    const row = { created_at: `${d}T12:00:00+08:00`, cashflow_twd: amt };
    cfRows.push(row);
    incomeRows.push({ ...row, type });
  };

  /* 逐日走一遍：交易（期初單筆 + 每月 5 日定投 + 一次部分賣出示範已實現損益）
     與每日快照同一個迴圈完成，qty 隨交易累積。 */
  for (const d of eachDay(EPOCH, today)) {
    const [, m, day] = d.split("-");
    if (d === "2025-01-06") {
      buy("voo", d, 150_000);
      buy("tw0050", d, 100_000);
      buy("btc", d, 60_000);
    }
    // 手動帳戶的存入也要進現金流，否則 XIRR 的 terminal value
    // 含現金與黃金、投入卻沒有 → 報酬率灌水。
    // 期初兩筆日期 = 首筆快照日（EPOCH）：computeTwr 會略過 ≤ 首筆快照的
    // 現金流（視為期初資本），XIRR 則照算 → 兩套指標同時自洽。
    if (d === EPOCH) {
      cfRows.push(
        { created_at: `${d}T09:00:00+08:00`, cashflow_twd: -190_000 },
        { created_at: `${d}T09:00:00+08:00`, cashflow_twd: -58_000 },
      );
    }
    if (d === "2025-08-01" || d === "2026-03-01") {
      cfRows.push({
        created_at: `${d}T09:00:00+08:00`,
        cashflow_twd: d === "2025-08-01" ? -40_000 : -35_000,
      });
    }
    if (day === "05" && d > "2025-01-06") {
      buy("voo", d, 12_000);
      buy("tw0050", d, 8_000);
      buy("btc", d, 5_000);
    }
    if (d === "2025-10-16") sell("tw0050", d, 30_000);
    // 配息：0050 半年配、VOO 季配（金額掛在持倉市值上，隨部位成長）
    if (day === "20" && (m === "01" || m === "07") && d > "2025-01-20") {
      income(d, "dividend", Math.round(ledgers.tw0050.qty * unitTwd("tw0050", d) * 0.015));
    }
    if (day === "25" && ["03", "06", "09", "12"].includes(m)) {
      income(d, "dividend", Math.round(ledgers.voo.qty * unitTwd("voo", d) * 0.003));
    }
    // 活存季息
    if (day === "28" && ["03", "06", "09", "12"].includes(m)) {
      income(d, "interest", 780);
    }

    snapRows.push(
      { account_id: "demo-voo", snapshot_date: d, value_base: ledgers.voo.qty * unitTwd("voo", d) },
      { account_id: "demo-0050", snapshot_date: d, value_base: ledgers.tw0050.qty * unitTwd("tw0050", d) },
      { account_id: "demo-btc", snapshot_date: d, value_base: ledgers.btc.qty * unitTwd("btc", d) },
      { account_id: "demo-cash", snapshot_date: d, value_base: cashAt(d) },
      { account_id: "demo-gold", snapshot_date: d, value_base: goldAt(d) },
    );
  }

  const fxToday = price.fx.get(today)!;
  const pricedAt = `${today}T14:05:00+08:00`;

  const accounts: AccountRow[] = [
    {
      id: "demo-voo",
      name: "美股 ETF",
      asset_class: "fund",
      price_market: "us",
      symbol: "VOO",
      quantity: ledgers.voo.qty,
      native_currency: "USD",
      last_unit_price: price.VOO.get(today)!,
      last_fx_rate: fxToday,
      manual_value_base: null,
      last_priced_at: pricedAt,
      cost_basis_twd: ledgers.voo.cost,
      realized_pnl_twd: ledgers.voo.realized,
      status: "active",
    },
    {
      id: "demo-0050",
      name: "台股 ETF",
      asset_class: "stock",
      price_market: "tw",
      symbol: "0050",
      quantity: ledgers.tw0050.qty,
      native_currency: "TWD",
      last_unit_price: price["0050"].get(today)!,
      last_fx_rate: 1,
      manual_value_base: null,
      last_priced_at: pricedAt,
      cost_basis_twd: ledgers.tw0050.cost,
      realized_pnl_twd: ledgers.tw0050.realized,
      status: "active",
    },
    {
      id: "demo-btc",
      name: "比特幣",
      asset_class: "crypto",
      price_market: "crypto",
      symbol: "BTC",
      quantity: ledgers.btc.qty,
      native_currency: "USD",
      last_unit_price: price.BTC.get(today)!,
      last_fx_rate: fxToday,
      manual_value_base: null,
      last_priced_at: pricedAt,
      cost_basis_twd: ledgers.btc.cost,
      realized_pnl_twd: ledgers.btc.realized,
      status: "active",
    },
    {
      id: "demo-cash",
      name: "台幣活存",
      asset_class: "liquid_cash",
      price_market: "manual",
      symbol: null,
      quantity: 1,
      native_currency: "TWD",
      last_unit_price: null,
      last_fx_rate: 1,
      manual_value_base: cashAt(today),
      last_priced_at: pricedAt,
      cost_basis_twd: cashAt(today),
      realized_pnl_twd: 0,
      status: "active",
    },
    {
      id: "demo-gold",
      name: "黃金存摺",
      asset_class: "precious_metal",
      price_market: "manual",
      symbol: null,
      quantity: 1,
      native_currency: "TWD",
      last_unit_price: null,
      last_fx_rate: 1,
      manual_value_base: goldAt(today),
      last_priced_at: pricedAt,
      cost_basis_twd: 58_000,
      realized_pnl_twd: 0,
      status: "active",
    },
  ];

  /* Benchmark：只出交易日 close，SPY/QQQ 為 USD（builder 會乘匯率），
     0050 對照直接沿用持倉 0050 的價格序列（現實中就是同一檔）。 */
  const bench = {
    tw0050: [] as { date: string; close: number }[],
    spy: [] as { date: string; close: number }[],
    qqq: [] as { date: string; close: number }[],
    btc: [] as { date: string; close: number }[],
  };
  const fxHistory: { date: string; rate: number }[] = [];
  const spySeries = buildPriceSeries("SPY", today);
  const qqqSeries = buildPriceSeries("QQQ", today);
  for (const d of eachDay(EPOCH, today)) {
    // BTC 全年無休，其他只出交易日
    bench.btc.push({ date: d, close: price.BTC.get(d)! * price.fx.get(d)! });
    if (isWeekend(d)) continue;
    bench.tw0050.push({ date: d, close: price["0050"].get(d)! });
    bench.spy.push({ date: d, close: spySeries.get(d)! });
    bench.qqq.push({ date: d, close: qqqSeries.get(d)! });
    fxHistory.push({ date: d, rate: price.fx.get(d)! });
  }

  return {
    accounts,
    showArchived: false,
    cfRows,
    incomeRows,
    allocationTargets: {
      fund: 40,
      stock: 20,
      crypto: 15,
      liquid_cash: 20,
      precious_metal: 5,
    },
    snapRows,
    bench,
    fxHistory,
    today,
  };
}
