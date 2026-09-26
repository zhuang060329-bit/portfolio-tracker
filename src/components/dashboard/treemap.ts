/* 地籍式配置圖的版面計算。純函式，不碰 DOM，方便測。

   演算法是 squarified treemap（Bruls、Huizing、van Wijk，2000）：
   依面積由大到小，一次放一「排」，只要多放一塊會讓該排最扁的那塊更扁就收排，
   剩下的空間繼續切。面積精確等於比例，只有長寬比是盡量逼近正方形。 */

export type Rect = { x: number; y: number; w: number; h: number };

// 一排裡最扁那塊的長寬比（≥1，越接近 1 越方）。side 是這排貼著的那條邊。
function worst(areas: number[], side: number): number {
  const sum = areas.reduce((a, b) => a + b, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  const s2 = side * side;
  const sum2 = sum * sum;
  return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
}

/**
 * 把 values 依比例切進 box。回傳陣列與 values 同順序、同長度。
 * 0、負數、非有限數一律視為沒有面積，回傳寬高 0 的矩形（位置在 box 左上角）。
 */
export function squarify(values: number[], box: Rect): Rect[] {
  const out: Rect[] = values.map(() => ({ x: box.x, y: box.y, w: 0, h: 0 }));
  const valid = (v: number) => Number.isFinite(v) && v > 0;
  const total = values.reduce((sum, v) => (valid(v) ? sum + v : sum), 0);
  if (!(total > 0) || !(box.w > 0) || !(box.h > 0)) return out;

  const scale = (box.w * box.h) / total;
  const area = values.map((v) => (valid(v) ? v * scale : 0));
  // 由大到小放，排出來的地塊最方。同面積時照原順序，結果才穩定。
  const order = values
    .map((_, i) => i)
    .filter((i) => area[i] > 0)
    .sort((a, b) => area[b] - area[a] || a - b);

  let rest: Rect = { ...box };

  const place = (row: number[]) => {
    const sum = row.reduce((s, i) => s + area[i], 0);
    if (rest.w >= rest.h) {
      // 空間偏寬：這一排是貼左邊的一欄，由上往下疊
      const thick = sum / rest.h;
      let y = rest.y;
      for (const i of row) {
        const h = area[i] / thick;
        out[i] = { x: rest.x, y, w: thick, h };
        y += h;
      }
      rest = { x: rest.x + thick, y: rest.y, w: rest.w - thick, h: rest.h };
    } else {
      // 空間偏高：這一排是貼上緣的一列，由左往右排
      const thick = sum / rest.w;
      let x = rest.x;
      for (const i of row) {
        const w = area[i] / thick;
        out[i] = { x, y: rest.y, w, h: thick };
        x += w;
      }
      rest = { x: rest.x, y: rest.y + thick, w: rest.w, h: rest.h - thick };
    }
  };

  let row: number[] = [];
  let k = 0;
  while (k < order.length) {
    const side = Math.min(rest.w, rest.h);
    const next = [...row, order[k]];
    if (
      row.length === 0 ||
      worst(next.map((i) => area[i]), side) <= worst(row.map((i) => area[i]), side)
    ) {
      row = next;
      k += 1;
    } else {
      place(row);
      row = [];
    }
  }
  if (row.length) place(row);
  return out;
}

/**
 * 地塊裡的目標邊界。實際比目標多時，地塊沿長邊切成兩段：
 * 前段面積 = 目標，後段是超出目標的部分。
 * 回傳切線在地塊內的位置（0–1，沿 axis 方向），沒有超出時回傳 null。
 * 面積精確：前段佔地塊 target/actual，所以前段面積 = 地塊面積 × target/actual。
 */
export function targetBoundary(
  rect: Rect,
  actual: number,
  target: number,
): { axis: "x" | "y"; at: number } | null {
  if (!(actual > 0) || !(target > 0) || !(target < actual)) return null;
  if (!(rect.w > 0) || !(rect.h > 0)) return null;
  return { axis: rect.w >= rect.h ? "x" : "y", at: target / actual };
}
