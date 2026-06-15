/**
 * 進階績效指標：TWR / 最大回撤 / Sharpe。
 *
 * 為什麼這些指標跟 XIRR 並列：
 * - XIRR 是現金流加權報酬，反映「實際投入的這筆錢賺了多少 %/年」。
 *   缺點：時機影響大；同樣的策略，加碼時間不同 XIRR 會差很多。
 * - TWR (Time-Weighted Return) 把現金流影響剔除，反映「策略本身好不好」，
 *   是 fund manager 用的標準。比 XIRR 更能回答「我選股有沒有意義」。
 * - 最大回撤：歷史高點到後續低點的最大跌幅，告訴你「最壞時痛多深」。
 * - Sharpe：超額報酬除以波動度。同樣 10% 報酬，波動大 vs 波動小，意義不同。
 */

export type Snapshot = { date: string; value: number };
export type Cashflow = { date: string; amount: number };

/**
 * TWR 算法：
 * - 對每個有現金流的日期 d，把該區間 [前一個觀察點, d] 拆成兩段：
 *   - 前段報酬 = (value_at_d_before_cashflow / value_at_prev) - 1
 *   - 其中 value_at_d_before_cashflow = value_at_d - cashflow_at_d
 *     （因為 snapshot 已經包含當天的現金流在內）
 * - 把所有子區間 (1 + r_i) 連乘 - 1 = TWR
 * - 年化：(1 + TWR)^(365.25 / spanDays) - 1
 *
 * 回傳 null：snapshot 不足 2 筆，或計算過程出現除以 0 / 非有限值。
 */
export function computeTwr(
  snapshots: Snapshot[],
  cashflows: Cashflow[],
): { total: number; annualized: number } | null {
  if (snapshots.length < 2) return null;

  // 把現金流按日期 group up
  const cfByDate = new Map<string, number>();
  for (const c of cashflows) {
    cfByDate.set(c.date, (cfByDate.get(c.date) ?? 0) + c.amount);
  }

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  let product = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].value;
    const cur = sorted[i].value;
    const cf = cfByDate.get(sorted[i].date) ?? 0;
    // 當天 snapshot 已含現金流；要算「市場帶來的變化」需先把現金流扣掉
    const curEx = cur - cf;
    if (!Number.isFinite(prev) || prev <= 0) return null;
    const r = curEx / prev;
    if (!Number.isFinite(r) || r <= 0) return null;
    product *= r;
  }
  const total = product - 1;

  // 年化
  const firstDate = sorted[0].date;
  const lastDate = sorted[sorted.length - 1].date;
  const days =
    (new Date(lastDate).getTime() - new Date(firstDate).getTime()) /
    86_400_000;
  if (days <= 0) return { total, annualized: total };
  const annualized = Math.pow(1 + total, 365.25 / days) - 1;
  return { total, annualized };
}

/**
 * 最大回撤：從歷史高點跌到後續最低點的最大跌幅。
 * 回傳百分比（負數）+ 高點/低點日期。
 */
export function computeMaxDrawdown(snapshots: Snapshot[]): {
  pct: number;
  peakDate: string;
  troughDate: string;
} | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  let peak = sorted[0].value;
  let peakDate = sorted[0].date;
  let maxDd = 0;
  let mdPeakDate = sorted[0].date;
  let mdTroughDate = sorted[0].date;
  for (const s of sorted) {
    if (s.value > peak) {
      peak = s.value;
      peakDate = s.date;
    }
    if (peak > 0) {
      const dd = (s.value - peak) / peak;
      if (dd < maxDd) {
        maxDd = dd;
        mdPeakDate = peakDate;
        mdTroughDate = s.date;
      }
    }
  }
  if (maxDd === 0) return null;
  return { pct: maxDd, peakDate: mdPeakDate, troughDate: mdTroughDate };
}

/**
 * 日報酬序列（已剔除現金流影響，用 TWR 的子報酬邏輯）。
 */
export function dailyReturns(
  snapshots: Snapshot[],
  cashflows: Cashflow[],
): number[] {
  const cfByDate = new Map<string, number>();
  for (const c of cashflows) {
    cfByDate.set(c.date, (cfByDate.get(c.date) ?? 0) + c.amount);
  }
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const rs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].value;
    const cur = sorted[i].value;
    const cf = cfByDate.get(sorted[i].date) ?? 0;
    if (!Number.isFinite(prev) || prev <= 0) continue;
    const r = (cur - cf) / prev - 1;
    if (Number.isFinite(r)) rs.push(r);
  }
  return rs;
}

