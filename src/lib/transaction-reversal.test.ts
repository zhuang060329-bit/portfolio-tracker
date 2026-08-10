import { describe, expect, it } from "vitest";
import { reversalMode, type ReversalTarget } from "./transaction-reversal";

function target(over: Partial<ReversalTarget> = {}): ReversalTarget {
  return {
    id: "t-1",
    type: "adjust_quantity",
    cashflow_twd: -50_000,
    isReversal: false,
    alreadyReversed: false,
    isLatest: false,
    ...over,
  };
}

describe("reversalMode", () => {
  it("最新一筆走 undo，較早的走 reverse", () => {
    expect(reversalMode(target({ isLatest: true }))).toBe("undo");
    expect(reversalMode(target({ isLatest: false }))).toBe("reverse");
  });

  it("賣出只有最新一筆能撤銷，較早的不提供沖銷", () => {
    // 賣出股數只能從賣出當下的帳戶狀態回推。
    expect(reversalMode(target({ type: "sell", isLatest: true }))).toBe("undo");
    expect(reversalMode(target({ type: "sell", isLatest: false }))).toBeNull();
  });

  it("建立帳戶與更新報價一律不提供", () => {
    for (const type of ["create", "price_update"]) {
      expect(reversalMode(target({ type, isLatest: true }))).toBeNull();
      expect(reversalMode(target({ type, isLatest: false }))).toBeNull();
    }
  });

  it("往下調整數量（cashflow 非負或缺漏）不提供", () => {
    expect(
      reversalMode(target({ cashflow_twd: 30_000, isLatest: true })),
    ).toBeNull();
    expect(reversalMode(target({ cashflow_twd: 0, isLatest: true }))).toBeNull();
    expect(
      reversalMode(target({ cashflow_twd: null, isLatest: true })),
    ).toBeNull();
  });

  it("配息、利息、修改餘額兩種模式都提供", () => {
    for (const type of ["dividend", "interest", "adjust_balance"]) {
      expect(reversalMode(target({ type, isLatest: true }))).toBe("undo");
      expect(reversalMode(target({ type, isLatest: false }))).toBe("reverse");
    }
  });

  it("沖銷紀錄本身、以及已被沖銷過的原始交易都不再提供", () => {
    expect(reversalMode(target({ isReversal: true, isLatest: true }))).toBeNull();
    expect(
      reversalMode(target({ alreadyReversed: true, isLatest: true })),
    ).toBeNull();
  });
});
