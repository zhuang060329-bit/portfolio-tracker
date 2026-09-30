import { describe, expect, it } from "vitest";
import { buildTotalReturnSeries } from "./total-return-series";

const closes = (series: { close: number }[]) => series.map((row) => row.close);

describe("buildTotalReturnSeries", () => {
  it("除息缺口被補平：除息日收盤 + 配息 = 前收時，含息序列是平的", () => {
    const series = buildTotalReturnSeries(
      [
        { date: "2026-01-02", close: 100 },
        { date: "2026-01-05", close: 100 },
        { date: "2026-01-06", close: 95 },
        { date: "2026-01-07", close: 95 },
      ],
      [{ date: "2026-01-06", amount: 5 }],
      [],
    );
    expect(closes(series)).toEqual([95, 95, 95, 95]);
  });

  it("分割斷層被接起來：一拆四之前的收盤乘上 0.25", () => {
    const series = buildTotalReturnSeries(
      [
        { date: "2025-06-16", close: 200 },
        { date: "2025-06-17", close: 200 },
        { date: "2025-06-18", close: 50 },
        { date: "2025-06-19", close: 51 },
      ],
      [],
      [{ date: "2025-06-18", ratio: 0.25 }],
    );
    expect(closes(series)).toEqual([50, 50, 50, 51]);
  });

  it("分割前的配息用分割前的金額與收盤算因子，不需要換算單位", () => {
    const series = buildTotalReturnSeries(
      [
        { date: "2025-01-02", close: 200 },
        { date: "2025-01-03", close: 196 }, // 除息 4
        { date: "2025-06-18", close: 49 }, // 一拆四
      ],
      [{ date: "2025-01-03", amount: 4 }],
      [{ date: "2025-06-18", ratio: 0.25 }],
    );
    // 第一列：200 × 0.25 × 196 / (196 + 4) = 49
    expect(closes(series)).toEqual([49, 49, 49]);
  });

  it("最後一列一律等於實際收盤", () => {
    const series = buildTotalReturnSeries(
      [
        { date: "2026-01-02", close: 100 },
        { date: "2026-01-05", close: 97 },
        { date: "2026-01-06", close: 112.05 },
      ],
      [{ date: "2026-01-05", amount: 3 }],
      [],
    );
    expect(series[2]).toEqual({ date: "2026-01-06", close: 112.05 });
  });

  it("事件落在非交易日時，套用到下一個交易日", () => {
    const series = buildTotalReturnSeries(
      [
        { date: "2026-01-02", close: 100 },
        { date: "2026-01-05", close: 95 },
      ],
      [{ date: "2026-01-03", amount: 5 }],
      [],
    );
    expect(closes(series)).toEqual([95, 95]);
  });

  it("事件晚於最後一列或不晚於第一列時不調整任何列", () => {
    const prices = [
      { date: "2026-01-02", close: 100 },
      { date: "2026-01-05", close: 101 },
    ];
    const series = buildTotalReturnSeries(
      prices,
      [
        { date: "2026-02-01", amount: 5 },
        { date: "2026-01-02", amount: 5 },
        { date: "2020-01-01", amount: 5 },
      ],
      [{ date: "2026-02-01", ratio: 0.25 }],
    );
    expect(series).toEqual(prices);
  });

  it("無效的配息金額與分割比例被略過", () => {
    const prices = [
      { date: "2026-01-02", close: 100 },
      { date: "2026-01-05", close: 101 },
    ];
    const series = buildTotalReturnSeries(
      prices,
      [
        { date: "2026-01-05", amount: 0 },
        { date: "2026-01-05", amount: Number.NaN },
      ],
      [
        { date: "2026-01-05", ratio: 0 },
        { date: "2026-01-05", ratio: Number.POSITIVE_INFINITY },
      ],
    );
    expect(series).toEqual(prices);
  });

  it("輸入由新到舊時先排序，且不改動傳入的陣列", () => {
    const prices = [
      { date: "2026-01-06", close: 95 },
      { date: "2026-01-02", close: 100 },
    ];
    const series = buildTotalReturnSeries(
      prices,
      [{ date: "2026-01-06", amount: 5 }],
      [],
    );
    expect(series).toEqual([
      { date: "2026-01-02", close: 95 },
      { date: "2026-01-06", close: 95 },
    ]);
    expect(prices[0].date).toBe("2026-01-06");
  });

  it("空輸入回空陣列", () => {
    expect(buildTotalReturnSeries([], [], [])).toEqual([]);
  });
});
