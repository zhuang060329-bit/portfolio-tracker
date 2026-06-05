import { describe, expect, it } from "vitest";
import { computeXirr } from "./xirr";

describe("computeXirr", () => {
  it("回傳 null：少於兩筆 cashflow", () => {
    expect(computeXirr([])).toBeNull();
    expect(computeXirr([{ amount: 100, when: new Date() }])).toBeNull();
  });

  it("回傳 null：全部同號（沒有正負交叉）", () => {
    expect(
      computeXirr([
        { amount: -100, when: new Date("2024-01-01") },
        { amount: -200, when: new Date("2024-06-01") },
      ]),
    ).toBeNull();
    expect(
      computeXirr([
        { amount: 100, when: new Date("2024-01-01") },
        { amount: 200, when: new Date("2024-06-01") },
      ]),
    ).toBeNull();
  });

  it("一年 -100 → +110 應該 ≈ 10%", () => {
    const r = computeXirr([
      { amount: -100, when: new Date("2024-01-01") },
      { amount: 110, when: new Date("2025-01-01") },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(0.1, 2);
  });

  it("一年 -100 → +90 應該 ≈ -10%", () => {
    const r = computeXirr([
      { amount: -100, when: new Date("2024-01-01") },
      { amount: 90, when: new Date("2025-01-01") },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(-0.1, 2);
  });

  it("DCA：每月投 1000 共 12 個月 → 1 年後變 13000 應該 ≈ +14% 左右", () => {
    const flows: { amount: number; when: Date }[] = [];
    for (let m = 0; m < 12; m++) {
      const d = new Date(2024, m, 1);
      flows.push({ amount: -1000, when: d });
    }
    flows.push({ amount: 13000, when: new Date(2025, 0, 1) });
    const r = computeXirr(flows);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.1);
    expect(r!).toBeLessThan(0.25);
  });

  it("0 金額 cashflow 會被跳過", () => {
    const r = computeXirr([
      { amount: -100, when: new Date("2024-01-01") },
      { amount: 0, when: new Date("2024-06-01") },
      { amount: 110, when: new Date("2025-01-01") },
    ]);
    expect(r).toBeCloseTo(0.1, 2);
  });
});
