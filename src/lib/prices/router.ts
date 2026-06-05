import type { Market, PriceProvider, PriceQuote } from "./types";
import { coingeckoProvider } from "./coingecko";
import { twelveDataProvider } from "./twelvedata";
import { finmindProvider } from "./finmind";

// 依帳戶的市場類型分派 provider。manual 帳戶不抓價，故不在此。
const providers: Record<Market, PriceProvider> = {
  crypto: coingeckoProvider,
  us: twelveDataProvider,
  tw: finmindProvider,
};

export function getProvider(market: Market): PriceProvider {
  const provider = providers[market];
  if (!provider) {
    throw new Error(`不支援的市場：${market}`);
  }
  return provider;
}

export function getQuote(
  market: Market,
  symbol: string,
  baseCurrency = "TWD",
): Promise<PriceQuote> {
  return getProvider(market).getQuote(symbol, baseCurrency);
}
