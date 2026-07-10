import { describe, expect, it } from "vitest";
import {
  buildTwrSeries,
  computeMaxDrawdown,
  computeSharpe,
  dailyReturns,
} from "./metrics";

describe("cashflow-adjusted risk metrics", () => {
  it("純提領不形成回撤", () => {
    const snapshots = [
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-02", value: 50 },
    ];
    const cashflows = [{ date: "2026-01-02", amount: -50 }];
    const index = buildTwrSeries(snapshots, cashflows).map((point) => ({
      date: point.date,
      value: point.index,
    }));

    expect(index[1].value).toBeCloseTo(100, 8);
    expect(computeMaxDrawdown(index)).toBeNull();
  });

  it("提領後的市場損失仍形成正確回撤", () => {
    const snapshots = [
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-02", value: 45 },
    ];
    const cashflows = [{ date: "2026-01-02", amount: -50 }];
    const index = buildTwrSeries(snapshots, cashflows).map((point) => ({
      date: point.date,
      value: point.index,
    }));

    expect(index[1].value).toBeCloseTo(95, 8);
    expect(computeMaxDrawdown(index)?.pct).toBeCloseTo(-0.05, 8);
  });

  it("跨四日快照先換算成等效單日報酬", () => {
    const returns = dailyReturns(
      [
        { date: "2026-01-01", value: 100 },
        { date: "2026-01-05", value: 104.060401 },
      ],
      [],
    );

    expect(returns).toHaveLength(1);
    expect(returns[0]).toBeCloseTo(0.01, 8);
  });

  it("不規則快照間隔仍可得到有限 Sharpe", () => {
    const snapshots = [
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-03", value: 102.01 },
      { date: "2026-01-06", value: 103.04 },
      { date: "2026-01-08", value: 101.5 },
      { date: "2026-01-11", value: 104.2 },
      { date: "2026-01-13", value: 103.4 },
      { date: "2026-01-16", value: 106.8 },
    ];

    const sharpe = computeSharpe(snapshots, [], 0.015);
    expect(sharpe).not.toBeNull();
    expect(Number.isFinite(sharpe!)).toBe(true);
  });
});
