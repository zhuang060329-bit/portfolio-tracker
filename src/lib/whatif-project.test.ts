import { describe, it, expect } from "vitest";
import { project, crossMonth } from "./whatif-project";

describe("project", () => {
  it("零報酬零投入時維持本金", () => {
    const pts = project({ start: 1000, monthly: 0, annualReturn: 0, years: 1 });
    expect(pts).toHaveLength(13); // m=0..12
    expect(pts[0]).toEqual({ m: 0, value: 1000, contributed: 1000 });
    expect(pts[12].value).toBe(1000);
    expect(pts[12].contributed).toBe(1000);
  });

  it("零報酬時每月投入線性累加", () => {
    const pts = project({ start: 0, monthly: 100, annualReturn: 0, years: 1 });
    expect(pts[12].value).toBeCloseTo(1200, 6);
    expect(pts[12].contributed).toBe(1200);
  });

  it("正報酬時淨值高於累積投入", () => {
    const pts = project({ start: 10000, monthly: 5000, annualReturn: 7, years: 10 });
    const last = pts[pts.length - 1];
    expect(last.value).toBeGreaterThan(last.contributed);
  });

  it("年化 12% 一年約等於本金 ×1.12（無額外投入）", () => {
    const pts = project({ start: 100, monthly: 0, annualReturn: 12, years: 1 });
    // 逐月複利：(1 + 0.12/12)^12 ≈ 1.1268
    expect(pts[12].value).toBeCloseTo(100 * Math.pow(1 + 0.01, 12), 6);
  });
});

describe("crossMonth", () => {
  it("回傳首次達標月份", () => {
    const pts = project({ start: 0, monthly: 100, annualReturn: 0, years: 1 });
    expect(crossMonth(pts, 500)).toBe(5); // 第 5 個月達 500
  });

  it("期間內未達標回傳 null", () => {
    const pts = project({ start: 0, monthly: 100, annualReturn: 0, years: 1 });
    expect(crossMonth(pts, 99999)).toBeNull();
  });
});