/**
 * 逐日累積 TWR 指數序列，從 100 出發。
 * 用於績效對照圖：排除現金流（入金/出金）影響，純反映市場報酬。
 * 不同於 computeTwr（返回單一彙總值），此函式返回每日索引，直接餵給圖表。
 *
 * 每個快照區間 (prevDate, curDate] 的子期間報酬：
 *   cfSum = 該區間內所有現金流之和（入金日不一定有 snapshot）
 *   curEx = curSnapshot.value - cfSum   ← 還原「市場帶來的淨值」
 *   r     = curEx / prevSnapshot.value
 *
 * 若 prev <= 0 或 r <= 0 或不是有限數，跳過該期（維持現有乘積）。
 * 回傳陣列長度 = snapshots 長度；空輸入回傳 []。
 */
export function buildTwrSeries(
  snapshots: Snapshot[],
  cashflows: Cashflow[],
): { date: string; index: number }[] {
  if (snapshots.length < 1) return [];
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  // 排序現金流以支援 O(N+M) 的區間掃描
  const cfSorted = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));

  const result: { date: string; index: number }[] = [
    { date: sorted[0].date, index: 100 },
  ];
  let product = 1;
  // cfPtr：指向下一個待分配現金流；初始化時跳過第一個 snapshot 日（含）之前的現金流
  let cfPtr = 0;
  while (cfPtr < cfSorted.length && cfSorted[cfPtr].date <= sorted[0].date) {
    cfPtr++;
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].value;
    const cur = sorted[i].value;
    const curDate = sorted[i].date;

    // 累加 (prevDate, curDate] 內所有現金流
    // 不變量：cfPtr 永遠指向 date > sorted[i-1].date 的第一筆 CF
    let cfSum = 0;
    while (cfPtr < cfSorted.length && cfSorted[cfPtr].date <= curDate) {
      cfSum += cfSorted[cfPtr].amount;
      cfPtr++;
    }

    const curEx = cur - cfSum;
    if (Number.isFinite(prev) && prev > 0) {
      const r = curEx / prev;
      if (Number.isFinite(r) && r > 0) product *= r;
    }
    result.push({ date: curDate, index: product * 100 });
  }
  return result;
}

/**
 * Benchmark forward-fill：benchmark 只在交易日有報價，週末/假日缺值。
 * 對 `keys` 的每個欄位，在第一個有效值之後，將缺值日填入上一個有效值，
 * 避免圖表折線斷裂。原地修改 series，第一個有效值之前不填補。
 */
export function forwardFillBenchmarks(
  series: { [key: string]: number | string | undefined }[],
  keys: string[],
): void {
  const carry = new Map<string, number>();
  for (const pt of series) {
    for (const k of keys) {
      const v = pt[k];
      if (typeof v === "number") {
        carry.set(k, v);
      } else if (carry.has(k)) {
        pt[k] = carry.get(k);
      }
    }
  }
}

/**
 * Sharpe ratio（年化）。
 * - 用每日 return 序列算平均與標準差
 * - 假設一年 252 個交易日
 * - rfAnnual 為年化無風險利率（小數，如 0.015 代表 1.5%）
 *
 * 回傳 null：樣本不足或波動度為 0。
 */
export function computeSharpe(
  snapshots: Snapshot[],
  cashflows: Cashflow[],
  rfAnnual: number,
): number | null {
  const rs = dailyReturns(snapshots, cashflows);
  if (rs.length < 5) return null; // 太少樣本沒意義
  const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
  const variance =
    rs.reduce((s, r) => s + (r - mean) ** 2, 0) / (rs.length - 1);
  const stdDaily = Math.sqrt(variance);
  if (stdDaily <= 0) return null;
  const rfDaily = rfAnnual / 252;
  const sharpeAnn = ((mean - rfDaily) / stdDaily) * Math.sqrt(252);
  if (!Number.isFinite(sharpeAnn)) return null;
  return sharpeAnn;
}
