import { describe, expect, it } from "vitest";
import {
  DEFAULT_DCA_TIER_CONFIG,
  evaluateDcaTier,
  tieredAmount,
  type DcaTierConfig,
} from "./dca-tiers";
import { buildTotalReturnSeries } from "./total-return-series";
import {
  parseFinmindDividends,
  parseFinmindPrices,
  parseFinmindSplits,
} from "./prices/finmind-total-return";
import fixture from "./__fixtures__/finmind-0050.json";

// 均線 5 日，方便用短序列湊出指定的回撤與乖離。
const short: DcaTierConfig = { ...DEFAULT_DCA_TIER_CONFIG, maLength: 5 };

const series = (closes: number[]) =>
  closes.map((close, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    close,
  }));

describe("evaluateDcaTier：0050 在 2026-09-30 的實際資料", () => {
  const prices = parseFinmindPrices(fixture.prices);
  const adjusted = buildTotalReturnSeries(
    prices,
    parseFinmindDividends(fixture.dividends),
    parseFinmindSplits(fixture.splits),
  );

  it("與 TradingView 指標面板一致：回撤 -0.36%、高於 200MA 25.95%、0.8 倍、6,400", () => {
    const result = evaluateDcaTier(adjusted);
    if (!result.ok) throw new Error(result.error);

    expect(result.asOf).toBe("2026-09-30");
    expect(result.highDate).toBe("2026-09-23");
    expect(result.drawdownPct.toFixed(2)).toBe("-0.36");
    expect(result.maPremiumPct?.toFixed(2)).toBe("25.95");
    expect(result.tier).toEqual({ kind: "premium", pct: 20, multiplier: 0.8 });
    expect(tieredAmount(8000, result.multiplier)).toBe(6400);
  });

  it("沒還原分割的原始收盤會被誤判成加碼", () => {
    const result = evaluateDcaTier(prices);
    if (!result.ok) throw new Error(result.error);

    expect(result.drawdownPct).toBeLessThan(-40);
    expect(result.tier.kind).toBe("drawdown");
    expect(result.multiplier).toBeGreaterThan(1);
  });
});

describe("evaluateDcaTier：級距", () => {
  const multiplierOf = (closes: number[]) => {
    const result = evaluateDcaTier(series(closes), short);
    if (!result.ok) throw new Error(result.error);
    return result.multiplier;
  };

  it("回撤四級：-10 / -20 / -30 / -45% 對應 1.25 / 1.5 / 1.75 / 2", () => {
    expect(multiplierOf([100, 100, 100, 100, 88])).toBe(1.25);
    expect(multiplierOf([100, 100, 100, 100, 75])).toBe(1.5);
    expect(multiplierOf([100, 100, 100, 100, 65])).toBe(1.75);
    expect(multiplierOf([100, 100, 100, 100, 50])).toBe(2);
  });

  it("回撤門檻含邊界：剛好 -10% 算 1.25，-9.9% 不算", () => {
    // (90 / 100 - 1) * 100 在浮點數下是 -9.999999999999998。
    expect(multiplierOf([100, 100, 100, 100, 90])).toBe(1.25);
    expect(multiplierOf([100, 100, 100, 100, 90.1])).toBe(1);
  });

  it("均線兩級：高於 10 / 20% 對應 0.9 / 0.8", () => {
    // 均線 = (100×4 + last) / 5。
    const high10 = evaluateDcaTier(series([100, 100, 100, 100, 115]), short);
    const high20 = evaluateDcaTier(series([100, 100, 100, 100, 130]), short);
    if (!high10.ok || !high20.ok) throw new Error("應該算得出來");

    expect(high10.maPremiumPct ?? Number.NaN).toBeCloseTo(11.65, 2);
    expect(high10.tier).toEqual({ kind: "premium", pct: 10, multiplier: 0.9 });
    expect(high20.maPremiumPct ?? Number.NaN).toBeCloseTo(22.64, 2);
    expect(high20.tier).toEqual({ kind: "premium", pct: 20, multiplier: 0.8 });
  });

  it("均線門檻含邊界：剛好高於均線 10% 算 0.9", () => {
    // 均線 = (98×4 + 110) / 5 = 100.4 → 不到 10%；(97.5×4 + 110) / 5 = 100 → 剛好 10%。
    expect(multiplierOf([98, 98, 98, 98, 110])).toBe(1);
    expect(multiplierOf([97.5, 97.5, 97.5, 97.5, 110])).toBe(0.9);
  });

  it("兩邊都沒達到門檻時是 1 倍", () => {
    const result = evaluateDcaTier(series([100, 102, 101, 103, 102]), short);
    if (!result.ok) throw new Error(result.error);

    expect(result.tier).toEqual({ kind: "base", pct: null, multiplier: 1 });
  });

  it("回撤與均線同時成立時以回撤為準", () => {
    // 前高 100、收 88（回撤 12%）；近 5 日均線 67.6，收盤仍高於均線 30%。
    const result = evaluateDcaTier(
      series([50, 50, 50, 50, 50, 50, 100, 88]),
      short,
    );
    if (!result.ok) throw new Error(result.error);

    expect(result.maPremiumPct ?? Number.NaN).toBeGreaterThan(20);
    expect(result.tier).toEqual({ kind: "drawdown", pct: -10, multiplier: 1.25 });
  });

  it("前高取全部歷史，不只看均線窗內", () => {
    // 窗外曾到 200，近 5 日都在 100 附近：回撤 50%。
    const result = evaluateDcaTier(
      series([200, 100, 100, 100, 100, 100]),
      short,
    );
    if (!result.ok) throw new Error(result.error);

    expect(result.drawdownPct).toBe(-50);
    expect(result.highDate).toBe("2026-01-01");
    expect(result.multiplier).toBe(2);
  });

  it("創新高當天回撤是 0，前高日期就是當天", () => {
    const result = evaluateDcaTier(series([100, 101, 102, 103, 104]), short);
    if (!result.ok) throw new Error(result.error);

    expect(result.drawdownPct).toBe(0);
    expect(result.highDate).toBe(result.asOf);
  });

  it("設定裡的級距順序不影響結果", () => {
    const shuffled: DcaTierConfig = {
      maLength: 5,
      drawdown: [...DEFAULT_DCA_TIER_CONFIG.drawdown].reverse(),
      premium: [...DEFAULT_DCA_TIER_CONFIG.premium].reverse(),
    };
    const deep = evaluateDcaTier(series([100, 100, 100, 100, 50]), shuffled);
    const high = evaluateDcaTier(series([100, 100, 100, 100, 130]), shuffled);
    if (!deep.ok || !high.ok) throw new Error("應該算得出來");

    expect(deep.multiplier).toBe(2);
    expect(high.multiplier).toBe(0.8);
  });
});

