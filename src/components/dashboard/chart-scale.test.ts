import { describe, expect, it } from "vitest";
import {
  axisLabeler,
  fmtAxisValue,
  labelCapacity,
  niceTicks,
  pickTickIndices,
  tickDecimals,
} from "./chart-scale";

/** 刻度間距是否處處相等——nice number 的整個重點。 */
function steps(ticks: number[]): number[] {
  return ticks.slice(1).map((v, i) => Number((v - ticks[i]).toFixed(10)));
}

describe("niceTicks", () => {
  it("刻度落在 1/2/5 × 10^n 的倍數上", () => {
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

describe("axisLabeler：標籤位數跟著刻度間距走", () => {
  const labels = (min: number, max: number) => {
    const { ticks } = niceTicks(min, max);
    return ticks.map(axisLabeler(ticks));
  };

  it("刻度間距夠大時與 fmtAxisValue 完全相同", () => {
    const { ticks } = niceTicks(923_000, 1_247_000);
    expect(ticks.map(axisLabeler(ticks))).toEqual(ticks.map((t) => fmtAxisValue(t)));
  });

  it("億級窄區間：原本整排都是 2.5億", () => {
    expect(labels(250_000_000, 250_300_000)).toEqual([
      "2.499億",
      "2.5億",
      "2.501億",
      "2.502億",
      "2.503億",
      "2.504億",
    ]);
  });

  it("百萬級只動幾十元：原本整排都是 123.5萬", () => {
    expect(labels(1_234_567, 1_234_600)).toEqual([
      "123.456萬",
      "123.457萬",
      "123.458萬",
      "123.459萬",
      "123.46萬",
      "123.461萬",
    ]);
  });

  it("千萬以上的窄區間補小數，不再只取整", () => {
    expect(labels(30_000_000, 30_000_300)).toEqual([
      "2,999.99萬",
      "3,000萬",
      "3,000.01萬",
      "3,000.02萬",
      "3,000.03萬",
      "3,000.04萬",
    ]);
  });

  it("各量級、各寬度的區間，相鄰標籤一律不重複", () => {
    const bases = [37, 5_000, 123_456, 1_200_000, 9_876_543, 30_000_000, 250_000_000, 1_234_567_890];
    const spans = [1e-4, 1e-3, 5e-3, 0.02, 0.1, 0.5];
    for (const base of bases) {
      for (const span of spans) {
        const out = labels(base, base * (1 + span));
        expect(new Set(out).size, `${base} × ${span}: ${out.join(" / ")}`).toBe(out.length);
      }
    }
  });
});

describe("tickDecimals：大盤對照的指數軸", () => {
  it("整數刻度維持 0 位", () => {
    expect(tickDecimals(niceTicks(90, 130).ticks)).toBe(0);
  });

  it("指數只在 100 上下動零點幾時補一位，標籤不重複", () => {
    const { ticks } = niceTicks(99.6, 100.4);
    const d = tickDecimals(ticks);
    expect(d).toBe(1);
    const out = ticks.map((t) => t.toFixed(d));
    expect(new Set(out).size).toBe(out.length);
  });

  it("步距 0.1 不會因浮點誤差少算一位", () => {
    expect(tickDecimals([0, 0.1])).toBe(1);
    expect(tickDecimals([0, 0.05])).toBe(2);
    expect(tickDecimals([100])).toBe(0);
  });
});
