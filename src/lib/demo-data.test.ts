import { describe, expect, it } from "vitest";
import { buildDemoInputs } from "./demo-data";
import { buildDashboardData, valueOf } from "./dashboard-data";

// /demo 資料的不變量：走真實 buildDashboardData 管線後必須自洽。
const TODAY = "2026-07-05";

describe("buildDemoInputs", () => {
  it("確定性：同一天兩次生成完全相同", () => {
    expect(buildDemoInputs(TODAY)).toEqual(buildDemoInputs(TODAY));
  });

  it("歷史穩定：把 today 往後撥不改變既有序列", () => {
    const a = buildDemoInputs("2026-06-01");
    const b = buildDemoInputs(TODAY);
    const snapA = a.snapRows.filter((s) => s.snapshot_date === "2026-05-15");
    const snapB = b.snapRows.filter((s) => s.snapshot_date === "2026-05-15");
    expect(snapB).toEqual(snapA);
  });

  it("帳戶市值 = 最後一日快照（hero 總額與持倉表對得上）", () => {
    const input = buildDemoInputs(TODAY);
    for (const acc of input.accounts) {
      const lastSnap = input.snapRows
        .filter((s) => s.account_id === acc.id)
        .at(-1)!;
      expect(valueOf(acc)).toBeCloseTo(lastSnap.value_base, 6);
    }
  });

  it("經 buildDashboardData 後指標齊全且數值合理", () => {
    const data = buildDashboardData({
      ...buildDemoInputs(TODAY),
      now: new Date(`${TODAY}T20:00:00+08:00`),
    });
    const s = data.summary;
    expect(s.total).toBeGreaterThan(500_000);
    expect(s.totalCost).toBeGreaterThan(0);
    expect(s.accounts).toBe(5);
    expect(s.xirrShowable).toBe(true);
    expect(s.twrShowable).toBe(true);
    expect(s.hasIncome).toBe(true);
    expect(s.totalRealized).not.toBe(0);
    expect(Math.abs(s.xirr!)).toBeLessThan(1.5); // 年化不出現爆表值
    expect(data.series.length).toBeGreaterThan(400);
    expect(data.hasPerf).toBe(true);
    expect(data.allocation.length).toBe(5);
  });
});
