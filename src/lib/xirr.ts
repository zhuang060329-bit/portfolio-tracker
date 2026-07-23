// 簡易 XIRR（金額加權年化報酬率）。
// 給定 [{ amount, when }] 序列，回傳年化報酬率（小數，0.0832 = 8.32%）。
// 先用 Newton-Raphson 迭代解 NPV(r) = 0；Newton 未收斂時退回二分法。
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
      break;
    }
    rate = next;
  }
  // 收斂檢核：不論從哪條路徑離開迴圈，rate 必須真的是根。
  // 迭代步長收斂 ≠ NPV 歸零（震盪、平坦導數、跑滿 100 次都可能留下殘值），
  // 顯示一個「看起來正常的殘值年化」比顯示「—」更糟 → 未通過一律回 null。
  const scale = cleaned.reduce((s2, f) => s2 + Math.abs(f.amount), 0);
  if (withinResidual(cleaned, rate, scale)) return rate;

  // Fallback：Newton 未通過殘差檢核（震盪 / 起點不良）時，改用二分法在變號區間求根。
  // 概念取自 Portfolio Performance 的 IRR（先夾出變號區間再收斂），此處為獨立實作，未複製其程式碼。
  // 二分法結果仍須通過同一條殘差檢核，通不過一律回 null——絕不讓殘值漏出。
  const bracketed = bisectXirr(cleaned);
  if (bracketed !== null && withinResidual(cleaned, bracketed, scale)) {
    return bracketed;
  }
  return null;
}

// 殘差檢核：rate 必須使 |NPV(rate)| 小到相對現金流規模可忽略，才算真正的根。
function withinResidual(flows: Cashflow[], rate: number, scale: number): boolean {
  return Number.isFinite(rate) && Math.abs(npv(flows, rate)) <= scale * 1e-6;
}

// 二分法求根：先掃描候選利率找出第一組 NPV 變號的相鄰區間，再在該區間二分收斂。
// 只在 Newton fallback 路徑執行，成本（數百次 NPV 估值）可接受。
// 找不到變號區間（根落在 double 無法表示的極端處，例如報酬貼近 -100%）時回 null。
function bisectXirr(flows: Cashflow[]): number | null {
  // 下限貼近 -1（1+r 不可為 0 或負）；近根區細掃，遠端粗掃涵蓋短期高年化情境。
  const LOWER = -0.999999;
  let prevRate = LOWER;
  let prevVal = npv(flows, LOWER);
  if (prevVal === 0) return LOWER;

  const scan = (from: number, to: number, step: number): number | null => {
    for (let r = from; r <= to; r += step) {
      const v = npv(flows, r);
      if (!Number.isFinite(v)) {
        prevRate = r;
        prevVal = v;
        continue;
      }
      if (v === 0) return r;
      if (Number.isFinite(prevVal) && Math.sign(v) !== Math.sign(prevVal)) {
        return bisect(flows, prevRate, r);
      }
      prevRate = r;
      prevVal = v;
    }
    return null;
  };

  const near = scan(-0.99, 5, 0.01);
  return near !== null ? near : scan(5, 1000, 1);
}

// 在已知 NPV 於兩端變號的區間 [a, b] 內二分逼近根。
function bisect(flows: Cashflow[], a: number, b: number): number {
  let lo = a;
  let hi = b;
  let fLo = npv(flows, lo);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(flows, mid);
    if (fMid === 0 || hi - lo < 1e-12) return mid;
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}
