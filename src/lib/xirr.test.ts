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

describe("二分法 fallback（Newton 失敗時仍求得根）", () => {
  // 下列現金流會讓 Newton-Raphson（起點 10%）發散或震盪、殘差檢核不過而回 null，
  // 但根確實存在於可表示範圍內。fallback 的二分法應夾出變號區間並求得通過殘差的根。
  // 案例與期望值取自對「純 Newton」vs「Newton+二分法」的實測比對，非推測。
  const residual = (r: number, flows: { amount: number; when: Date }[]) => {
    const t0 = flows[0].when.getTime();
    return flows.reduce(
      (s, f) =>
        s +
        f.amount /
          Math.pow(1 + r, (f.when.getTime() - t0) / (365.25 * 24 * 3600 * 1000)),
      0,
    );
  };

  it("三筆變號序列：Newton 回 null，二分法求得 ≈ -83.6%", () => {
    const flows = [
      { amount: 8346, when: new Date("2018-11-25") },
      { amount: 6013, when: new Date("2021-03-28") },
      { amount: -247, when: new Date("2023-01-07") },
    ];
    const r = computeXirr(flows);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(-0.836, 2);
    const scale = flows.reduce((s, f) => s + Math.abs(f.amount), 0);
    expect(Math.abs(residual(r!, flows))).toBeLessThanOrEqual(scale * 1e-5);
  });

  it("多筆進出混合：Newton 回 null，二分法求得 ≈ -48.9% 且殘差歸零", () => {
    const flows = [
      { amount: -876, when: new Date("2020-04-14") },
      { amount: -4116, when: new Date("2020-07-05") },
      { amount: 3423, when: new Date("2021-11-30") },
      { amount: -7877, when: new Date("2022-07-20") },
      { amount: -951, when: new Date("2024-01-25") },
      { amount: 2381, when: new Date("2024-08-12") },
    ];
    const r = computeXirr(flows);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(-0.489, 2);
    const scale = flows.reduce((s, f) => s + Math.abs(f.amount), 0);
    expect(Math.abs(residual(r!, flows))).toBeLessThanOrEqual(scale * 1e-5);
  });

  it("根落在 double 無法表示的極端處（深虧貼近 -100%）仍回 null，不硬湊", () => {
    // -100000 隔天只回收 1 元，真根 1+r ≈ 0 underflow，兩種解法都不該回垃圾值。
    const r = computeXirr([
      { amount: -100_000, when: new Date("2024-01-01") },
      { amount: 1, when: new Date("2024-01-02") },
    ]);
    expect(r).toBeNull();
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
