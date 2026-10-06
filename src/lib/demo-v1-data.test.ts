import { describe, expect, it } from "vitest";
import { buildDemoInputs } from "./demo-data";
import { buildDemoV1Data, countRecentAdds } from "./demo-v1-data";
import {
  attributePortfolioPeriod,
  buildScopeAdjustments,
  replayPortfolioAsOf,
} from "./history-replay";
import { buildMonthlyReport, getMonthBounds } from "./monthly-report";

describe("buildDemoV1Data", () => {
  it("相同日期產生完全相同的 Demo 資料", () => {
    expect(buildDemoV1Data("2026-07-18")).toEqual(
      buildDemoV1Data("2026-07-18"),
    );
  });

  it("不含真實格式的 UUID 或日期之後的快照", () => {
    const data = buildDemoV1Data("2026-07-18");
    expect(data.accounts.every((account) => account.id.startsWith("demo-"))).toBe(true);
    expect(data.snapshots.every((snapshot) => snapshot.date <= "2026-07-18")).toBe(true);
    expect(
      data.transactions.every((transaction) => transaction.createdAt.slice(0, 10) <= "2026-07-18"),
    ).toBe(true);
  });

  it.each(["2026-03-31", "2026-07-18", "2026-10-04"])(
    "%s 子頁的總資產與總覽頁相同",
    (today) => {
      const data = buildDemoV1Data(today);
      const overview = buildDemoInputs(today);
      const overviewTotal = overview.snapRows
        .filter((row) => row.snapshot_date === today)
        .reduce((sum, row) => sum + row.value_base, 0);
      const replay = replayPortfolioAsOf({
        targetDate: today,
        accounts: data.accounts,
        snapshots: data.snapshots,
        statusEvents: data.statusEvents,
      });
      expect(replay.totalValueTwd).toBeCloseTo(overviewTotal, 6);
      expect(replay.holdings.map((holding) => holding.accountId).sort()).toEqual(
        overview.accounts.map((account) => account.id).sort(),
      );
      const scenarioTotal = data.scenarioHoldings.reduce((sum, holding) => sum + holding.valueTwd, 0);
      expect(scenarioTotal).toBeCloseTo(overviewTotal, 6);
    },
  );

  it.each(["2025-10", "2026-03", "2026-07"])(
    "%s 整月的歸因對得上帳，沒有未解釋差額警示",
    (month) => {
      const bounds = getMonthBounds(month)!;
      const data = buildDemoV1Data(bounds.endDate);
      const opening = replayPortfolioAsOf({ targetDate: bounds.openingDate, ...data });
      const ending = replayPortfolioAsOf({ targetDate: bounds.endDate, ...data });
      const scope = buildScopeAdjustments({
        fromExclusive: bounds.openingDate,
        toInclusive: bounds.endDate,
        snapshots: data.snapshots,
        statusEvents: data.statusEvents,
      });
      const attribution = attributePortfolioPeriod({
        opening,
        ending,
        snapshots: data.snapshots,
        transactions: data.transactions,
        scopeContributionTwd: scope.contributionTwd,
        scopeWithdrawalTwd: scope.withdrawalTwd,
        scopeGaps: scope.gaps,
      });
      expect(attribution.reconciled).toBe(true);
      expect(attribution.gaps).toEqual([]);

      const report = buildMonthlyReport({ bounds, ...data });
      expect(report.xirrAnnualized).not.toBeNull();
    },
  );

  it("建立帳戶的月份沒有未解釋差額（建立當天估值等於投入）", () => {
    const bounds = getMonthBounds("2025-01")!;
    const data = buildDemoV1Data(bounds.endDate);
    const attribution = attributePortfolioPeriod({
      opening: replayPortfolioAsOf({ targetDate: bounds.openingDate, ...data }),
      ending: replayPortfolioAsOf({ targetDate: bounds.endDate, ...data }),
      snapshots: data.snapshots,
      transactions: data.transactions,
    });
    // reconciled 用 0.1% 相對容差，NT$100 也會過，所以直接檢查殘差
    expect(Math.abs(attribution.residualTwd)).toBeLessThan(0.01);
  });

  it("當月只過幾天時，月報不顯示 XIRR", () => {
    const data = buildDemoV1Data("2026-10-04");
    const bounds = { ...getMonthBounds("2026-10")!, endDate: "2026-10-04" };
    expect(buildMonthlyReport({ bounds, ...data }).xirrAnnualized).toBeNull();
  });

  it("Demo 起始日之前沒有快照，也不會丟例外", () => {
    const data = buildDemoV1Data("2024-12-31");
    expect(data.snapshots).toEqual([]);
    expect(data.scenarioHoldings.every((holding) => holding.valueTwd === 0)).toBe(true);
  });

  it("決策引用的代號都是總覽裡的持倉", () => {
    const data = buildDemoV1Data("2026-10-04");
    const symbols = new Set(data.accounts.map((account) => account.symbol));
    expect(data.decisions.every((decision) => symbols.has(decision.assetName))).toBe(true);
  });
});

describe("countRecentAdds", () => {
  it("只數近 30 天內的 create 與 adjust_quantity", () => {
    const counts = countRecentAdds(
      [
        { accountId: "a", type: "adjust_quantity", cashflowTwd: -1, realizedPnlTwd: null, createdAt: "2026-09-05T09:30:00+08:00" },
        { accountId: "a", type: "adjust_quantity", cashflowTwd: -1, realizedPnlTwd: null, createdAt: "2026-09-03T09:30:00+08:00" },
        { accountId: "b", type: "dividend", cashflowTwd: 1, realizedPnlTwd: 1, createdAt: "2026-09-25T12:00:00+08:00" },
        { accountId: "c", type: "create", cashflowTwd: -1, realizedPnlTwd: null, createdAt: "2026-10-04T09:30:00+08:00" },
      ],
      "2026-10-04",
    );
    expect(counts).toEqual({ a: 1, c: 1 });
  });
});
