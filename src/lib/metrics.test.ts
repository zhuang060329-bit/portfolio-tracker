import { describe, expect, it } from "vitest";
import {
  computeMaxDrawdown,
  computeSharpe,
  computeTwr,
} from "./metrics";

describe("computeTwr", () => {
  it("不含現金流：純市場 +10% 應該回傳 10%", () => {
    const snapshots = [
      { date: "2025-01-01", value: 100 },
      { date: "2025-02-01", value: 110 },
    ];
    const r = computeTwr(snapshots, []);
    expect(r).not.toBeNull();
    expect(r!.total).toBeCloseTo(0.1, 5);
  });

  it("中途加碼不會污染 TWR", () => {
    // Day1: 100; Day2 加碼 50 後總值 160（市場漲 10%）;
    // Day3 總值 192（市場再漲 20%）
    // 兩段子報酬：(160-50)/100 = 1.1; 192/160 = 1.2
    // TWR = 1.1 * 1.2 - 1 = 0.32
    const snapshots = [
      { date: "2025-01-01", value: 100 },
      { date: "2025-01-02", value: 160 },
      { date: "2025-01-03", value: 192 },
    ];
    const cashflows = [{ date: "2025-01-02", amount: 50 }];
    const r = computeTwr(snapshots, cashflows);
    expect(r).not.toBeNull();
    expect(r!.total).toBeCloseTo(0.32, 5);
  });

  it("snapshot 不足回傳 null", () => {
    expect(computeTwr([{ date: "2025-01-01", value: 100 }], [])).toBeNull();
  });

  it("snapshot 出現 0 / 非有限值回傳 null", () => {
    const snapshots = [
      { date: "2025-01-01", value: 0 },
      { date: "2025-01-02", value: 50 },
    ];
    expect(computeTwr(snapshots, [])).toBeNull();
  });
});

describe("computeMaxDrawdown", () => {
  it("從高點跌一半再回升：MDD = -50%", () => {
    const snapshots = [
      { date: "2025-01-01", value: 100 },
      { date: "2025-02-01", value: 200 }, // peak
      { date: "2025-03-01", value: 100 }, // trough
      { date: "2025-04-01", value: 150 },
    ];
    const r = computeMaxDrawdown(snapshots);
    expect(r).not.toBeNull();
    expect(r!.pct).toBeCloseTo(-0.5, 5);
    expect(r!.peakDate).toBe("2025-02-01");
    expect(r!.troughDate).toBe("2025-03-01");
  });

  it("一路上漲沒有回撤回傳 null", () => {
    const snapshots = [
      { date: "2025-01-01", value: 100 },
      { date: "2025-02-01", value: 110 },
      { date: "2025-03-01", value: 120 },
    ];
    expect(computeMaxDrawdown(snapshots)).toBeNull();
  });
});

describe("computeSharpe", () => {
  it("樣本太少回傳 null", () => {
    const snapshots = [
      { date: "2025-01-01", value: 100 },
      { date: "2025-01-02", value: 101 },
    ];
    expect(computeSharpe(snapshots, [], 0.015)).toBeNull();
  });

  it("無波動回傳 null", () => {
    const snapshots = Array.from({ length: 10 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      value: 100,
    }));
    expect(computeSharpe(snapshots, [], 0.015)).toBeNull();
  });

  it("正常案例回傳有限 number", () => {
    const snapshots = Array.from({ length: 30 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      value: 100 * Math.pow(1.001, i) + (i % 3 === 0 ? 1 : -1),
    }));
    const s = computeSharpe(snapshots, [], 0.015);
    expect(s).not.toBeNull();
    expect(Number.isFinite(s!)).toBe(true);
  });
});
