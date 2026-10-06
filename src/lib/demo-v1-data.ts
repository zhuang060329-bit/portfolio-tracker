import {
  DEMO_MANUAL_OPENED_AT,
  DEMO_SECURITIES_OPENED_AT,
  simulateDemo,
} from "./demo-data";
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

/** 與總覽頁同一組帳戶（id、名稱、類別都對得上 demo-data.ts）。 */
export const DEMO_REPLAY_ACCOUNTS: ReplayAccount[] = [
  {
    id: "demo-voo",
    name: "美股 ETF",
    assetClass: "fund",
    symbol: "VOO",
    priceMarket: "us",
    createdAt: DEMO_SECURITIES_OPENED_AT,
  },
  {
    id: "demo-0050",
    name: "台股 ETF",
    assetClass: "stock",
    symbol: "0050",
    priceMarket: "tw",
    createdAt: DEMO_SECURITIES_OPENED_AT,
  },
  {
    id: "demo-btc",
    name: "比特幣",
    assetClass: "crypto",
    symbol: "BTC",
    priceMarket: "crypto",
    createdAt: DEMO_SECURITIES_OPENED_AT,
  },
  {
    id: "demo-cash",
    name: "台幣活存",
    assetClass: "liquid_cash",
    symbol: null,
    priceMarket: "manual",
    createdAt: DEMO_MANUAL_OPENED_AT,
  },
  {
    id: "demo-gold",
    name: "黃金存摺",
    assetClass: "precious_metal",
    symbol: null,
    priceMarket: "manual",
    createdAt: DEMO_MANUAL_OPENED_AT,
  },
];

export function buildDemoV1Data(today: string): DemoV1Data {
  const bounds = getMonthBounds(today.slice(0, 7))!;
  const todayDay = Number(today.slice(8, 10));
  const dateInCurrentMonth = (preferredDay: number) =>
    `${bounds.month}-${String(Math.min(preferredDay, todayDay)).padStart(2, "0")}`;

  const { snapshots, transactions } = simulateDemo(today);
  const accounts = DEMO_REPLAY_ACCOUNTS.map((account) => ({ ...account }));
  const statusEvents: AccountStatusEvent[] = accounts.map((account) => ({
    accountId: account.id,
    status: "active",
    effectiveAt: account.createdAt,
    source: "account_create",
  }));

  const decisions: DemoDecision[] = [
    {
      id: "demo-decision-1",
      assetName: "VOO",
      decisionType: "add",
      decisionDate: dateInCurrentMonth(3),
      reviewDate: today,
      status: "open",
      thesis: "美股 ETF 低於 40% 目標配置，月投入照常買進，不另外追加單筆。",
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
      thesis: "台股 ETF 略低於 20% 目標，差距交給每月 8,000 元定期定額補，等 1 月配息後再檢討。",
      quality: null,
      reflection: null,
    },
    {
      id: "demo-decision-3",
      assetName: "BTC",
      decisionType: "avoid",
      decisionDate: shiftDate(bounds.startDate, -45),
      reviewDate: dateInCurrentMonth(2),
      status: "reviewed",
      thesis: "比特幣已高於 15% 目標配置，這一季不追加單筆，只保留每月 5,000 元。",
      quality: 3,
      reflection: "照計畫沒有追加；當初的依據是配置比例，這段期間沒有因價格改變。",
    },
  ];

  const scenarioHoldings: ScenarioHolding[] = accounts.map((account) => {
    const latest = snapshots.find(
      (candidate) => candidate.accountId === account.id && candidate.date === today,
    );
    return {
      id: account.id,
      name: account.name,
      symbol: account.symbol,
      assetClass: account.assetClass,
      market: account.priceMarket,
      // 比特幣在模擬裡以美元計價，匯率衝擊要算到它
      currency:
        account.priceMarket === "us" || account.priceMarket === "crypto" ? "USD" : "TWD",
      valueTwd: latest?.valueBase ?? 0,
    };
  });
  return { accounts, snapshots, statusEvents, transactions, decisions, scenarioHoldings };
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

/** 近 N 天（含今天）有買進的帳戶數，定義與正式版 /whatif 相同：create 或 adjust_quantity。 */
export function countRecentAdds(
  transactions: ReplayTransaction[],
  today: string,
  days = 30,
): Record<string, number> {
  const since = shiftDate(today, -days);
  const counts: Record<string, number> = {};
  for (const transaction of transactions) {
    if (transaction.type !== "create" && transaction.type !== "adjust_quantity") continue;
    if (transaction.createdAt.slice(0, 10) < since) continue;
    if (transaction.createdAt.slice(0, 10) > today) continue;
    counts[transaction.accountId] = (counts[transaction.accountId] ?? 0) + 1;
  }
  return counts;
}
