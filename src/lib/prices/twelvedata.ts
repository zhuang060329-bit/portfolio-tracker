import type { PriceProvider } from "./types";
import { fetchWithRetry } from "./http";
import { getUsdTwdRate } from "./fx";

// 美股：Twelve Data（Basic 免費）。回傳 USD，需換匯成 base（TWD）。
// symbol 為美股 ticker（如 QQQM）。
export const twelveDataProvider: PriceProvider = {
  market: "us",
  async getQuote(symbol, baseCurrency) {
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(
      symbol,
    )}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
    const res = await fetchWithRetry(url);
    const json = await res.json();
    const price = Number(json?.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(
        `Twelve Data 找不到 ${symbol} 價格：${JSON.stringify(json).slice(0, 120)}`,
      );
    }
    const fxToBase =
      baseCurrency.toUpperCase() === "USD" ? 1 : await getUsdTwdRate();
    return {
      unitPrice: price,
      nativeCurrency: "USD",
      fxToBase,
      asOf: new Date().toISOString(),
    };
  },
};

// 美股歷史 daily close。用來畫基準線（S&P 500 / Nasdaq 100）。
// 回傳 [{date: 'YYYY-MM-DD', close: number}]，依日期由舊到新排序。
// startDate 格式 'YYYY-MM-DD'。失敗回空陣列（前端會 fallback）。
export async function fetchUsDailyClose(
  symbol: string,
  startDate: string,
): Promise<{ date: string; close: number }[]> {
  if (!startDate) return [];
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) return [];
  try {
    // Twelve Data time_series；用 outputsize=5000 拿夠久。
    const url =
      `https://api.twelvedata.com/time_series` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&interval=1day` +
      `&start_date=${startDate}` +
      `&order=asc` +
      `&outputsize=5000` +
      `&apikey=${key}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      values?: { datetime: string; close: string }[];
      status?: string;
    };
    if (json.status === "error" || !Array.isArray(json.values)) return [];
    return json.values
      .map((v) => ({ date: v.datetime, close: Number(v.close) }))
      .filter((r) => Number.isFinite(r.close) && r.close > 0);
  } catch {
    return [];
  }
}
