import { describe, expect, it } from "vitest";
import {
  fmtAxisValue,
  labelCapacity,
  niceTicks,
  pickTickIndices,
} from "./chart-scale";

/** 刻度間距是否處處相等——nice number 的整個重點。 */
function steps(ticks: number[]): number[] {
  return ticks.slice(1).map((v, i) => Number((v - ticks[i]).toFixed(10)));
}

describe("niceTicks", () => {
  it("刻度落在 1/2/5 × 10ⁿ 的倍數上", () => {
    const { ticks } = niceTicks(923_000, 1_247_000);
    const step = steps(ticks)[0];
    const mantissa = step / 10 ** Math.floor(Math.log10(step));
    expect([1, 2, 5, 10]).toContain(Math.round(mantissa));
    for (const tick of ticks) expect(tick % step).toBeCloseTo(0, 6);
  });

  it("刻度等距", () => {
    const { ticks } = niceTicks(923_000, 1_247_000);
    expect(new Set(steps(ticks)).size).toBe(1);
  });

  it("值域完整包住資料，且首尾刻度就是值域端點", () => {
    const { lo, hi, ticks } = niceTicks(923_000, 1_247_000);
    expect(lo).toBeLessThanOrEqual(923_000);
    expect(hi).toBeGreaterThanOrEqual(1_247_000);
    expect(ticks[0]).toBe(lo);
    expect(ticks[ticks.length - 1]).toBe(hi);
  });

  it("實際案例的刻度是整數萬，不是原本的 92.3萬/100.4萬", () => {
    // 截圖上那組資料：最低約 92.3 萬、最高約 124.7 萬。
    const { ticks } = niceTicks(923_000, 1_247_000);
    expect(ticks.map(fmtAxisValue)).toEqual([
      "90萬",
      "100萬",
      "110萬",
      "120萬",
      "130萬",
    ]);
  });

  it("刻度數量接近要求值", () => {
    const { ticks } = niceTicks(0, 97, 5);
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    expect(ticks.length).toBeLessThanOrEqual(7);
  });

  it("大盤對照的百分比刻度（起點 100）也是整數", () => {
    const { ticks } = niceTicks(88.4, 131.6);
    expect(new Set(steps(ticks)).size).toBe(1);
    expect(ticks.every((t) => Number.isInteger(t))).toBe(true);
  });

  it("全平的序列不會除以零", () => {
    const { lo, hi, ticks } = niceTicks(500_000, 500_000);
    expect(lo).toBeLessThan(500_000);
    expect(hi).toBeGreaterThan(500_000);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.every(Number.isFinite)).toBe(true);
  });

  it("值為零的全平序列也不會爆", () => {
    const { ticks } = niceTicks(0, 0);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.every(Number.isFinite)).toBe(true);
  });

  it("min/max 顛倒時自動對調", () => {
    expect(niceTicks(1_247_000, 923_000)).toEqual(niceTicks(923_000, 1_247_000));
  });

  it("非有限值回傳可用的預設值域而不是 NaN", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const { lo, hi, ticks } = niceTicks(bad, 100);
      expect(Number.isFinite(lo)).toBe(true);
      expect(Number.isFinite(hi)).toBe(true);
      expect(ticks.every(Number.isFinite)).toBe(true);
    }
  });

  it("小數級距不會長出浮點雜訊", () => {
    const { ticks } = niceTicks(0.1, 0.9);
    for (const tick of ticks) {
      expect(String(tick).replace("-", "").length).toBeLessThanOrEqual(4);
    }
  });

  it("負值區間（例如回撤）也能處理", () => {
    const { lo, hi, ticks } = niceTicks(-0.32, 0);
    expect(lo).toBeLessThanOrEqual(-0.32);
    expect(hi).toBeGreaterThanOrEqual(0);
    expect(new Set(steps(ticks)).size).toBe(1);
  });
});

describe("pickTickIndices", () => {
  it("頭尾一定入選", () => {
    const picked = pickTickIndices(180, 5);
    expect(picked[0]).toBe(0);
    expect(picked[picked.length - 1]).toBe(179);
  });

  it("中間平均分佈", () => {
    expect(pickTickIndices(101, 5)).toEqual([0, 25, 50, 75, 100]);
  });

  it("資料點比標籤少時不會重複同一個索引", () => {
    const picked = pickTickIndices(3, 7);
    expect(picked).toEqual([0, 1, 2]);
    expect(new Set(picked).size).toBe(picked.length);
  });

  it("只有一個點就只標一個", () => {
    expect(pickTickIndices(1, 5)).toEqual([0]);
  });

  it("沒有資料就不標", () => {
    expect(pickTickIndices(0, 5)).toEqual([]);
  });

  it("至少兩個標籤（頭尾），不會退化成一個", () => {
    expect(pickTickIndices(50, 1)).toEqual([0, 49]);
  });
});

describe("labelCapacity", () => {
  it("390px 手機的繪圖區（約 290px）仍給得出三個日期", () => {
    expect(labelCapacity(290)).toBe(3);
  });

  it("再窄也保底兩個（頭尾）", () => {
    expect(labelCapacity(100)).toBe(2);
    expect(labelCapacity(0)).toBe(2);
  });

  it("寬螢幕有上限，不讓軸變成日期帶", () => {
    expect(labelCapacity(700)).toBe(7);
    expect(labelCapacity(2000)).toBe(7);
  });
});

describe("fmtAxisValue", () => {
  it("整數萬不帶多餘小數（與 fmtCompact 的差別）", () => {
    expect(fmtAxisValue(1_200_000)).toBe("120萬");
    expect(fmtAxisValue(900_000)).toBe("90萬");
  });

  it("非整數萬保留一位", () => {
    expect(fmtAxisValue(1_165_000)).toBe("116.5萬");
  });

  it("億級", () => {
    expect(fmtAxisValue(2_00_000_000)).toBe("2億");
    expect(fmtAxisValue(2_50_000_000)).toBe("2.5億");
  });

  it("千萬以上不帶小數", () => {
    expect(fmtAxisValue(30_000_000)).toBe("3,000萬");
  });

  it("萬以下", () => {
    expect(fmtAxisValue(100)).toBe("100");
    expect(fmtAxisValue(0)).toBe("0");
  });

  it("負值用減號（與全站一致，不是 hyphen）", () => {
    expect(fmtAxisValue(-1_200_000)).toBe("−120萬");
  });
});
