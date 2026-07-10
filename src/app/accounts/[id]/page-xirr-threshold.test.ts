import { describe, expect, it } from "vitest";

function isXirrShowable(rate: number | null, spanDays: number): boolean {
  return rate !== null && spanDays >= 90;
}

describe("account XIRR display threshold", () => {
  it("九十天前不顯示年化", () => {
    expect(isXirrShowable(0.12, 89.99)).toBe(false);
  });

  it("滿九十天後顯示年化", () => {
    expect(isXirrShowable(0.12, 90)).toBe(true);
  });

  it("無解時不顯示", () => {
    expect(isXirrShowable(null, 365)).toBe(false);
  });
});
