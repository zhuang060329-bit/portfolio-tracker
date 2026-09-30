/**
 * 帳戶頁計畫列要顯示的級距狀態：把 evaluateDcaTier 的結果整理成可以直接
 * 交給 client 元件的純資料（對應指標右上角那張資訊表）。
 * 純函式，不抓資料；抓資料在 prices/finmind-total-return-cached.ts。
 */

import {
  evaluateDcaTier,
  tieredAmount,
  type DcaTier,
  type DcaTierConfig,
} from "./dca-tiers";
import type { DailyClose } from "./total-return-series";

export type DcaTierStatus =
  | {
      ok: true;
      /** 判定依據的收盤日。 */
      asOf: string;
      drawdownPct: number;
      highDate: string;
      /** 交易日數不夠算均線時是 null。 */
      maPremiumPct: number | null;
      maLength: number;
      tierKind: DcaTier["kind"];
      tierLabel: string;
      multiplier: number;
      /** 基準金額 × 倍數取整到百元。取整後不是正數時是 null，由畫面退回基準金額。 */
      suggestedAmount: number | null;
      /** 0 代表沒抓到任何除權息，含息序列等同原始股價。 */
      dividendCount: number;
    }
  | { ok: false; error: string };

const fmtPct = (pct: number) => String(Number(Math.abs(pct).toFixed(2)));

/**
 * 級距名稱，文字照 Pine Script 的寫法：
 * 「回撤 10~20%」「回撤 ≥45%」「高於均線 10~20%」「高於均線 ≥20%」「常態」。
 * 上界取設定裡的下一級門檻，所以改了門檻名稱會跟著變。
 */
export function dcaTierLabel(tier: DcaTier, config: DcaTierConfig): string {
  if (tier.kind === "base") return "常態";

  if (tier.kind === "drawdown") {
    // 比這一級更深的門檻裡最淺的那個，就是這一級的上界。
    const deeper = config.drawdown
      .map((step) => step.pct)
      .filter((pct) => pct < tier.pct)
      .sort((a, b) => b - a)[0];
    return deeper === undefined
      ? `回撤 ≥${fmtPct(tier.pct)}%`
      : `回撤 ${fmtPct(tier.pct)}~${fmtPct(deeper)}%`;
  }

  const higher = config.premium
    .map((step) => step.pct)
    .filter((pct) => pct > tier.pct)
    .sort((a, b) => a - b)[0];
  return higher === undefined
    ? `高於均線 ≥${fmtPct(tier.pct)}%`
    : `高於均線 ${fmtPct(tier.pct)}~${fmtPct(higher)}%`;
}

export function buildDcaTierStatus(
  totalReturn: { series: DailyClose[]; dividendCount: number },
  config: DcaTierConfig,
  baseAmount: number,
): DcaTierStatus {
  const result = evaluateDcaTier(totalReturn.series, config);
  if (!result.ok) return { ok: false, error: result.error };

  const amount = tieredAmount(baseAmount, result.multiplier);

  return {
    ok: true,
    asOf: result.asOf,
    drawdownPct: result.drawdownPct,
    highDate: result.highDate,
    maPremiumPct: result.maPremiumPct,
    maLength: config.maLength,
    tierKind: result.tier.kind,
    tierLabel: dcaTierLabel(result.tier, config),
    multiplier: result.multiplier,
    suggestedAmount: Number.isFinite(amount) && amount > 0 ? amount : null,
    dividendCount: totalReturn.dividendCount,
  };
}

/**
 * 抓含息序列失敗時給使用者看的訊息。
 * 額度用完有自己的說明（api-budget.ts 的 ApiBudgetExceededError，訊息本來就是寫給人看的）；
 * 其餘一律給固定句子，不把上游的錯誤內容帶到畫面上。
 * 用 name 判斷而不是 instanceof，這支檔才不必 import 只能在 server 跑的 api-budget。
 */
export function dcaTierFetchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "ApiBudgetExceededError") {
    return error.message;
  }
  return "抓不到歷史股價";
}
