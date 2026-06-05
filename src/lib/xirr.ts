// 簡易 XIRR（金額加權年化報酬率）。
// 給定 [{ amount, when }] 序列，回傳年化報酬率（小數，0.0832 = 8.32%）。
// 用 Newton-Raphson 迭代解 NPV(r) = 0。
//
// 規則：
// - 必須至少有一筆正 cashflow 與一筆負 cashflow，否則無解（回傳 null）。
// - 一般約定：投入 = 負（錢出帳戶）、回收/配息/賣出收入 = 正（錢入帳戶）。
// - 計算 portfolio 時別忘了在最後加一筆 +當下持倉市值（視為「如果今天全賣會收到」）。

type Cashflow = { amount: number; when: Date };

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

function npv(flows: Cashflow[], rate: number): number {
  const t0 = flows[0].when.getTime();
  let sum = 0;
  for (const f of flows) {
    const years = (f.when.getTime() - t0) / MS_PER_YEAR;
    sum += f.amount / Math.pow(1 + rate, years);
  }
  return sum;
}

function dnpv(flows: Cashflow[], rate: number): number {
  const t0 = flows[0].when.getTime();
  let sum = 0;
  for (const f of flows) {
    const years = (f.when.getTime() - t0) / MS_PER_YEAR;
    sum -= (years * f.amount) / Math.pow(1 + rate, years + 1);
  }
  return sum;
}

export function computeXirr(flows: Cashflow[]): number | null {
  const cleaned = flows.filter(
    (f) => Number.isFinite(f.amount) && f.amount !== 0,
  );
  if (cleaned.length < 2) return null;
  const hasPos = cleaned.some((f) => f.amount > 0);
  const hasNeg = cleaned.some((f) => f.amount < 0);
  if (!hasPos || !hasNeg) return null;

  // 依時間排序，t0 為最早一筆
  cleaned.sort((a, b) => a.when.getTime() - b.when.getTime());

  let rate = 0.1; // 起始猜測 10%
  for (let i = 0; i < 100; i++) {
    const v = npv(cleaned, rate);
    const dv = dnpv(cleaned, rate);
    if (!Number.isFinite(v) || !Number.isFinite(dv) || Math.abs(dv) < 1e-12) {
      break;
    }
    const delta = v / dv;
    let next = rate - delta;
    // 限制下限避免 1+r 變負或 0
    if (next <= -0.9999) next = -0.9999;
    if (Math.abs(next - rate) < 1e-7) {
      rate = next;
      return Number.isFinite(rate) ? rate : null;
    }
    rate = next;
  }
  return Number.isFinite(rate) ? rate : null;
}
