import { fetchWithRetry } from "./http";

// USD -> TWD 匯率。主來源 Twelve Data forex（實測免費版可用）；
// 失敗時退到 FinMind TaiwanExchangeRate（同樣免費）。
export async function getUsdTwdRate(): Promise<number> {
  try {
    return await twelveDataUsdTwd();
  } catch (e) {
    console.warn(
      "Twelve Data USD/TWD 失敗，改用 FinMind 備援：",
      (e as Error).message,
    );
    return await finmindUsdTwd();
  }
}

async function twelveDataUsdTwd(): Promise<number> {
  const url = `https://api.twelvedata.com/price?symbol=USD/TWD&apikey=${process.env.TWELVE_DATA_API_KEY}`;
  const res = await fetchWithRetry(url);
  const json = await res.json();
  const rate = Number(json?.price);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `Twelve Data USD/TWD 回傳異常：${JSON.stringify(json).slice(0, 120)}`,
    );
  }
  return rate;
}

async function finmindUsdTwd(): Promise<number> {
  const start = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanExchangeRate&data_id=USD&start_date=${start}`;
  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${process.env.FINMIND_TOKEN}` },
  });
  const json = await res.json();
  const rows = json?.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("FinMind 匯率無資料");
  }
  const last = rows[rows.length - 1];
  // 用即期買賣中價當 USD->TWD。
  const mid = (Number(last.spot_buy) + Number(last.spot_sell)) / 2;
  if (!Number.isFinite(mid) || mid <= 0) {
    throw new Error("FinMind 匯率欄位異常");
  }
  return mid;
}

/**
 * 歷史 USD/TWD 匯率，依日期由舊到新排序。
 * 用 FinMind TaiwanExchangeRate dataset（免費、有歷史）。
 * 用途：把 SPY/QQQ 的 USD close 換成 TWD 後，才能跟 TWD 估值的組合公平比較。
 * 失敗回空陣列；呼叫端用 forward-fill 補週末/假日缺口。
 */
export async function fetchUsdTwdHistory(
  startDate: string,
): Promise<{ date: string; rate: number }[]> {
  if (!startDate) return [];
  try {
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanExchangeRate&data_id=USD&start_date=${startDate}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.FINMIND_TOKEN ?? ""}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: { date: string; spot_buy: number; spot_sell: number }[];
    };
    const rows = json.data;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r) => ({
        date: r.date,
        rate: (Number(r.spot_buy) + Number(r.spot_sell)) / 2,
      }))
      .filter((r) => Number.isFinite(r.rate) && r.rate > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}
