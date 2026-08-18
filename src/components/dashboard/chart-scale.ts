/**
 * 圖表座標軸刻度。純函式，與 DOM 無關。
 *
 * 改這支的動機：兩張折線圖原本都用 `[0,.25,.5,.75,1].map(t => lo + t*(hi-lo))`，
 * 也就是把資料範圍五等分。刻度因此落在 92.3萬 / 100.4萬 / 108.5萬 / 116.6萬 / 124.7萬
 * 這種位置，間距要現場心算，軸失去「一眼看出高低」的作用。
 * 改成 nice number：刻度一律落在 1 / 2 / 5 × 10ⁿ 的倍數上。
 */

/**
 * 把一個區間長度收斂到「好看的」數字：1、2、5、10 × 10ⁿ。
 *
 * round=false 取不小於 range 的那一級（用來決定整體跨距）；
 * round=true 取最接近的那一級（用來決定刻度間距，容許略小於理想值）。
 */
function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let nice: number;
  if (round) {
    if (fraction < 1.5) nice = 1;
    else if (fraction < 3) nice = 2;
    else if (fraction < 7) nice = 5;
    else nice = 10;
  } else {
    if (fraction <= 1) nice = 1;
    else if (fraction <= 2) nice = 2;
    else if (fraction <= 5) nice = 5;
    else nice = 10;
  }
  return nice * 10 ** exponent;
}

/** 浮點累加會讓 0.1 級距長出 1.0000000000000002，刻度標籤會露餡。 */
function tidy(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(value.toFixed(Math.min(20, decimals)));
}

export type Scale = { lo: number; hi: number; ticks: number[] };

/**
 * 依資料上下限算出刻度與繪圖區的值域。
 *
 * 回傳的 `lo` / `hi` 就是首尾刻度，所以線一定畫在最低與最高格線之間，
 * 不會像原本那樣「軸的兩端各留 12% 空白、但那段空白沒有任何刻度」。
 * 進來前先給 5% 呼吸空間再吸附到刻度上，避免資料極值正好貼齊格線。
 *
 * @param targetCount 期望的刻度數，實際數量會因吸附而略有出入。
 */
export function niceTicks(min: number, max: number, targetCount = 5): Scale {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { lo: 0, hi: 1, ticks: [0, 1] };
  }
  if (min > max) [min, max] = [max, min];

  // 全平的序列（每天都同一個值）沒有跨距可分，自己撐開一段。
  if (max - min < Number.EPSILON * Math.max(1, Math.abs(max))) {
    const span = Math.abs(max) > 0 ? Math.abs(max) * 0.05 : 1;
    min -= span;
    max += span;
  }

  const breathe = (max - min) * 0.05;
  const rawLo = min - breathe;
  const rawHi = max + breathe;

  const count = Math.max(2, Math.round(targetCount));
  const span = niceNum(rawHi - rawLo, false);
  const step = niceNum(span / (count - 1), true);
  const lo = Math.floor(rawLo / step) * step;
  const hi = Math.ceil(rawHi / step) * step;

  const ticks: number[] = [];
  // 用索引乘法而不是累加，否則 step 為 0.1 這類值時誤差會累積。
  const total = Math.round((hi - lo) / step);
  for (let i = 0; i <= total; i += 1) ticks.push(tidy(lo + i * step, step));

  return { lo: tidy(lo, step), hi: tidy(hi, step), ticks };
}

/**
 * 挑 X 軸要標日期的資料索引。頭尾一定入選，中間平均分佈。
 *
 * 原本寫死頭／中／尾三個，6 個月的區間等於只有三個定位點，
 * 中間任何一天都無法對回日期。標籤數量改由可用寬度決定。
 */
export function pickTickIndices(length: number, maxLabels: number): number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];
  const slots = Math.max(2, Math.min(Math.floor(maxLabels), length));
  const picked: number[] = [];
  for (let i = 0; i < slots; i += 1) {
    const index = Math.round((i / (slots - 1)) * (length - 1));
    if (picked[picked.length - 1] !== index) picked.push(index);
  }
  return picked;
}

/**
 * 依繪圖區寬度決定塞得下幾個日期標籤。
 *
 * 「02/17」在 10px 字級下約 30px 寬，每 90px 一個中心點還有三倍間隙，
 * 不會相撞。上限 7 個是為了不讓寬螢幕的軸變成密密麻麻的日期帶。
 */
export function labelCapacity(plotWidth: number): number {
  return Math.max(2, Math.min(7, Math.floor(plotWidth / 90)));
}

/**
 * 軸刻度專用的緊湊格式。
 *
 * 與 `lib/format.ts` 的 `fmtCompact` 差別只在尾隨的 `.0`：那支刻意保留一位小數，
 * 是為了擋「相鄰刻度四捨五入後塌成同一個字串」（見 D2）。改用 nice number 之後
 * 刻度之間至少差一個 step，本質上不可能塌，於是這裡把沒有意義的 `.0` 去掉，
 * 讓軸讀起來是「120萬 / 110萬 / 100萬」而不是「120.0萬 / 110.0萬」。
 * fmtCompact 仍供圓環中心與被動收入使用，不受影響。
 */
export function fmtAxisValue(n: number): string {
  const abs = Math.abs(n);
  const minus = n < 0 ? "−" : "";
  const trim = (s: string) => (s.includes(".") ? s.replace(/\.?0+$/, "") : s);
  if (abs >= 1e8) return minus + trim((abs / 1e8).toFixed(2)) + "億";
  if (abs >= 1e4) {
    const wan = abs / 1e4;
    const str = wan >= 1000 ? Math.round(wan).toLocaleString("en-US") : trim(wan.toFixed(1));
    return minus + str + "萬";
  }
  return minus + trim(abs.toFixed(1));
}
