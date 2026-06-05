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