describe("evaluateDcaTier：交易日數少於均線天數（對應 Pine 的 ext = na）", () => {
  it("乖離是 null，不套減碼級距", () => {
    // 四天就漲 50%，要是硬算均線會落在減碼級距。
    const result = evaluateDcaTier(series([100, 110, 130, 150]), short);
    if (!result.ok) throw new Error(result.error);

    expect(result.maPremiumPct).toBeNull();
    expect(result.tier).toEqual({ kind: "base", pct: null, multiplier: 1 });
  });

  it("回撤級距照常判定", () => {
    const result = evaluateDcaTier(series([100, 100, 100, 75]), short);
    if (!result.ok) throw new Error(result.error);

    expect(result.maPremiumPct).toBeNull();
    expect(result.drawdownPct).toBe(-25);
    expect(result.tier).toEqual({ kind: "drawdown", pct: -20, multiplier: 1.5 });
  });

  it("剛好等於均線天數時算得出乖離", () => {
    const result = evaluateDcaTier(series([100, 100, 100, 100, 100]), short);
    if (!result.ok) throw new Error(result.error);

    expect(result.maPremiumPct).toBe(0);
  });
});

describe("evaluateDcaTier：算不出來時回錯誤，不猜倍數", () => {
  it("空序列", () => {
    expect(evaluateDcaTier([], short)).toEqual({
      ok: false,
      error: "沒有歷史收盤資料",
    });
  });

  it("序列含無效收盤", () => {
    for (const bad of [0, -1, Number.NaN]) {
      const result = evaluateDcaTier(series([100, 100, bad, 100, 100]), short);
      expect(result).toEqual({ ok: false, error: "歷史收盤含無效數值" });
    }
  });

  it("均線天數設定無效", () => {
    for (const maLength of [0, 1, 2.5]) {
      const result = evaluateDcaTier(series([100, 100, 100, 100, 100]), {
        ...short,
        maLength,
      });
      expect(result).toEqual({ ok: false, error: "均線天數設定無效" });
    }
  });
});

describe("tieredAmount", () => {
  it("基準金額 × 倍數", () => {
    expect(tieredAmount(8000, 0.8)).toBe(6400);
    expect(tieredAmount(8000, 1)).toBe(8000);
    expect(tieredAmount(8000, 1.75)).toBe(14000);
  });

  it("取整到百元，與 Pine 的 math.round(base × mult / 100) × 100 一致", () => {
    expect(tieredAmount(3333, 1.25)).toBe(4200); // 4166.25
    expect(tieredAmount(3335, 0.9)).toBe(3000); // 3001.5
    expect(tieredAmount(5000, 0.9)).toBe(4500);
    expect(tieredAmount(1000, 1.25)).toBe(1300); // 1250，逢五進位
  });

  it("1 倍時也取整", () => {
    expect(tieredAmount(3333, 1)).toBe(3300);
    expect(tieredAmount(3350, 1)).toBe(3400);
  });

  it("基準金額太小時取整後是 0，由呼叫端決定要不要採用", () => {
    expect(tieredAmount(40, 1)).toBe(0);
  });
});
