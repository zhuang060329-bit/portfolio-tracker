import type { PriceProvider } from "./types";
import { fetchWithRetry } from "./http";

// 加密貨幣：CoinGecko Demo API。可直接要 vs_currencies=twd，免換匯。
// symbol 為 CoinGecko id（如 bitcoin）。
export const coingeckoProvider: PriceProvider = {
  market: "crypto",
  async getQuote(symbol, baseCurrency) {
    const vs = baseCurrency.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      symbol,
    )}&vs_currencies=${vs}`;
    const res = await fetchWithRetry(url, {
      headers: { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_KEY ?? "" },
    });
    const json = await res.json();
    const price = json?.[symbol]?.[vs];
    if (typeof price !== "number" || !Number.isFinite(price)) {
      throw new Error(`CoinGecko 找不到 ${symbol} 的 ${vs} 價格（id 是否正確？）`);
    }
    return {
      unitPrice: price,
      nativeCurrency: baseCurrency.toUpperCase(),
      fxToBase: 1,
      asOf: new Date().toISOString(),
    };
  },
};
