import { describe, expect, it } from "vitest";
import { calculateDecisionReviewMetrics } from "./decision-review-metrics";

describe("calculateDecisionReviewMetrics", () => {
  it("拆分標的、TWD 與匯率報酬，並計算有利／不利變動", () => {
    const result = calculateDecisionReviewMetrics({
      decisionDate: "2026-01-01",
      reviewDate: "2026-01-03",
      snapshots: [
        { date: "2026-01-01", unitPrice: 100, fxRate: 30 },
        { date: "2026-01-02", unitPrice: 90, fxRate: 31 },
        { date: "2026-01-03", unitPrice: 110, fxRate: 31 },
      ],
    });
    expect(result.assetReturnPct).toBeCloseTo(10, 8);
    expect(result.fxEffectPct).toBeCloseTo(3.333333, 5);
    expect(result.twdReturnPct).toBeCloseTo(13.666667, 5);
    expect(result.maxFavorableExcursionPct).toBeCloseTo(13.666667, 5);
    expect(result.maxAdverseExcursionPct).toBeCloseTo(-7, 8);
  });

  it("忽略檢討日之後的未來快照", () => {
    const result = calculateDecisionReviewMetrics({
      decisionDate: "2026-01-01",
      reviewDate: "2026-01-02",
      snapshots: [
        { date: "2026-01-01", unitPrice: 100, fxRate: 1 },
        { date: "2026-01-02", unitPrice: 105, fxRate: 1 },
        { date: "2026-01-10", unitPrice: 200, fxRate: 1 },
      ],
    });
    expect(result.assetReturnPct).toBeCloseTo(5, 8);
    expect(result.endSnapshotDate).toBe("2026-01-02");
  });

  it("缺少價格或匯率時回傳 null 與明確缺口", () => {
    const result = calculateDecisionReviewMetrics({
      decisionDate: "2026-01-01",
      reviewDate: "2026-01-02",
      snapshots: [
        { date: "2026-01-01", unitPrice: null, fxRate: 1 },
        { date: "2026-01-02", unitPrice: null, fxRate: 1 },
      ],
    });
    expect(result.assetReturnPct).toBeNull();
    expect(result.twdReturnPct).toBeNull();
    expect(result.gaps).toContain("價格快照不足，無法計算標的報酬");
  });
});
