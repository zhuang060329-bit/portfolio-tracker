import { describe, expect, it } from "vitest";
import {
  averageCostFx,
  costCorrectionNote,
  resolveCostCorrection,
  type CostCorrectionInput,
} from "./cost-correction";

const usd: CostCorrectionInput = {
  nativeCurrency: "USD",
  quantity: 2.5,
  currentCostTwd: 32000,
  currentCostNative: 1000,
  lastFxRate: 30,
  costNative: 900,
  costTwd: null,
};

describe("averageCostFx", () => {
  it("TWD 成本 ÷ 原幣成本", () => {
    expect(averageCostFx(32000, 1000)).toBe(32);
  });

  it("任一成本不是正數就回 null，不回 1", () => {
    expect(averageCostFx(0, 1000)).toBeNull();
    expect(averageCostFx(32000, 0)).toBeNull();
    expect(averageCostFx(-1, 1000)).toBeNull();
    expect(averageCostFx(Number.NaN, 1000)).toBeNull();
  });
});

describe("resolveCostCorrection", () => {
  it("原幣是 TWD：兩個成本欄同值，忽略 TWD 欄的輸入", () => {
    const result = resolveCostCorrection({
      nativeCurrency: "TWD",
      quantity: 100,
      currentCostTwd: 50000,
      currentCostNative: 50000,
      lastFxRate: 1,
      costNative: 48000,
      costTwd: 123,
    });
    expect(result).toEqual({
      ok: true,
      costTwd: 48000,
      costNative: 48000,
      fxUsed: 1,
      fxSource: "native",
    });
  });

  it("外幣、TWD 留空：沿用現有平均成本匯率，不用最新報價匯率", () => {
    const result = resolveCostCorrection(usd);
    expect(result).toEqual({
      ok: true,
      costTwd: 28800,
      costNative: 900,
      fxUsed: 32,
      fxSource: "average",
    });
  });

  it("外幣、TWD 有填：照填的值，匯率由兩者反推", () => {
    const result = resolveCostCorrection({ ...usd, costTwd: 27900 });
    expect(result).toEqual({
      ok: true,
      costTwd: 27900,
      costNative: 900,
      fxUsed: 31,
      fxSource: "manual",
    });
  });

  it("外幣、沒有現有成本可推平均匯率：退回最後報價匯率", () => {
    const result = resolveCostCorrection({
      ...usd,
      currentCostTwd: 0,
      currentCostNative: 0,
    });
    expect(result).toEqual({
      ok: true,
      costTwd: 27000,
      costNative: 900,
      fxUsed: 30,
      fxSource: "last",
    });
  });

  it("外幣、平均匯率與最後報價匯率都沒有：要求直接填 TWD", () => {
    const result = resolveCostCorrection({
      ...usd,
      currentCostTwd: 0,
      currentCostNative: 0,
      lastFxRate: null,
    });
    expect(result).toEqual({
      ok: false,
      error: "帳戶沒有可用的匯率，請直接填寫 TWD 總成本",
    });
  });

  it("沒有持有數量就不校正", () => {
    expect(resolveCostCorrection({ ...usd, quantity: 0 })).toEqual({
      ok: false,
      error: "目前沒有持有數量，沒有成本可以校正",
    });
  });

  it("總成本須為正數", () => {
    for (const costNative of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveCostCorrection({ ...usd, costNative }).ok).toBe(false);
    }
    expect(resolveCostCorrection({ ...usd, costTwd: 0 })).toEqual({
      ok: false,
      error: "TWD 總成本需為正數",
    });
  });

  it("超出上限的數字擋下", () => {
    expect(resolveCostCorrection({ ...usd, costNative: 1e12 }).ok).toBe(false);
    expect(resolveCostCorrection({ ...usd, costTwd: 1e12 }).ok).toBe(false);
  });
});

describe("costCorrectionNote", () => {
  it("TWD 帳戶只寫一組數字", () => {
    expect(
      costCorrectionNote({
        nativeCurrency: "TWD",
        beforeTwd: 50000,
        beforeNative: 50000,
        afterTwd: 48000,
        afterNative: 48000,
        userNote: null,
      }),
    ).toBe("校正成本 TWD 50,000 → 48,000");
  });

  it("外幣帳戶先寫原幣、再寫 TWD，使用者備註接在後面", () => {
    expect(
      costCorrectionNote({
        nativeCurrency: "USD",
        beforeTwd: 32000,
        beforeNative: 1000,
        afterTwd: 28800.4,
        afterNative: 900.126,
        userNote: "依券商庫存",
      }),
    ).toBe("校正成本 USD 1,000 → 900.13（TWD 32,000 → 28,800） · 依券商庫存");
  });
});
