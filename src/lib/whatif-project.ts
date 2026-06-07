// What-if 未來推算：逐月複利。純名目金額（不計通膨）。
// 起點本金由呼叫端帶入（Phase 7 決議：用目前總淨資產）。

export type ProjPoint = {
  m: number; // 第幾個月（0 = 現在）
  value: number; // 該月淨值
  contributed: number; // 累積投入（起始本金 + 每月投入累加）
};

/**
 * 逐月複利推算。
 * 每月先以月報酬率 r 滾動，再加當月定期投入。
 * @param annualReturn 年化報酬（百分比，例 7 = 7%）
 */
export function project({
  start,
  monthly,
  annualReturn,
  years,
}: {
  start: number;
  monthly: number;
  annualReturn: number;
  years: number;
}): ProjPoint[] {
  const r = annualReturn / 100 / 12;
  const months = Math.round(years * 12);
  const pts: ProjPoint[] = [{ m: 0, value: start, contributed: start }];
  let v = start;
  let c = start;
  for (let m = 1; m <= months; m++) {
    v = v * (1 + r) + monthly;
    c = c + monthly;
    pts.push({ m, value: v, contributed: c });
  }
  return pts;
}

// 淨值序列首次達到 target 的月份；期間內未達成回傳 null。
export function crossMonth(pts: ProjPoint[], target: number): number | null {
  for (const p of pts) if (p.value >= target) return p.m;
  return null;
}
