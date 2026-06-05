import type { PriceProvider } from "./types";
import { fetchWithRetry } from "./http";

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
