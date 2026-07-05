// 價格層的抽象介面：三個市場 provider 共同實作的合約。
// 所有價格請求一律在伺服器端執行，金鑰不可進到瀏覽器。
// 三個 provider（coingecko / twelvedata / finmind）實作留到階段 3。

export type Market = "us" | "tw" | "crypto";

export interface PriceQuote {
  unitPrice: number; // 以 nativeCurrency 計價的單位價格
  nativeCurrency: string; // 'USD' | 'TWD'
  fxToBase: number; // nativeCurrency -> base(TWD) 的匯率；台股/加密幣為 1
  asOf: string; // ISO 時間字串
}

export interface PriceProvider {
  market: Market;
  // symbol：美股 ticker（QQQM）、台股代號（2330）、CoinGecko id（bitcoin）
  getQuote(symbol: string, baseCurrency: string): Promise<PriceQuote>;
}
