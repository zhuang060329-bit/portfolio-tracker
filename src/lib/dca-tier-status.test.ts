import { describe, expect, it } from "vitest";
import {
  DEFAULT_DCA_TIER_CONFIG,
  type DcaTierConfig,
} from "./dca-tiers";
import {
  buildDcaTierStatus,
  dcaTierFetchErrorMessage,
  dcaTierLabel,
} from "./dca-tier-status";
import { buildTotalReturnSeries } from "./total-return-series";
import {
  parseFinmindDividends,
  parseFinmindPrices,
  parseFinmindSplits,
} from "./prices/finmind-total-return";
import fixture from "./__fixtures__/finmind-0050.json";

const short: DcaTierConfig = { ...DEFAULT_DCA_TIER_CONFIG, maLength: 5 };

const series = (closes: number[]) =>
  closes.map((close, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    close,
  }));

describe("dcaTierLabel：文字照 Pine Script", () => {
  const config = DEFAULT_DCA_TIER_CONFIG;
  const drawdown = (pct: number, multiplier: number) =>
    dcaTierLabel({ kind: "drawdown", pct, multiplier }, config);
  const premium = (pct: number, multiplier: number) =>
    dcaTierLabel({ kind: "premium", pct, multiplier }, config);

  it("回撤四級", () => {
    expect(drawdown(-10, 1.25)).toBe("回撤 10~20%");
    expect(drawdown(-20, 1.5)).toBe("回撤 20~30%");
    expect(drawdown(-30, 1.75)).toBe("回撤 30~45%");
    expect(drawdown(-45, 2)).toBe("回撤 ≥45%");
  });

  it("高於均線兩級", () => {
    expect(premium(10, 0.9)).toBe("高於均線 10~20%");
    expect(premium(20, 0.8)).toBe("高於均線 ≥20%");
  });

  it("常態", () => {
    expect(dcaTierLabel({ kind: "base", pct: null, multiplier: 1 }, config)).toBe(
      "常態",
    );
  });

  it("上界跟著設定的門檻走，設定的順序不影響", () => {
    const custom: DcaTierConfig = {
      maLength: 200,
      drawdown: [
        { pct: -50, multiplier: 3 },
        { pct: -7.5, multiplier: 1.2 },
      ],
      premium: [{ pct: 15, multiplier: 0.5 }],
    };
    expect(
      dcaTierLabel({ kind: "drawdown", pct: -7.5, multiplier: 1.2 }, custom),
    ).toBe("回撤 7.5~50%");
    expect(
      dcaTierLabel({ kind: "premium", pct: 15, multiplier: 0.5 }, custom),
    ).toBe("高於均線 ≥15%");
  });
});

describe("buildDcaTierStatus", () => {
  it("0050 在 2026-09-30：與指標面板一致", () => {
    const dividends = parseFinmindDividends(fixture.dividends);
    const status = buildDcaTierStatus(
      {
        series: buildTotalReturnSeries(
          parseFinmindPrices(fixture.prices),
          dividends,
          parseFinmindSplits(fixture.splits),
        ),
        dividendCount: dividends.length,
      },
      DEFAULT_DCA_TIER_CONFIG,
      8000,
    );
    if (!status.ok) throw new Error(status.error);

    expect(status.asOf).toBe("2026-09-30");
    expect(status.drawdownPct.toFixed(2)).toBe("-0.36");
    expect(status.maPremiumPct?.toFixed(2)).toBe("25.95");
    expect(status.maLength).toBe(200);
    expect(status.tierKind).toBe("premium");
    expect(status.tierLabel).toBe("高於均線 ≥20%");
    expect(status.multiplier).toBe(0.8);
    expect(status.suggestedAmount).toBe(6400);
    expect(status.dividendCount).toBe(4);
  });

  it("回撤級距：建議金額取整到百元", () => {
    const status = buildDcaTierStatus(
      { series: series([100, 100, 100, 100, 88]), dividendCount: 0 },
      short,
      3333,
    );
    if (!status.ok) throw new Error(status.error);

    expect(status.tierLabel).toBe("回撤 10~20%");
    expect(status.multiplier).toBe(1.25);
    expect(status.suggestedAmount).toBe(4200);
    expect(status.dividendCount).toBe(0);
  });

  it("交易日數不夠算均線：乖離是 null，仍給得出金額", () => {
    const status = buildDcaTierStatus(
      { series: series([100, 110, 130, 150]), dividendCount: 1 },
      short,
      8000,
    );
    if (!status.ok) throw new Error(status.error);

    expect(status.maPremiumPct).toBeNull();
    expect(status.tierLabel).toBe("常態");
    expect(status.suggestedAmount).toBe(8000);
  });

  it("基準金額太小、取整後是 0 時不給建議金額", () => {
    const status = buildDcaTierStatus(
      { series: series([100, 100, 100, 100, 100]), dividendCount: 1 },
      short,
      40,
    );
    if (!status.ok) throw new Error(status.error);

    expect(status.suggestedAmount).toBeNull();
  });

  it("序列算不出來時把錯誤原樣帶出", () => {
    expect(
      buildDcaTierStatus({ series: [], dividendCount: 0 }, short, 8000),
    ).toEqual({ ok: false, error: "沒有歷史收盤資料" });
  });
});

describe("dcaTierFetchErrorMessage", () => {
  it("額度用完：沿用 ApiBudgetExceededError 自己的訊息", () => {
    const error = new Error("台股報價今日的共用額度已用完，明天才會重置");
    error.name = "ApiBudgetExceededError";
    expect(dcaTierFetchErrorMessage(error)).toBe(
      "台股報價今日的共用額度已用完，明天才會重置",
    );
  });

  it("其他錯誤一律給固定句子，不帶上游的內容", () => {
    expect(
      dcaTierFetchErrorMessage(new Error("FinMind TaiwanStockPrice 回應 HTTP 402")),
    ).toBe("抓不到歷史股價");
    expect(dcaTierFetchErrorMessage("boom")).toBe("抓不到歷史股價");
    expect(dcaTierFetchErrorMessage(undefined)).toBe("抓不到歷史股價");
  });
});
