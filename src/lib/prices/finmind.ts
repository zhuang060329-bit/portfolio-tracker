import type { PriceProvider } from "./types";
import { fetchWithRetry } from "./http";

/**
 * 台股歷史日 close。給績效對照與 What-if 模擬用。
 * 1 小時 cache；失敗回空陣列由呼叫端 fallback。
 */
export async function fetchTwDailyClose(
  symbol: string,
  startDate: string,
): Promise<{ date: string; close: number }[]> {
  if (!startDate) return [];
  try {
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${encodeURIComponent(
      symbol,
    )}&start_date=${startDate}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.FINMIND_TOKEN ?? ""}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: { date: string; close: number }[];
    };
    return (json.data ?? []).filter((r) => Number.isFinite(Number(r.close)));
  } catch {
    return [];
  }
}

// 台股：FinMind TaiwanStockPrice。回傳 TWD，免換匯。
// symbol 為台股代號（如 2330）。取期間內最後一筆的 close。
export const finmindProvider: PriceProvider = {
  market: "tw",
  async getQuote(symbol) {
    const start = new Date(Date.now() - 14 * 86400000)
      .toISOString()
      .slice(0, 10);
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${encodeURIComponent(
      symbol,
    )}&start_date=${start}`;
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${process.env.FINMIND_TOKEN}` },
    });
    const json = await res.json();
    const rows = json?.data;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`FinMind 找不到台股 ${symbol} 資料（代號是否正確？）`);
    }
    const last = rows[rows.length - 1];
    const price = Number(last.close);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`FinMind ${symbol} close 異常`);
    }
    return {
      unitPrice: price,
      nativeCurrency: "TWD",
      fxToBase: 1,
      asOf: `${last.date}T00:00:00+08:00`,
    };
  },
};
