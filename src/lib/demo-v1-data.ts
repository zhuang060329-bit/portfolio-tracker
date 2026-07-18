import type {
  AccountStatusEvent,
  ReplayAccount,
  ReplaySnapshot,
  ReplayTransaction,
} from "./history-replay";
import { getMonthBounds } from "./monthly-report";
import type { ScenarioHolding } from "./scenario";

export type DemoDecision = {
  id: string;
  assetName: string;
  decisionType: string;
  decisionDate: string;
  reviewDate: string;
  status: "open" | "reviewed";
  thesis: string;
  quality: number | null;
  reflection: string | null;
};

export type DemoV1Data = {
  accounts: ReplayAccount[];
  snapshots: ReplaySnapshot[];
  statusEvents: AccountStatusEvent[];
  transactions: ReplayTransaction[];
  decisions: DemoDecision[];
  scenarioHoldings: ScenarioHolding[];
};

export function buildDemoV1Data(today: string): DemoV1Data {
  const bounds = getMonthBounds(today.slice(0, 7))!;
  const opening = bounds.openingDate;
  const todayDay = Number(today.slice(8, 10));
  const dateInCurrentMonth = (preferredDay: number) =>
    `${bounds.month}-${String(Math.min(preferredDay, todayDay)).padStart(2, "0")}`;
  const mid = dateInCurrentMonth(10);
  const accounts: ReplayAccount[] = [
    {
      id: "demo-tw",
      name: "台股核心",
      assetClass: "stock",
      symbol: "0050",
      priceMarket: "tw",
      createdAt: "2025-01-02T09:00:00+08:00",
    },
    {
      id: "demo-us",
      name: "美股成長",
      assetClass: "fund",
      symbol: "QQQ",
      priceMarket: "us",
      createdAt: "2025-01-02T09:00:00+08:00",
    },
    {
      id: "demo-cash",
      name: "投資預備金",
      assetClass: "liquid_cash",
      symbol: null,
      priceMarket: "manual",
      createdAt: "2025-01-02T09:00:00+08:00",
    },
  ];
  const snapshots: ReplaySnapshot[] = [
    snapshot("demo-tw", opening, 1000, 50, 1, 50000, 48000),
    snapshot("demo-us", opening, 10, 400, 32, 128000, 115000),
    snapshot("demo-cash", opening, 1, null, 1, 200000, 200000),
    ...(mid === today
      ? []
      : [
          snapshot("demo-tw", mid, 1000, 52, 1, 52000, 48000),
          snapshot("demo-us", mid, 10, 410, 31.5, 129150, 115000),
          snapshot("demo-cash", mid, 1, null, 1, 300000, 300000),
        ]),
    snapshot("demo-tw", today, 1000, 49, 1, 49000, 48000),
    snapshot("demo-us", today, 10, 420, 31.2, 131040, 115000),
    snapshot("demo-cash", today, 1, null, 1, 300000, 300000),
  ];
  const statusEvents: AccountStatusEvent[] = accounts.map((account) => ({
    accountId: account.id,
    status: "active",
    effectiveAt: account.createdAt,
    source: "account_create",
  }));
  const transactions: ReplayTransaction[] = [
    {
      accountId: "demo-cash",
      type: "adjust_balance",
      cashflowTwd: -100000,
      realizedPnlTwd: null,
      createdAt: `${dateInCurrentMonth(5)}T10:00:00+08:00`,
    },
    {
      accountId: "demo-us",
      type: "dividend",
      cashflowTwd: 2500,
      realizedPnlTwd: 2500,
      createdAt: `${dateInCurrentMonth(12)}T10:00:00+08:00`,
    },
  ];
  const decisions: DemoDecision[] = [
    {
      id: "demo-decision-1",
      assetName: "QQQ",
      decisionType: "add",
      decisionDate: dateInCurrentMonth(3),
      reviewDate: today,
      status: "open",
      thesis: "獲利成長仍可支持長期配置，但需控制美元與科技股集中度。",
      quality: null,
      reflection: null,
    },
    {
      id: "demo-decision-2",
      assetName: "0050",
      decisionType: "hold",
      decisionDate: dateInCurrentMonth(8),
      reviewDate: shiftDate(today, 60),
      status: "open",
      thesis: "維持台股核心配置，等待企業獲利資料而非追逐短期價格。",
      quality: null,
      reflection: null,
    },
    {
      id: "demo-decision-3",
      assetName: "投資預備金",
      decisionType: "avoid",
      decisionDate: bounds.openingDate,
      reviewDate: dateInCurrentMonth(6),
      status: "reviewed",
      thesis: "保留現金直到配置偏離回到可接受區間。",
      quality: 3,
      reflection: "等待讓加碼規則保持一致，沒有因單日上漲改變計畫。",
    },
  ];
  const scenarioHoldings: ScenarioHolding[] = accounts.map((account) => {
    const latest = snapshots.find(
      (candidate) => candidate.accountId === account.id && candidate.date === today,
    )!;
    return {
      id: account.id,
      name: account.name,
      symbol: account.symbol,
      assetClass: account.assetClass,
      market: account.priceMarket,
      currency: account.priceMarket === "us" ? "USD" : "TWD",
      valueTwd: latest.valueBase,
    };
  });
  return { accounts, snapshots, statusEvents, transactions, decisions, scenarioHoldings };
}

function snapshot(
  accountId: string,
  date: string,
  quantity: number,
  unitPrice: number | null,
  fxRate: number,
  valueBase: number,
  costBasisTwd: number,
): ReplaySnapshot {
  return {
    accountId,
    date,
    quantity,
    unitPrice,
    fxRate,
    valueBase,
    costBasisTwd,
    costBasisNative: costBasisTwd / fxRate,
    realizedPnlTwd: 0,
    accountStatus: "active",
  };
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}
