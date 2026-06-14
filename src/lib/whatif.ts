/**
 * What-if 模擬：把使用者實際的「投入現金流」拿來，假設全部投入某個 ETF
 * （Buy and Hold），用該日價格買，最後算到今天的市值。
 *
 * 用途：回答「如果我早期全部 ALL-In 0050 / VT 會不會比較好？」這類問題。
 *
 * 簡化假設：
 * - 只模擬「投入」(cashflow < 0)；配息、賣出當作沒發生
 *   （等同 buy-and-hold，配息留在組合內 reinvest 是另一條路線，暫不做）
 * - 用當日 close 成交，沒考慮交易成本與滑價
 * - 如果某天沒 ETF 報價（週末/假日），向前找最近一個有報價的交易日
 */

export type CashflowIn = { date: string; amount: number };
export type DailyClose = { date: string; close: number };

export type SimResult = {
  invested: number; // 累積投入 TWD
  finalValue: number; // 模擬最終值 TWD
  shares: number; // 累積股數
  returnPct: number; // 報酬率（小數）
  skippedCashflows: number; // 因為找不到價格而跳過的投入筆數
};

/**
 * priceAt(date) = 該日 ETF 在 TWD 報價（已含匯率換算）。
 * 找不到當日 → 向前找最近一筆。
 */
function findPriceOnOrBefore(
  sortedPrices: DailyClose[],
  date: string,
): number | null {
  // sortedPrices 為日期由舊到新；用線性掃描（一般 < 2000 筆）
  let last: number | null = null;
  for (const p of sortedPrices) {
    if (p.date <= date) last = p.close;
    else break;
  }
  return last;
}

/**
 * 模擬把所有 invested cashflow 都換成 ETF。
 * - cashflows: 使用者所有 cashflow_twd 紀錄（負數為投入、正數為拿回）。
 * - priceSeries: ETF 每日 TWD 報價（已含匯率，由舊到新排序）。
 * - latestPrice: ETF 最新 TWD 報價（用來算 final value，若 null 就用最後一筆 series）。
 */
export function simulateBuyAndHold(
  cashflows: CashflowIn[],
  priceSeries: DailyClose[],
  latestPrice?: number,
): SimResult {
  const sorted = [...priceSeries].sort((a, b) => a.date.localeCompare(b.date));
  let shares = 0;
  let invested = 0;
  let skipped = 0;

  for (const cf of cashflows) {
    if (cf.amount >= 0) continue; // 只看「投入」（負現金流）
    const investThisTime = Math.abs(cf.amount);
    const price = findPriceOnOrBefore(sorted, cf.date);
    if (!price || price <= 0) {
      skipped++;
      continue;
    }
    shares += investThisTime / price;
    invested += investThisTime;
  }

  const finalPx =
    latestPrice && latestPrice > 0
      ? latestPrice
      : (sorted[sorted.length - 1]?.close ?? 0);
  const finalValue = shares * finalPx;
  const returnPct = invested > 0 ? (finalValue - invested) / invested : 0;
  return {
    invested,
    finalValue,
    shares,
    returnPct,
    skippedCashflows: skipped,
  };
}

/**
 * 計算實際組合的歷史報酬率，正確納入賣出收益與配息。
 *
 * 現金流符號：負 = 買入（投入），正 = 賣出 / 配息 / 利息（收回）。
 * returnPct = (currentValue + totalReceived − totalInvested) / totalInvested
 * 若 totalInvested = 0（無任何買入記錄）回傳 0，避免除以零。
 */
export function calculateActualReturnPct({
  currentValue,
  cashflows,
}: {
  currentValue: number;
  cashflows: CashflowIn[];
}): number {
  const totalInvested = cashflows
    .filter((c) => c.amount < 0)
    .reduce((sum, c) => sum + Math.abs(c.amount), 0);
  if (totalInvested <= 0) return 0;
  const totalReceived = cashflows
    .filter((c) => c.amount > 0)
    .reduce((sum, c) => sum + c.amount, 0);
  return (currentValue + totalReceived - totalInvested) / totalInvested;
}
