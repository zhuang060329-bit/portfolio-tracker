import { describe, expect, it } from "vitest";
import { buildDemoInputs } from "./demo-data";
import { buildDashboardData, valueOf } from "./dashboard-data";

const TODAY = "2026-07-05";

describe("buildDemoInputs", () => {
  it("同一天兩次生成完全相同", () => {
    expect(buildDemoInputs(TODAY)).toEqual(buildDemoInputs(TODAY));
  });

  it("把 today 往後撥不改變既有序列", () => {
    const earlier = buildDemoInputs("2026-06-01");
    const later = buildDemoInputs(TODAY);
    const earlierSnapshot = earlier.snapRows.filter(
      (snapshot) => snapshot.snapshot_date === "2026-05-15",
    );
    const laterSnapshot = later.snapRows.filter(
      (snapshot) => snapshot.snapshot_date === "2026-05-15",
    );
    expect(laterSnapshot).toEqual(earlierSnapshot);
  });

  it("帳戶市值等於最後一日快照", () => {
    const input = buildDemoInputs(TODAY);
    for (const account of input.accounts) {
      const lastSnapshot = input.snapRows
        .filter((snapshot) => snapshot.account_id === account.id)
        .at(-1)!;
      expect(valueOf(account)).toBeCloseTo(lastSnapshot.value_base, 6);
    }
  });

  it("經 buildDashboardData 後指標齊全且數值合理", () => {
    const data = buildDashboardData({
      ...buildDemoInputs(TODAY),
      now: new Date(`${TODAY}T20:00:00+08:00`),
    });
    const summary = data.summary;
    expect(summary.total).toBeGreaterThan(500_000);
    expect(summary.totalCost).toBeGreaterThan(0);
    expect(summary.accounts).toBe(5);
    expect(summary.xirrShowable).toBe(true);
    expect(summary.twrShowable).toBe(true);
    expect(summary.hasIncome).toBe(true);
    expect(summary.totalRealized).not.toBe(0);
    expect(Math.abs(summary.xirr!)).toBeLessThan(1.5);
    expect(data.series.length).toBeGreaterThan(400);
    expect(data.hasPerf).toBe(true);
    expect(data.allocation.length).toBe(5);
  });

  it("顯示封存帳戶只改持倉列表，不改 active portfolio 指標", () => {
    const input = buildDemoInputs(TODAY);
    const archived = {
      ...input.accounts[0],
      id: "demo-archived",
      name: "已封存帳戶",
      status: "archived",
      quantity: input.accounts[0].quantity * 100,
      cost_basis_twd: input.accounts[0].cost_basis_twd * 100,
    };
    const accounts = [...input.accounts, archived];
    const hidden = buildDashboardData({
      ...input,
      accounts,
      includeArchivedHoldings: false,
    });
    const shown = buildDashboardData({
      ...input,
      accounts,
      includeArchivedHoldings: true,
    });

    expect(shown.summary).toEqual(hidden.summary);
    expect(shown.series).toEqual(hidden.series);
    expect(shown.perf).toEqual(hidden.perf);
    expect(shown.allocation).toEqual(hidden.allocation);
    expect(shown.allocTargets).toEqual(hidden.allocTargets);
    expect(shown.holdings).toHaveLength(hidden.holdings.length + 1);
    expect(shown.holdings.some((holding) => holding.id === archived.id)).toBe(true);
    expect(shown.archivedCount).toBe(1);
    expect(shown.summary.accounts).toBe(input.accounts.length);
  });
});
