import { describe, expect, it } from "vitest";
import {
  buildTwrSeries,
  computeMaxDrawdown,
  computeSharpe,
  computeTwr,
  forwardFillBenchmarks,
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

  it("terminal value 作為 cashflow 傳入會讓 curEx = 0 → return null（不應這樣呼叫）", () => {
    // 驗證：若誤把最後一筆 snapshot 的值當成 cashflow 傳入（正數=投入，TWR 慣例），
    // curEx = snapshot - terminal_value = 0，r = 0 → return null。
    // 正確用法：不傳 terminal value，TWR 自行從快照序列取最終值。
    const snapshots = [
      { date: "2025-01-01", value: 1000 },
      { date: "2025-02-01", value: 1100 },
    ];
    expect(computeTwr(snapshots, [{ date: "2025-02-01", amount: 1100 }])).toBeNull();
    expect(computeTwr(snapshots, [])?.total).toBeCloseTo(0.1, 5);
  });

  it("價格下跌時回傳負報酬", () => {
    const snapshots = [
      { date: "2025-01-01", value: 100 },
      { date: "2025-02-01", value: 80 },
    ];
    const r = computeTwr(snapshots, []);
    expect(r).not.toBeNull();
    expect(r!.total).toBeCloseTo(-0.2, 5);
  });

  it("snapshot 中間有入金但入金日無 snapshot，TWR = 0%（純現金流，市場零報酬）", () => {
    // Day0: 20000; Day1 入金 15000（無 snapshot）; Day2 snapshot 35000
    // curEx = 35000 - 15000 = 20000，r = 1.0 → TWR = 0
    const snapshots = [
      { date: "2026-01-01", value: 20000 },
      { date: "2026-01-03", value: 35000 },
    ];
    const cashflows = [{ date: "2026-01-02", amount: 15000 }];
    const r = computeTwr(snapshots, cashflows);
    expect(r).not.toBeNull();
    expect(r!.total).toBeCloseTo(0, 5);
  });

  it("snapshot 中間有入金且市場漲 10%，TWR = 10%", () => {
    // Day0: 20000; Day1 入金 15000（無 snapshot）; Day2 snapshot 37000
    // curEx = 37000 - 15000 = 22000，r = 22000/20000 = 1.1 → TWR = 0.1
    const snapshots = [
      { date: "2026-01-01", value: 20000 },
      { date: "2026-01-03", value: 37000 },
    ];
    const cashflows = [{ date: "2026-01-02", amount: 15000 }];
    const r = computeTwr(snapshots, cashflows);
    expect(r).not.toBeNull();
    expect(r!.total).toBeCloseTo(0.1, 5);
  });

  it("同一 interval 多筆 CF 累加後扣除", () => {
    // Day0: 10000; Day1 CF=+3000, Day2 CF=+2000（均無 snapshot）; Day3: 20000
    // curEx = 20000 - 5000 = 15000，r = 1.5 → TWR = 50%
    const snapshots = [
      { date: "2026-01-01", value: 10000 },
      { date: "2026-01-04", value: 20000 },
    ];
    const cashflows = [
      { date: "2026-01-02", amount: 3000 },
      { date: "2026-01-03", amount: 2000 },
    ];
    const r = computeTwr(snapshots, cashflows);
    expect(r).not.toBeNull();
    expect(r!.total).toBeCloseTo(0.5, 5);
  });

  it("computeTwr 與 buildTwrSeries 對相同資料回傳一致結果", () => {
    // 3 個 snapshot + 1 筆 between-snapshot CF；兩種函式應算出相同總報酬
    const snapshots = [
      { date: "2026-01-01", value: 10000 },
      { date: "2026-01-03", value: 12000 },
      { date: "2026-01-05", value: 13200 },
    ];
    const cashflows = [{ date: "2026-01-02", amount: 1000 }];
    const twr = computeTwr(snapshots, cashflows);
    const series = buildTwrSeries(snapshots, cashflows);
    expect(twr).not.toBeNull();
    // buildTwrSeries 最後一點的 index / 100 - 1 應等於 computeTwr total
    const seriesTotal = series[series.length - 1].index / 100 - 1;
    expect(twr!.total).toBeCloseTo(seriesTotal, 5);
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

describe("buildTwrSeries", () => {
  it("空快照回傳空陣列", () => {
    expect(buildTwrSeries([], [])).toEqual([]);
  });

  it("單筆快照回傳 [{ date, index: 100 }]", () => {
    const result = buildTwrSeries([{ date: "2025-01-01", value: 100 }], []);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ date: "2025-01-01", index: 100 });
  });

  it("不含現金流：市場 +10%，index 從 100 到 110", () => {
    const snapshots = [
      { date: "2025-01-01", value: 100 },
      { date: "2025-02-01", value: 110 },
    ];
    const result = buildTwrSeries(snapshots, []);
    expect(result).toHaveLength(2);
    expect(result[0].index).toBeCloseTo(100, 5);
    expect(result[1].index).toBeCloseTo(110, 5);
  });

  it("入金不膨脹指數：TWR 剔除現金流後正確反映市場報酬", () => {
    // Day1: 100; Day2 加碼 50 後總值 160（市場漲 10%）
    // Day3: 總值 192（市場漲 20%）
    // TWR: 1.1 × 1.2 = 1.32 → index: 100 → 110 → 132
    const snapshots = [
      { date: "2025-01-01", value: 100 },
      { date: "2025-01-02", value: 160 },
      { date: "2025-01-03", value: 192 },
    ];
    const cashflows = [{ date: "2025-01-02", amount: 50 }];
    const result = buildTwrSeries(snapshots, cashflows);
    expect(result).toHaveLength(3);
    expect(result[0].index).toBeCloseTo(100, 5);
    expect(result[1].index).toBeCloseTo(110, 5);
    expect(result[2].index).toBeCloseTo(132, 5);
  });

  it("prev=0 的子期間跳過，後續期間正常累乘", () => {
    // Day0: value=0（非常邊界情況）; Day1: value=50（prev=0 跳過）; Day2: value=60（60/50=1.2）
    const snapshots = [
      { date: "2025-01-01", value: 0 },
      { date: "2025-01-02", value: 50 },
      { date: "2025-01-03", value: 60 },
    ];
    const result = buildTwrSeries(snapshots, []);
    expect(result[0].index).toBeCloseTo(100, 5);
    expect(result[1].index).toBeCloseTo(100, 5); // prev=0 跳過，維持 100
    expect(result[2].index).toBeCloseTo(120, 5); // 100 × (60/50)
  });

  it("僅價格下跌時，index 下降；所有值均為有限正數（NaN / Infinity 驗證）", () => {
    // 驗證 item#3（跌幅反映）與 item#8（無 NaN/Infinity）
    const snapshots = [
      { date: "2025-01-01", value: 1000 },
      { date: "2025-01-02", value: 850 }, // -15%
      { date: "2025-01-03", value: 760 }, // -10.6% day
    ];
    const result = buildTwrSeries(snapshots, []);
    expect(result).toHaveLength(3);
    // index 需逐日下降
    expect(result[1].index).toBeLessThan(result[0].index);
    expect(result[2].index).toBeLessThan(result[1].index);
    // Day1: 850/1000 = 0.85 → index 85
    expect(result[1].index).toBeCloseTo(85, 5);
    // Day2: 760/850 × 85 ≈ 76
    expect(result[2].index).toBeCloseTo(76, 5);
    // 所有 index 為有限正數
    for (const pt of result) {
      expect(Number.isFinite(pt.index)).toBe(true);
      expect(pt.index).toBeGreaterThan(0);
    }
  });

  it("入金日沒有 snapshot 時，TWR index 不暴衝（snapshot interval cashflow sum）", () => {
    // 核心回歸：cashflow 落在兩個 snapshot 之間（無當日 snapshot）
    // Day0: 20000; Day1 入金 15000（無 snapshot）; Day2 snapshot 35000
    // 市場報酬 = 0%：curEx = 35000 - 15000 = 20000，r = 1.0 → index = 100
    const snapshots = [
      { date: "2026-01-01", value: 20000 },
      { date: "2026-01-03", value: 35000 },
    ];
    const cashflows = [{ date: "2026-01-02", amount: 15000 }];
    const result = buildTwrSeries(snapshots, cashflows);
    expect(result).toHaveLength(2);
    expect(result[0].index).toBeCloseTo(100, 5);
    expect(result[1].index).toBeCloseTo(100, 5);
  });

  it("入金日沒有 snapshot、且後續有市場漲幅，index 正確反映漲幅", () => {
    // Day0: 20000; Day1 入金 15000（無 snapshot）; Day2 snapshot 37000
    // curEx = 37000 - 15000 = 22000，r = 22000/20000 = 1.1 → index = 110
    const snapshots = [
      { date: "2026-01-01", value: 20000 },
      { date: "2026-01-03", value: 37000 },
    ];
    const cashflows = [{ date: "2026-01-02", amount: 15000 }];
    const result = buildTwrSeries(snapshots, cashflows);
    expect(result[1].index).toBeCloseTo(110, 5);
  });
});

describe("forwardFillBenchmarks", () => {
  // 測試用型別：與 PerfPoint 的 index signature 相容
  type TestPt = { [key: string]: number | string | undefined };

  it("第一個有效 benchmark 點之前不 forward-fill", () => {
    const series: TestPt[] = [
      { date: "2025-01-04" },
      { date: "2025-01-05" },
      { date: "2025-01-06", spy: 500 },
    ];
    forwardFillBenchmarks(series, ["spy"]);
    expect(series[0].spy).toBeUndefined();
    expect(series[1].spy).toBeUndefined();
    expect(series[2].spy).toBe(500);
  });

  it("第一個有效點之後，缺值日沿用上一個有效收盤價", () => {
    const series: TestPt[] = [
      { date: "2025-01-01", spy: 500 },
      { date: "2025-01-04" }, // 週末
      { date: "2025-01-05" }, // 週末
      { date: "2025-01-06", spy: 510 },
    ];
    forwardFillBenchmarks(series, ["spy"]);
    expect(series[1].spy).toBe(500);
    expect(series[2].spy).toBe(500);
    expect(series[3].spy).toBe(510);
  });

  it("不同 benchmark 欄位各自獨立 forward-fill，互不影響", () => {
    const series: TestPt[] = [
      { date: "2025-01-01", spy: 500 },
      { date: "2025-01-04" },           // spy 應 fill，qqq 還沒開始
      { date: "2025-01-06", qqq: 400 },
      { date: "2025-01-07" },           // spy 和 qqq 都應 fill
    ];
    forwardFillBenchmarks(series, ["spy", "qqq"]);
    expect(series[1].spy).toBe(500);
    expect(series[1].qqq).toBeUndefined(); // qqq 未啟動
    expect(series[2].spy).toBe(500);
    expect(series[2].qqq).toBe(400);
    expect(series[3].spy).toBe(500);
    expect(series[3].qqq).toBe(400);
  });

  it("已有值的日期更新 carry，不被舊值覆蓋", () => {
    const series: TestPt[] = [
      { date: "2025-01-01", spy: 500 },
      { date: "2025-01-02", spy: 520 }, // 新的有效值，carry 應更新
      { date: "2025-01-05" },            // 應 fill 520，不是 500
    ];
    forwardFillBenchmarks(series, ["spy"]);
    expect(series[2].spy).toBe(520);
  });

  it("forward-fill 後所有填補值均為有限正數（NaN / Infinity 驗證）", () => {
    const series: TestPt[] = [
      { date: "2025-01-01", spy: 500 },
      { date: "2025-01-02" },
      { date: "2025-01-03" },
    ];
    forwardFillBenchmarks(series, ["spy"]);
    for (const pt of series) {
      if (pt.spy !== undefined) {
        expect(Number.isFinite(pt.spy as number)).toBe(true);
        expect((pt.spy as number)).toBeGreaterThan(0);
      }
    }
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
