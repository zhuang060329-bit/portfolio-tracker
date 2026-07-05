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

// BTC 日收盤（TWD 直取，免換匯），給大盤對照用。
// Demo API 歷史資料上限 365 天：更早的區間 chart 端會顯示成晚起的序列
// （逐序列基準 + 缺口橋接已處理），誠實呈現資料斷層而不是硬補。
export async function fetchBtcDailyCloseTwd(
  startDate: string,
): Promise<{ date: string; close: number }[]> {
  if (!startDate) return [];
  try {
    const spanDays = Math.ceil(
      (Date.now() - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
    );
    const days = Math.max(1, Math.min(spanDays + 1, 365));
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=twd&days=${days}&interval=daily`;
    const res = await fetchWithRetry(url, {
      headers: { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_KEY ?? "" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { prices?: [number, number][] };
    const out = new Map<string, number>();
    for (const [ms, price] of json.prices ?? []) {
      if (!Number.isFinite(price)) continue;
      // 同一天多筆取最後一筆（當日 close）
      out.set(new Date(ms).toISOString().slice(0, 10), price);
    }
    return [...out.entries()]
      .map(([date, close]) => ({ date, close }))
      .filter((r) => r.date >= startDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}
