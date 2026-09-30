import { fetchWithRetry } from "./http";
import { consumeApiQuota } from "@/lib/api-budget";
import {
  buildTotalReturnSeries,
  type DailyClose,
  type DividendEvent,
  type SplitEvent,
} from "@/lib/total-return-series";

/**
 * 台股含息序列的資料來源：FinMind 免費層的三個資料集。
 *   TaiwanStockPrice          日收盤（未還原）
 *   TaiwanStockDividendResult 除權息結果
 *   TaiwanStockSplitPrice     分割
 * 現成的還原股價 TaiwanStockPriceAdj 是付費層，免費 token 回 400（2026-09-30 實測）。
 *
 * 與 finmind.ts 的 fetchTwDailyClose 不同，這裡任何一個資料集失敗都往上丟，
 * 不回空陣列。理由：缺了除息只是乖離率差零點幾個百分點，缺了分割卻會把
 * 0050 判成回撤 45%、建議金額變兩倍。寧可算不出來，不要算出錯的倍數。
 *
 * 尚未處理減資與面額變更（TaiwanStockCapitalReductionReferencePrice、
 * TaiwanStockParValueChange）。ETF 不會遇到，個股遇到時序列會有斷層。
 */

// 前高取全部歷史，所以一律從頭抓。
const HISTORY_START = "1990-01-01";

type FinmindRow = Record<string, unknown>;

export function parseFinmindPrices(rows: FinmindRow[]): DailyClose[] {
  return rows
    .map((row) => ({ date: String(row.date ?? ""), close: Number(row.close) }))
    .filter((row) => row.date && Number.isFinite(row.close) && row.close > 0);
}

/** stock_and_cache_dividend 是證交所表上的「權值＋息值」，配股與配息都含在內。 */
export function parseFinmindDividends(rows: FinmindRow[]): DividendEvent[] {
  return rows
    .map((row) => ({
      date: String(row.date ?? ""),
      amount: Number(row.stock_and_cache_dividend),
    }))
    .filter((row) => row.date && Number.isFinite(row.amount) && row.amount > 0);
}

export function parseFinmindSplits(rows: FinmindRow[]): SplitEvent[] {
  return rows
    .map((row) => ({
      date: String(row.date ?? ""),
      ratio: Number(row.after_price) / Number(row.before_price),
    }))
    .filter((row) => row.date && Number.isFinite(row.ratio) && row.ratio > 0);
}

async function fetchDataset(
  dataset: string,
  symbol: string,
): Promise<FinmindRow[]> {
  const url =
    `https://api.finmindtrade.com/api/v4/data?dataset=${dataset}` +
    `&data_id=${encodeURIComponent(symbol)}&start_date=${HISTORY_START}`;
  const token = process.env.FINMIND_TOKEN;
  const res = await fetchWithRetry(
    url,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      next: { revalidate: 3600 },
    },
    1,
  );
  if (!res.ok) {
    throw new Error(`FinMind ${dataset} 回應 HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: unknown };
  if (!Array.isArray(json.data)) {
    throw new Error(`FinMind ${dataset} 回應格式異常`);
  }
  return json.data as FinmindRow[];
}

export type TwTotalReturnSeries = {
  series: DailyClose[];
  dividendCount: number;
  splitCount: number;
};

/**
 * 抓三個資料集並重建含息序列。每次呼叫扣 3 次 FinMind 額度，
 * 扣不到（ApiBudgetExceededError）就一個請求都不打。
 */
export async function fetchTwTotalReturnSeries(
  symbol: string,
): Promise<TwTotalReturnSeries> {
  await consumeApiQuota("finmind", 3);

  const [priceRows, dividendRows, splitRows] = await Promise.all([
    fetchDataset("TaiwanStockPrice", symbol),
    fetchDataset("TaiwanStockDividendResult", symbol),
    fetchDataset("TaiwanStockSplitPrice", symbol),
  ]);

  const prices = parseFinmindPrices(priceRows);
  if (prices.length === 0) {
    throw new Error(`FinMind 找不到台股 ${symbol} 的歷史收盤`);
  }
  const dividends = parseFinmindDividends(dividendRows);
  const splits = parseFinmindSplits(splitRows);

  return {
    series: buildTotalReturnSeries(prices, dividends, splits),
    dividendCount: dividends.length,
    splitCount: splits.length,
  };
}
