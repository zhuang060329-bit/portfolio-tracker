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

describe("收斂檢核", () => {
  it("回傳非 null 時，該 rate 必須使 NPV≈0（殘值不得漏出）", () => {
    const cases: { amount: number; when: Date }[][] = [
      // 兩次變號（可能多根 / 震盪）
      [
        { amount: -100, when: new Date("2024-01-01") },
        { amount: 230, when: new Date("2024-07-01") },
        { amount: -132, when: new Date("2025-01-01") },
      ],
      // 極端負報酬：根貼近 r = -1，Newton 容易在 clamp 邊界打轉
      [
        { amount: -100_000, when: new Date("2024-01-01") },
        { amount: 1, when: new Date("2024-01-02") },
      ],
      // 巨幅震盪現金流
      [
        { amount: -1, when: new Date("2020-01-01") },
        { amount: 1_000_000, when: new Date("2020-06-01") },
        { amount: -999_999, when: new Date("2020-06-02") },
        { amount: 5, when: new Date("2026-01-01") },
      ],
    ];
    for (const flows of cases) {
      const r = computeXirr(flows);
      if (r !== null) {
        const t0 = flows[0].when.getTime();
        const npv = flows.reduce(
          (s, f) =>
            s +
            f.amount /
              Math.pow(
                1 + r,
                (f.when.getTime() - t0) / (365.25 * 24 * 3600 * 1000),
              ),
          0,
        );
        const scale = flows.reduce((s, f) => s + Math.abs(f.amount), 0);
        expect(Math.abs(npv)).toBeLessThanOrEqual(scale * 1e-5);
      }
    }
  });
});
