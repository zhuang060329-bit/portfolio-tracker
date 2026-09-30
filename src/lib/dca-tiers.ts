/**
 * 定期定額的級距加減碼：依「前高回撤」與「高於均線的幅度」決定本期金額的倍數。
 * 純函式、不碰 DB 也不抓資料。輸入是含息序列（total-return-series.ts）。
 *
 * 規格是 TradingView 指標「DCA 七級距加減碼 v2 (含息序列)」的 Pine Script 原始碼
 * （2026-09-30 逐行對過）：
 *   回撤 ≤ -10 / -20 / -30 / -45% → 1.25 / 1.5 / 1.75 / 2 倍（加碼）
 *   高於均線 ≥ 10 / 20%           → 0.9 / 0.8 倍（減碼）
 *   其餘                           → 1 倍
 *
 * 與原始碼一致的四件事，改動前先看清楚：
 * 1. 前高取「序列內全部歷史」的最高收盤（`ath := math.max(ath, tr)`），不是固定回看天數。
 * 2. 回撤級距優先於均線級距：原始碼先由深到淺判回撤，都沒中才看均線。
 *    會同時成立的情況：長期大漲後急跌 10%，價格仍在 200MA 上方 10% 以上。
 * 3. 交易日數不夠算均線時乖離是空值（`ext = na`），只跳過減碼兩級，
 *    回撤級距照常判定。上市不久的標的仍然會得到加碼訊號。
 * 4. 金額取整到百元（`math.round(baseAmt * mult / 100.0) * 100`），
 *    原始碼的註解是「台股定期定額以百元為單位」。
 */

import type { DailyClose } from "./total-return-series";

export type DcaTierStep = {
  /** 門檻百分比。回撤級距是負數（-10 代表回撤達 10%），均線級距是正數。 */
  pct: number;
  multiplier: number;
};

export type DcaTierConfig = {
  maLength: number;
  drawdown: DcaTierStep[];
  premium: DcaTierStep[];
};

export const DEFAULT_DCA_TIER_CONFIG: DcaTierConfig = {
  maLength: 200,
  drawdown: [
    { pct: -10, multiplier: 1.25 },
    { pct: -20, multiplier: 1.5 },
    { pct: -30, multiplier: 1.75 },
    { pct: -45, multiplier: 2 },
  ],
  premium: [
    { pct: 10, multiplier: 0.9 },
    { pct: 20, multiplier: 0.8 },
  ],
};

export type DcaTier =
  | { kind: "drawdown"; pct: number; multiplier: number }
  | { kind: "premium"; pct: number; multiplier: number }
  | { kind: "base"; pct: null; multiplier: 1 };

export type DcaTierResult =
  | {
      ok: true;
      /** 序列最後一列的日期，也就是這個判斷依據的收盤日。 */
      asOf: string;
      /** 相對前高的漲跌幅，0 或負數。 */
      drawdownPct: number;
      highDate: string;
      /** 收盤相對均線的乖離，正數代表在均線上方。交易日數不夠算均線時是 null。 */
      maPremiumPct: number | null;
      tier: DcaTier;
      multiplier: number;
    }
  | { ok: false; error: string };

export function evaluateDcaTier(
  series: DailyClose[],
  config: DcaTierConfig = DEFAULT_DCA_TIER_CONFIG,
): DcaTierResult {
  if (!Number.isInteger(config.maLength) || config.maLength < 2) {
    return { ok: false, error: "均線天數設定無效" };
  }
  if (series.length === 0) {
    return { ok: false, error: "沒有歷史收盤資料" };
  }
  if (series.some((row) => !Number.isFinite(row.close) || row.close <= 0)) {
    return { ok: false, error: "歷史收盤含無效數值" };
  }

  const last = series[series.length - 1];

  let high = series[0];
  for (const row of series) {
    // 同價取較晚的日期，「前高」指的是最近一次到達這個價位。
    if (row.close >= high.close) high = row;
  }

  let maPremiumPct: number | null = null;
  if (series.length >= config.maLength) {
    let sum = 0;
    for (let i = series.length - config.maLength; i < series.length; i++) {
      sum += series[i].close;
    }
    maPremiumPct = (last.close / (sum / config.maLength) - 1) * 100;
  }

  const drawdownPct = (last.close / high.close - 1) * 100;
  const tier = pickTier(drawdownPct, maPremiumPct, config);

  return {
    ok: true,
    asOf: last.date,
    drawdownPct,
    highDate: high.date,
    maPremiumPct,
    tier,
    multiplier: tier.multiplier,
  };
}

// 門檻是含邊界的（「≥20%」「≤ -10%」），但 (90 / 100 - 1) * 100 在浮點數下是
// -9.999999999999998，不加容差的話剛好踩在門檻上的值會被判到下一級。
const EPSILON = 1e-9;

function pickTier(
  drawdownPct: number,
  maPremiumPct: number | null,
  config: DcaTierConfig,
): DcaTier {
  // 由深到淺找第一個達到的回撤門檻。
  const drawdown = [...config.drawdown]
    .sort((a, b) => a.pct - b.pct)
    .find((step) => drawdownPct <= step.pct + EPSILON);
  if (drawdown) return { kind: "drawdown", ...drawdown };

  // 由高到低找第一個達到的均線門檻。乖離算不出來時整段跳過。
  if (maPremiumPct !== null) {
    const premium = [...config.premium]
      .sort((a, b) => b.pct - a.pct)
      .find((step) => maPremiumPct >= step.pct - EPSILON);
    if (premium) return { kind: "premium", ...premium };
  }

  return { kind: "base", pct: null, multiplier: 1 };
}

/**
 * 本期金額 = 基準金額 × 倍數，四捨五入到百元。
 * 1 倍時也取整：基準 3,333 會得到 3,300，與指標面板顯示的數字一致。
 */
export function tieredAmount(baseAmount: number, multiplier: number): number {
  return Math.round((baseAmount * multiplier) / 100) * 100;
}
