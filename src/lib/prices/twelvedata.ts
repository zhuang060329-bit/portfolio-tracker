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
