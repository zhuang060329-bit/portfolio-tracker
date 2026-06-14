import { describe, expect, it } from "vitest";
import { simulateBuyAndHold, calculateActualReturnPct } from "./whatif";

describe("simulateBuyAndHold", () => {
  const prices = [
    { date: "2025-01-01", close: 100 },
    { date: "2025-02-01", close: 110 },
    { date: "2025-03-01", close: 120 },
    { date: "2025-04-01", close: 130 },
  ];

  it("一次投入：1000 在 100 元買 = 10 股；最終 130 元 = 1300", () => {
    const cashflows = [{ date: "2025-01-01", amount: -1000 }];
    const r = simulateBuyAndHold(cashflows, prices);
    expect(r.invested).toBe(1000);
    expect(r.shares).toBeCloseTo(10, 5);
    expect(r.finalValue).toBeCloseTo(1300, 5);
    expect(r.returnPct).toBeCloseTo(0.3, 5);
  });

  it("多次投入分批：1000@100 + 1000@110 = 19.09 股；終值 130 × 19.09", () => {
    const cashflows = [
      { date: "2025-01-01", amount: -1000 },
      { date: "2025-02-01", amount: -1000 },
    ];
    const r = simulateBuyAndHold(cashflows, prices);
    expect(r.shares).toBeCloseTo(10 + 1000 / 110, 5);
    expect(r.invested).toBe(2000);
    expect(r.finalValue).toBeCloseTo(r.shares * 130, 5);
  });

  it("週末/假日 forward-fill：1/15 投入用 1/1 的價格", () => {
    const cashflows = [{ date: "2025-01-15", amount: -1000 }];
    const r = simulateBuyAndHold(cashflows, prices);
    // 1/15 沒報價，用 1/1 的 100
    expect(r.shares).toBeCloseTo(10, 5);
  });

  it("正現金流（拿回）會被略過，不影響股數", () => {
    const cashflows = [
      { date: "2025-01-01", amount: -1000 },
      { date: "2025-02-01", amount: 500 }, // 拿回
    ];
    const r = simulateBuyAndHold(cashflows, prices);
    expect(r.shares).toBeCloseTo(10, 5);
    expect(r.invested).toBe(1000);
  });

  it("早於最早報價的投入會被 skip", () => {
    const cashflows = [{ date: "2024-01-01", amount: -1000 }];
    const r = simulateBuyAndHold(cashflows, prices);
    expect(r.skippedCashflows).toBe(1);
    expect(r.shares).toBe(0);
    expect(r.invested).toBe(0);
  });

  it("用 latestPrice 覆蓋最終報價", () => {
    const cashflows = [{ date: "2025-01-01", amount: -1000 }];
    const r = simulateBuyAndHold(cashflows, prices, 150);
    expect(r.finalValue).toBeCloseTo(10 * 150, 5);
  });
});

describe("calculateActualReturnPct", () => {
  it("無賣出：投入 100，現值 110，報酬 = 10%", () => {
    const cashflows = [{ date: "2025-01-01", amount: -100 }];
    const r = calculateActualReturnPct({ currentValue: 110, cashflows });
    expect(r).toBeCloseTo(0.1, 5);
  });

  it("有賣出：投入 100，賣出收回 60，現值 55，報酬 = 15%", () => {
    const cashflows = [
      { date: "2025-01-01", amount: -100 },
      { date: "2025-06-01", amount: 60 }, // 賣出收回
    ];
    const r = calculateActualReturnPct({ currentValue: 55, cashflows });
    expect(r).toBeCloseTo(0.15, 5);
  });

  it("無投入（totalInvested = 0）：回傳 0，不除以零", () => {
    const cashflows = [{ date: "2025-01-01", amount: 50 }]; // 只有正現金流
    const r = calculateActualReturnPct({ currentValue: 100, cashflows });
    expect(r).toBe(0);
  });
});
