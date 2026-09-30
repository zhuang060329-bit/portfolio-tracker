/**
 * 含息序列：把配息與分割還原進日收盤，得到一條沒有除息缺口、沒有分割斷層的序列。
 * 純函式、不抓資料。定期定額的級距計算（dca-tiers.ts）吃的是這條序列。
 *
 * 為什麼不能直接用原始收盤：
 * - 分割會留下斷層。0050 在 2025-06-18 一拆四，原始收盤從 188.65 掉到 47.16，
 *   直接算前高回撤會得到 -45%，被判成最深的加碼級距。
 * - 除息會留下缺口。不還原的話 200 日均線偏高，乖離率被低估
 *   （2026-09-30 的 0050：不還原 25.21%，還原後 25.95%）。
 *
 * 還原方式是「配息在除息日收盤再投入」的總報酬：
 *   除息日之前的每個收盤 × 除息日收盤 ÷（除息日收盤 + 配息）
 * 這個算法是對照 TradingView 指標「DCA 七級距加減碼 v2（含息序列）」選的：
 * 2026-09-30 的 0050 面板顯示高於 200MA 25.95%，本式算出 25.9469%；
 * 另一種常見算法（前收 − 配息）÷ 前收 算出 25.9702%，對不上。
 *
 * 序列是向後還原的：最後一列等於實際收盤，越早的列被調整得越多。
 * 所以只能拿來算比例（回撤、乖離），不能當成歷史成交價。
 */

export type DailyClose = { date: string; close: number };

/** 每股配發金額，單位是除息日當時的股（分割前的配息就是分割前的金額）。 */
export type DividendEvent = { date: string; amount: number };

/** ratio = 分割後參考價 ÷ 分割前收盤。一拆四是 0.25，反分割大於 1。 */
export type SplitEvent = { date: string; ratio: number };

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/** 第一個日期 >= target 的列；沒有就回 -1。rows 需由舊到新。 */
function firstIndexOnOrAfter(rows: DailyClose[], target: string): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].date < target) lo = mid + 1;
    else hi = mid;
  }
  return lo < rows.length ? lo : -1;
}

export function buildTotalReturnSeries(
  prices: DailyClose[],
  dividends: DividendEvent[],
  splits: SplitEvent[],
): DailyClose[] {
  const rows = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length === 0) return [];

  // boundary[i]：套用在「第 i 列之前」所有列的因子。
  const boundary = new Array<number>(rows.length).fill(1);

  for (const split of splits) {
    if (!isPositive(split.ratio)) continue;
    const i = firstIndexOnOrAfter(rows, split.date);
    // 事件晚於最後一列（今天除權息但收盤還沒進來）或早於第一列：沒有列需要調整。
    if (i <= 0) continue;
    boundary[i] *= split.ratio;
  }

  for (const dividend of dividends) {
    if (!isPositive(dividend.amount)) continue;
    const i = firstIndexOnOrAfter(rows, dividend.date);
    if (i <= 0) continue;
    const exClose = rows[i].close;
    boundary[i] *= exClose / (exClose + dividend.amount);
  }

  const adjusted = new Array<DailyClose>(rows.length);
  let factor = 1;
  for (let i = rows.length - 1; i >= 0; i--) {
    adjusted[i] = { date: rows[i].date, close: rows[i].close * factor };
    factor *= boundary[i];
  }
  return adjusted;
}
