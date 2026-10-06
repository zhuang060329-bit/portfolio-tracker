import type { DashboardInputs, AccountRow } from "@/lib/dashboard-data";
import type { ReplaySnapshot, ReplayTransaction } from "@/lib/history-replay";

export const DEMO_EPOCH = "2025-01-01";
const EPOCH = DEMO_EPOCH;

function hashStr(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result =
      (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(key: string): number {
  const random = mulberry32(hashStr(key));
  const u1 = Math.max(random(), 1e-12);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function* eachDay(from: string, to: string): Generator<string> {
  const date = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (date <= end) {
    yield date.toISOString().slice(0, 10);
    date.setUTCDate(date.getUTCDate() + 1);
  }
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

type PathSpec = {
  base: number;
  mu: number;
  sigma: number;
  trades247: boolean;
};

const PATHS: Record<string, PathSpec> = {
  VOO: { base: 520, mu: 0.00032, sigma: 0.009, trades247: false },
  "0050": { base: 195, mu: 0.00026, sigma: 0.01, trades247: false },
  BTC: { base: 96000, mu: 0.00055, sigma: 0.032, trades247: true },
  USDTWD: { base: 32.1, mu: 0, sigma: 0.0015, trades247: false },
  SPY: { base: 610, mu: 0.0003, sigma: 0.0088, trades247: false },
  QQQ: { base: 540, mu: 0.0004, sigma: 0.012, trades247: false },
};

const BEAR = { from: "2026-02-02", to: "2026-03-13", mu: -0.0025 };

function buildPriceSeries(
  symbol: string,
  endDate: string,
): Map<string, number> {
  const spec = PATHS[symbol];
  const output = new Map<string, number>();
  let logPrice = Math.log(spec.base);

  for (const date of eachDay(EPOCH, endDate)) {
    if (spec.trades247 || !isWeekend(date)) {
      const inBear =
        symbol !== "USDTWD" && date >= BEAR.from && date <= BEAR.to;
      const drift = inBear ? BEAR.mu : spec.mu;
      logPrice += drift + spec.sigma * gauss(`${symbol}:${date}`);
    }
    output.set(date, Math.exp(logPrice));
  }
  return output;
}

type Ledger = {
  qty: number;
  cost: number;
  costNative: number;
  realized: number;
};

type LedgerKey = "voo" | "tw0050" | "btc";

const LEDGER_ACCOUNT: Record<LedgerKey, string> = {
  voo: "demo-voo",
  tw0050: "demo-0050",
  btc: "demo-btc",
};

/** 證券帳戶在首筆買進那天建立；現金與黃金在 EPOCH 建立。 */
export const DEMO_SECURITIES_OPENED_AT = "2025-01-06T09:30:00+08:00";
export const DEMO_MANUAL_OPENED_AT = `${EPOCH}T09:00:00+08:00`;

export const DEMO_ALLOCATION_TARGETS: Record<string, number> = {
  fund: 40,
  stock: 20,
  crypto: 15,
  liquid_cash: 20,
  precious_metal: 5,
};

/* 單一持倉的集中度上限（%）。情境頁的買前檢核與月報的風險註記共用，兩頁門檻才不會各說各話。 */
export const DEMO_CONCENTRATION_LIMIT_PCT = 35;

export type DemoSimulation = {
  price: {
    VOO: Map<string, number>;
    "0050": Map<string, number>;
    BTC: Map<string, number>;
    fx: Map<string, number>;
  };
  ledgers: Record<LedgerKey, Ledger>;
  cashAt: (date: string) => number;
  goldAt: (date: string) => number;
  cfRows: DashboardInputs["cfRows"];
  incomeRows: DashboardInputs["incomeRows"];
  snapRows: DashboardInputs["snapRows"];
  /** 與 cfRows 同一份現金流，帶上帳戶與交易型別，給歷史回放與月報用 */
  transactions: ReplayTransaction[];
  /** 每個帳戶自建立日起的每日快照，估值與 snapRows 相同 */
  snapshots: ReplaySnapshot[];
};

/**
 * 總覽頁與 Demo 子頁共用的模擬。總覽只取 cfRows / snapRows，
 * 子頁取 transactions / snapshots，兩邊的金額出自同一本帳。
 */
export function simulateDemo(today: string): DemoSimulation {
  const price = {
    VOO: buildPriceSeries("VOO", today),
    "0050": buildPriceSeries("0050", today),
    BTC: buildPriceSeries("BTC", today),
    fx: buildPriceSeries("USDTWD", today),
  };

  const cfRows: DashboardInputs["cfRows"] = [];
  const incomeRows: DashboardInputs["incomeRows"] = [];
  const snapRows: DashboardInputs["snapRows"] = [];
  const transactions: ReplayTransaction[] = [];
  const snapshots: ReplaySnapshot[] = [];
  const ledgers: Record<LedgerKey, Ledger> = {
    voo: { qty: 0, cost: 0, costNative: 0, realized: 0 },
    tw0050: { qty: 0, cost: 0, costNative: 0, realized: 0 },
    btc: { qty: 0, cost: 0, costNative: 0, realized: 0 },
  };

  const nativePrice = (account: LedgerKey, date: string): number => {
    if (account === "voo") return price.VOO.get(date)!;
    if (account === "btc") return price.BTC.get(date)!;
    return price["0050"].get(date)!;
  };
  const fxOf = (account: LedgerKey, date: string): number =>
    account === "tw0050" ? 1 : price.fx.get(date)!;
  const unitTwd = (account: LedgerKey, date: string): number =>
    nativePrice(account, date) * fxOf(account, date);

  const record = (
    accountId: string,
    type: string,
    createdAt: string,
    cashflowTwd: number,
    realizedPnlTwd: number | null = null,
  ) => {
    cfRows.push({ created_at: createdAt, cashflow_twd: cashflowTwd });
    transactions.push({ accountId, type, cashflowTwd, realizedPnlTwd, createdAt });
  };

  const buy = (account: LedgerKey, date: string, amountTwd: number) => {
    const ledger = ledgers[account];
    const type = ledger.qty === 0 ? "create" : "adjust_quantity";
    ledger.qty += amountTwd / unitTwd(account, date);
    ledger.cost += amountTwd;
    ledger.costNative += amountTwd / fxOf(account, date);
    record(LEDGER_ACCOUNT[account], type, `${date}T09:30:00+08:00`, -amountTwd);
  };

  const sell = (account: LedgerKey, date: string, amountTwd: number) => {
    const ledger = ledgers[account];
    const quantity = amountTwd / unitTwd(account, date);
    const averageCost = ledger.cost / ledger.qty;
    const averageCostNative = ledger.costNative / ledger.qty;
    const realized = amountTwd - averageCost * quantity;
    ledger.realized += realized;
    ledger.cost -= averageCost * quantity;
    ledger.costNative -= averageCostNative * quantity;
    ledger.qty -= quantity;
    record(LEDGER_ACCOUNT[account], "sell", `${date}T10:00:00+08:00`, amountTwd, realized);
  };

  const cashAt = (date: string): number =>
    date >= "2026-03-01" ? 265_000 : date >= "2025-08-01" ? 230_000 : 190_000;
  const goldAt = (date: string): number => {
    // 建立當天的估值要等於建立時記的投入 58,000，否則月報 2025-01 會多出一筆未解釋差額
    if (date === EPOCH) return 58_000;
    const days =
      (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) /
        86_400_000 +
      1;
    return Math.round(
      58_000 * (1 + 0.00035 * days) + 900 * gauss(`GOLD:${date}`),
    );
  };

  const income = (
    accountId: string,
    date: string,
    type: "dividend" | "interest",
    amount: number,
  ) => {
    const createdAt = `${date}T12:00:00+08:00`;
    record(accountId, type, createdAt, amount, amount);
    incomeRows.push({ created_at: createdAt, cashflow_twd: amount, type });
  };

  for (const date of eachDay(EPOCH, today)) {
    const [, month, day] = date.split("-");
    if (date === "2025-01-06") {
      buy("voo", date, 150_000);
      buy("tw0050", date, 100_000);
      buy("btc", date, 60_000);
    }

    // 手動資產的投入需進 XIRR；首日現金流視為 TWR 期初資本。
    if (date === EPOCH) {
      record("demo-cash", "create", DEMO_MANUAL_OPENED_AT, -190_000);
      record("demo-gold", "create", DEMO_MANUAL_OPENED_AT, -58_000);
    }
    if (date === "2025-08-01" || date === "2026-03-01") {
      record(
        "demo-cash",
        "adjust_balance",
        `${date}T09:00:00+08:00`,
        date === "2025-08-01" ? -40_000 : -35_000,
      );
    }
    if (day === "05" && date > "2025-01-06") {
      buy("voo", date, 12_000);
      buy("tw0050", date, 8_000);
      buy("btc", date, 5_000);
    }
    if (date === "2025-10-16") sell("tw0050", date, 30_000);
    if (day === "20" && (month === "01" || month === "07") && date > "2025-01-20") {
      income(
        "demo-0050",
        date,
        "dividend",
        Math.round(ledgers.tw0050.qty * unitTwd("tw0050", date) * 0.015),
      );
    }
    if (day === "25" && ["03", "06", "09", "12"].includes(month)) {
      income(
        "demo-voo",
        date,
        "dividend",
        Math.round(ledgers.voo.qty * unitTwd("voo", date) * 0.003),
      );
    }
    if (day === "28" && ["03", "06", "09", "12"].includes(month)) {
      income("demo-cash", date, "interest", 780);
    }

    snapRows.push(
      {
        account_id: "demo-voo",
        snapshot_date: date,
        value_base: ledgers.voo.qty * unitTwd("voo", date),
      },
      {
        account_id: "demo-0050",
        snapshot_date: date,
        value_base: ledgers.tw0050.qty * unitTwd("tw0050", date),
      },
      {
        account_id: "demo-btc",
        snapshot_date: date,
        value_base: ledgers.btc.qty * unitTwd("btc", date),
      },
      {
        account_id: "demo-cash",
        snapshot_date: date,
        value_base: cashAt(date),
      },
      {
        account_id: "demo-gold",
        snapshot_date: date,
        value_base: goldAt(date),
      },
    );

    if (date >= DEMO_SECURITIES_OPENED_AT.slice(0, 10)) {
      for (const account of ["voo", "tw0050", "btc"] as const) {
        const ledger = ledgers[account];
        snapshots.push({
          accountId: LEDGER_ACCOUNT[account],
          date,
          quantity: ledger.qty,
          unitPrice: nativePrice(account, date),
          fxRate: fxOf(account, date),
          valueBase: ledger.qty * unitTwd(account, date),
          costBasisTwd: ledger.cost,
          costBasisNative: ledger.costNative,
          realizedPnlTwd: ledger.realized,
          accountStatus: "active",
        });
      }
    }
    // 活存以「餘額 × 1」記，增減是投入而不是價格變動；黃金以 1 單位 × 估值記，估值變動算價格效果。
    snapshots.push(
      {
        accountId: "demo-cash",
        date,
        quantity: cashAt(date),
        unitPrice: 1,
        fxRate: 1,
        valueBase: cashAt(date),
        costBasisTwd: cashAt(date),
        costBasisNative: cashAt(date),
        realizedPnlTwd: 0,
        accountStatus: "active",
      },
      {
        accountId: "demo-gold",
        date,
        quantity: 1,
        unitPrice: goldAt(date),
        fxRate: 1,
        valueBase: goldAt(date),
        costBasisTwd: 58_000,
        costBasisNative: 58_000,
        realizedPnlTwd: 0,
        accountStatus: "active",
      },
    );
  }

  return {
    price,
    ledgers,
    cashAt,
    goldAt,
    cfRows,
    incomeRows,
    snapRows,
    transactions,
    snapshots,
  };
}

export function buildDemoInputs(today: string): DashboardInputs {
  const { price, ledgers, cashAt, goldAt, cfRows, incomeRows, snapRows } =
    simulateDemo(today);

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

  const bench = {
    tw0050: [] as { date: string; close: number }[],
    spy: [] as { date: string; close: number }[],
    qqq: [] as { date: string; close: number }[],
    btc: [] as { date: string; close: number }[],
  };
  const fxHistory: { date: string; rate: number }[] = [];
  const spySeries = buildPriceSeries("SPY", today);
  const qqqSeries = buildPriceSeries("QQQ", today);
  for (const date of eachDay(EPOCH, today)) {
    bench.btc.push({
      date,
      close: price.BTC.get(date)! * price.fx.get(date)!,
    });
    if (isWeekend(date)) continue;
    bench.tw0050.push({ date, close: price["0050"].get(date)! });
    bench.spy.push({ date, close: spySeries.get(date)! });
    bench.qqq.push({ date, close: qqqSeries.get(date)! });
    fxHistory.push({ date, rate: price.fx.get(date)! });
  }

  return {
    accounts,
    includeArchivedHoldings: false,
    cfRows,
    incomeRows,
    allocationTargets: { ...DEMO_ALLOCATION_TARGETS },
    snapRows,
    bench,
    fxHistory,
    today,
  };
}
