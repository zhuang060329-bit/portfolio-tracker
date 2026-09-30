/**
 * cron 執行級距計劃時要帶給 RPC 的本期金額。
 *
 * 帳戶頁只把建議金額預填進表單，按不按由人決定；cron 沒有人看，
 * 所以這裡的原則是「算不出來就不執行」：抓不到序列、額度用完、設定格式壞掉、
 * 序列太舊，一律回 error，由 cron 把該期記成失敗、隔天重試。
 * 不退回基準金額——回撤 30% 那天剛好 FinMind 出錯，安靜地只買 1 倍，
 * 事後從流水看不出來少買了。
 *
 * 抓資料由呼叫端注入（loadSeries），這支檔不碰網路也不碰額度，方便測試。
 */

import {
  buildDcaTierStatus,
  dcaTierFetchErrorMessage,
} from "./dca-tier-status";
import { parseStoredDcaTierConfig } from "./schemas/domain/dca-tier-config";
import type { DailyClose } from "./total-return-series";

/**
 * 序列最後一筆收盤離今天超過這個天數就不採用。
 * 與台股報價（finmind.ts 的 getQuote）取「最近 14 天的最後一筆」同一個窗：
 * 超過這個窗報價自己也會失敗，級距不該比成交價用更舊的資料。
 * 春節連假最長約 10 天，在窗內。
 */
export const TIER_SERIES_MAX_AGE_DAYS = 14;

type TierSeries = { series: DailyClose[]; dividendCount: number };

export type CronTierAmount =
  /** 固定金額計劃：不帶金額，RPC 用 amount_twd。 */
  | { kind: "fixed" }
  | {
      kind: "tiered";
      /** 要帶給 RPC 的本期金額。 */
      amount: number;
      multiplier: number;
      /** 判定依據的收盤日。 */
      asOf: string;
    }
  /** cause 是抓序列時的原始例外，只給呼叫端寫 log，不要回給 client。 */
  | { kind: "error"; error: string; cause?: unknown };

const DAY_MS = 86_400_000;

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) /
      DAY_MS,
  );
}

export async function resolveCronTierAmount(args: {
  plan: { amount_twd: number | string; tier_config: unknown };
  account: { price_market: string; symbol: string | null };
  /** 台北時區的今天（YYYY-MM-DD）。 */
  today: string;
  loadSeries: (symbol: string) => Promise<TierSeries>;
}): Promise<CronTierAmount> {
  const { plan, account, today, loadSeries } = args;

  const stored = parseStoredDcaTierConfig(plan.tier_config);
  if (stored.kind === "none") return { kind: "fixed" };
  if (stored.kind === "invalid") {
    return { kind: "error", error: "級距設定格式無效" };
  }

  // 建立表單只讓台股帳戶設級距，這裡再擋一次：tier_config 是 jsonb，
  // 擋不住有人直接寫進別種帳戶的計劃。
  if (account.price_market !== "tw" || !account.symbol) {
    return { kind: "error", error: "級距加減碼只支援台股帳戶" };
  }

  const baseAmount = Number(plan.amount_twd);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return { kind: "error", error: "定期定額金額無效" };
  }

  let totalReturn: TierSeries;
  try {
    totalReturn = await loadSeries(account.symbol);
  } catch (cause) {
    return { kind: "error", error: dcaTierFetchErrorMessage(cause), cause };
  }

  const status = buildDcaTierStatus(totalReturn, stored.config, baseAmount);
  if (!status.ok) return { kind: "error", error: status.error };

  const age = daysBetween(status.asOf, today);
  if (!Number.isFinite(age) || age > TIER_SERIES_MAX_AGE_DAYS) {
    return {
      kind: "error",
      error: `歷史股價只到 ${status.asOf}，超過 ${TIER_SERIES_MAX_AGE_DAYS} 天沒有更新`,
    };
  }

  return {
    kind: "tiered",
    // 取整到百元後不是正數（基準金額不到 50 元又遇到減碼）時用基準金額，
    // 與帳戶頁預填的行為一致。這是取整的問題，不是算不出級距。
    amount: status.suggestedAmount ?? baseAmount,
    multiplier: status.multiplier,
    asOf: status.asOf,
  };
}

/**
 * 同一次 cron 裡每個代號只抓一次：兩個計劃掛在同一檔標的上時，
 * 第二個直接拿第一個的結果，不再扣 3 次額度。
 * 失敗也一起記住——同一次執行裡重抓多半還是失敗，只是多扣額度。
 */
export function memoizeSeriesLoader<T>(
  load: (symbol: string) => Promise<T>,
): (symbol: string) => Promise<T> {
  const pending = new Map<string, Promise<T>>();
  return (symbol) => {
    let entry = pending.get(symbol);
    if (!entry) {
      entry = load(symbol);
      pending.set(symbol, entry);
    }
    return entry;
  };
}
