import { describe, expect, it } from "vitest";
import { buildMonthlyReport, getMonthBounds } from "./monthly-report";
import type { ReplayAccount, ReplaySnapshot } from "./history-replay";

describe("getMonthBounds", () => {
  it("正確處理一般月份的月初、月底與期初日", () => {
    expect(getMonthBounds("2026-07")).toEqual({
      month: "2026-07",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      openingDate: "2026-06-30",
    });
  });

  it("正確處理閏年二月", () => {
    expect(getMonthBounds("2024-02")?.endDate).toBe("2024-02-29");
    expect(getMonthBounds("2023-02")?.endDate).toBe("2023-02-28");
  });

  it("拒絕無效月份", () => {
    expect(getMonthBounds("2026-13")).toBeNull();
    expect(getMonthBounds("July")).toBeNull();
  });
});

describe("buildMonthlyReport", () => {
  it("沿用 TWD 現金流符號，投入不會被算成報酬", () => {
    const accounts: ReplayAccount[] = [
      {
        id: "a",
        name: "測試帳戶",
        assetClass: "stock",
        symbol: "AAA",
        priceMarket: "tw",
        createdAt: "2026-06-01T00:00:00+08:00",
      },
    ];
    const snapshots: ReplaySnapshot[] = [
      {
        accountId: "a",
        date: "2026-06-30",
        quantity: 10,
        unitPrice: 100,
        fxRate: 1,
        valueBase: 1000,
        costBasisTwd: 1000,
        costBasisNative: 1000,
        realizedPnlTwd: 0,
        accountStatus: "active",
      },
      {
        accountId: "a",
        date: "2026-07-15",
        quantity: 15,
        unitPrice: 100,
        fxRate: 1,
        valueBase: 1500,
        costBasisTwd: 1500,
        costBasisNative: 1500,
        realizedPnlTwd: 0,
        accountStatus: "active",
      },
      {
        accountId: "a",
        date: "2026-07-31",
        quantity: 15,
        unitPrice: 110,
        fxRate: 1,
        valueBase: 1650,
        costBasisTwd: 1500,
        costBasisNative: 1500,
        realizedPnlTwd: 0,
        accountStatus: "active",
      },
    ];
    const report = buildMonthlyReport({
      bounds: getMonthBounds("2026-07")!,
      accounts,
      snapshots,
      statusEvents: [],
      transactions: [
        {
          accountId: "a",
          type: "adjust_quantity",
          cashflowTwd: -500,
          realizedPnlTwd: null,
          createdAt: "2026-07-15T10:00:00+08:00",
        },
      ],
    });
    expect(report.netContributionTwd).toBe(500);
    expect(report.attribution.marketPriceEffectTwd).toBe(150);
    expect(report.attribution.residualTwd).toBe(0);
    expect(report.twr).toBeCloseTo(0.1, 8);
  });
});
