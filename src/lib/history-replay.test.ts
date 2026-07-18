import { describe, expect, it } from "vitest";
import {
  attributePortfolioPeriod,
  replayPortfolioAsOf,
  type AccountStatusEvent,
  type ReplayAccount,
  type ReplaySnapshot,
} from "./history-replay";

const accounts: ReplayAccount[] = [
  {
    id: "account-a",
    name: "美股",
    assetClass: "stock",
    symbol: "AAA",
    priceMarket: "us",
    createdAt: "2026-01-01T00:00:00+08:00",
  },
];

const snapshots: ReplaySnapshot[] = [
  {
    accountId: "account-a",
    date: "2026-01-01",
    quantity: 10,
    unitPrice: 100,
    fxRate: 30,
    valueBase: 30000,
    costBasisTwd: null,
    costBasisNative: null,
    realizedPnlTwd: null,
    accountStatus: null,
  },
  {
    accountId: "account-a",
    date: "2026-01-03",
    quantity: 10,
    unitPrice: 110,
    fxRate: 31,
    valueBase: 34100,
    costBasisTwd: 30000,
    costBasisNative: 1000,
    realizedPnlTwd: 0,
    accountStatus: "active",
  },
];

describe("replayPortfolioAsOf", () => {
  it("只使用目標日以前最新快照，且不以今天價格補值", () => {
    const replay = replayPortfolioAsOf({
      targetDate: "2026-01-02",
      accounts,
      snapshots,
      statusEvents: [],
    });
    expect(replay.totalValueTwd).toBe(30000);
    expect(replay.holdings[0].snapshotDate).toBe("2026-01-01");
    expect(replay.holdings[0].carriedForward).toBe(true);
    expect(replay.gaps).toContain("美股 的歷史成本未知");
  });

  it("依精確狀態事件排除封存後帳戶，封存前仍保留", () => {
    const statusEvents: AccountStatusEvent[] = [
      {
        accountId: "account-a",
        status: "active",
        effectiveAt: "2026-01-01T08:00:00+08:00",
        source: "account_create",
      },
      {
        accountId: "account-a",
        status: "archived",
        effectiveAt: "2026-01-03T08:00:00+08:00",
        source: "account_update",
      },
    ];
    const before = replayPortfolioAsOf({
      targetDate: "2026-01-02",
      accounts,
      snapshots,
      statusEvents,
    });
    const after = replayPortfolioAsOf({
      targetDate: "2026-01-03",
      accounts,
      snapshots: snapshots.map((snapshot) => ({ ...snapshot, accountStatus: null })),
      statusEvents,
    });
    expect(before.holdings).toHaveLength(1);
    expect(after.holdings).toHaveLength(0);
  });

  it("建立日前不顯示帳戶", () => {
    const replay = replayPortfolioAsOf({
      targetDate: "2025-12-31",
      accounts,
      snapshots,
      statusEvents: [],
    });
    expect(replay.holdings).toHaveLength(0);
    expect(replay.gaps).toHaveLength(0);
  });
});

describe("attributePortfolioPeriod", () => {
  it("拆出價格、匯率並以相對容差完成對帳", () => {
    const opening = replayPortfolioAsOf({
      targetDate: "2026-01-01",
      accounts,
      snapshots,
      statusEvents: [],
    });
    const ending = replayPortfolioAsOf({
      targetDate: "2026-01-03",
      accounts,
      snapshots,
      statusEvents: [],
    });
    const result = attributePortfolioPeriod({
      opening,
      ending,
      snapshots,
      transactions: [],
    });
    expect(result.marketPriceEffectTwd).toBe(3000);
    expect(result.fxEffectTwd).toBe(1100);
    expect(result.residualTwd).toBeCloseTo(0, 8);
    expect(result.reconciled).toBe(true);
    expect(result.toleranceTwd).toBeCloseTo(68.2, 8);
  });

  it("股息同時列為收入與現金提領，避免重複增加期末持倉", () => {
    const opening = replayPortfolioAsOf({
      targetDate: "2026-01-01",
      accounts,
      snapshots: [snapshots[0]],
      statusEvents: [],
    });
    const ending = replayPortfolioAsOf({
      targetDate: "2026-01-02",
      accounts,
      snapshots: [snapshots[0]],
      statusEvents: [],
    });
    const result = attributePortfolioPeriod({
      opening,
      ending,
      snapshots: [snapshots[0]],
      transactions: [
        {
          accountId: "account-a",
          type: "dividend",
          cashflowTwd: 500,
          realizedPnlTwd: 500,
          createdAt: "2026-01-02T10:00:00+08:00",
        },
      ],
    });
    expect(result.incomeTwd).toBe(500);
    expect(result.withdrawalsTwd).toBe(500);
    expect(result.residualTwd).toBe(0);
    expect(result.realizedPnlMemoTwd).toBe(500);
  });

  it("以現金流解釋加碼後的數量增加，不把新買股數算成市價效果", () => {
    const buySnapshots: ReplaySnapshot[] = [
      { ...snapshots[0], valueBase: 30000 },
      {
        ...snapshots[0],
        date: "2026-01-02",
        quantity: 15,
        valueBase: 45000,
        accountStatus: "active",
      },
    ];
    const opening = replayPortfolioAsOf({
      targetDate: "2026-01-01",
      accounts,
      snapshots: buySnapshots,
      statusEvents: [],
    });
    const ending = replayPortfolioAsOf({
      targetDate: "2026-01-02",
      accounts,
      snapshots: buySnapshots,
      statusEvents: [],
    });
    const result = attributePortfolioPeriod({
      opening,
      ending,
      snapshots: buySnapshots,
      transactions: [
        {
          accountId: "account-a",
          type: "adjust_quantity",
          cashflowTwd: -15000,
          realizedPnlTwd: null,
          createdAt: "2026-01-02T10:00:00+08:00",
        },
      ],
    });
    expect(result.contributionsTwd).toBe(15000);
    expect(result.marketPriceEffectTwd).toBe(0);
    expect(result.fxEffectTwd).toBe(0);
    expect(result.residualTwd).toBe(0);
  });

  it("容差隨對帳規模變動，不使用固定 TWD 門檻", () => {
    const opening = { targetDate: "2026-01-01", totalValueTwd: 10, totalCostBasisTwd: 10, holdings: [], gaps: [] };
    const ending = { ...opening, targetDate: "2026-01-02", totalValueTwd: 10.01 };
    const result = attributePortfolioPeriod({ opening, ending, snapshots: [], transactions: [] });
    expect(result.toleranceTwd).toBeCloseTo(0.02001, 8);
    expect(result.reconciled).toBe(true);
  });
});
