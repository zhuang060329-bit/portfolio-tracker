import { describe, expect, it } from "vitest";
import { squarify, targetBoundary, type Rect } from "./treemap";

const BOX: Rect = { x: 0, y: 0, w: 150, h: 100 };
const area = (r: Rect) => r.w * r.h;
const EPS = 1e-9;

function overlaps(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.w - EPS &&
    b.x < a.x + a.w - EPS &&
    a.y < b.y + b.h - EPS &&
    b.y < a.y + a.h - EPS
  );
}

describe("squarify", () => {
  // 展示資料的五類比例
  const demo = [36.8, 21.5, 20.1, 16.0, 5.7];

  it("每塊面積精確等於比例", () => {
    const rects = squarify(demo, BOX);
    const total = demo.reduce((a, b) => a + b, 0);
    rects.forEach((r, i) => {
      expect(area(r)).toBeCloseTo((demo[i] / total) * area(BOX), 9);
    });
  });

  it("全部落在框內、兩兩不重疊、合起來鋪滿", () => {
    const rects = squarify(demo, BOX);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(BOX.x - EPS);
      expect(r.y).toBeGreaterThanOrEqual(BOX.y - EPS);
      expect(r.x + r.w).toBeLessThanOrEqual(BOX.x + BOX.w + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(BOX.y + BOX.h + 1e-6);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i], rects[j])).toBe(false);
      }
    }
    const sum = rects.reduce((s, r) => s + area(r), 0);
    expect(sum).toBeCloseTo(area(BOX), 6);
  });

  it("回傳順序跟輸入一致，不受內部排序影響", () => {
    const shuffled = [5.7, 36.8, 16.0, 21.5, 20.1];
    const rects = squarify(shuffled, BOX);
    const total = shuffled.reduce((a, b) => a + b, 0);
    rects.forEach((r, i) => {
      expect(area(r)).toBeCloseTo((shuffled[i] / total) * area(BOX), 9);
    });
  });

  it("地塊不會切成細條：展示資料最扁的一塊長寬比在 3 以內", () => {
    const rects = squarify(demo, BOX);
    for (const r of rects) {
      expect(Math.max(r.w / r.h, r.h / r.w)).toBeLessThan(3);
    }
  });

  it("0、負數、NaN 沒有面積，其餘照比例", () => {
    const rects = squarify([60, 0, -5, Number.NaN, 40], BOX);
    expect(area(rects[1])).toBe(0);
    expect(area(rects[2])).toBe(0);
    expect(area(rects[3])).toBe(0);
    expect(area(rects[0])).toBeCloseTo(0.6 * area(BOX), 9);
    expect(area(rects[4])).toBeCloseTo(0.4 * area(BOX), 9);
  });

  it("只有一類時佔滿整框；空陣列或全為 0 時不當掉", () => {
    const [only] = squarify([42], BOX);
    (["x", "y", "w", "h"] as const).forEach((k) => expect(only[k]).toBeCloseTo(BOX[k], 9));
    expect(squarify([], BOX)).toEqual([]);
    expect(squarify([0, 0], BOX).every((r) => area(r) === 0)).toBe(true);
  });

  it("框有位移時座標跟著位移", () => {
    const box = { x: 10, y: 20, w: 150, h: 100 };
    const a = squarify(demo, BOX);
    const b = squarify(demo, box);
    b.forEach((r, i) => {
      expect(r.x).toBeCloseTo(a[i].x + 10, 9);
      expect(r.y).toBeCloseTo(a[i].y + 20, 9);
    });
  });
});

describe("targetBoundary", () => {
  it("實際高於目標：沿長邊切，前段佔 target/actual", () => {
    expect(targetBoundary({ x: 0, y: 0, w: 60, h: 40 }, 20.1, 15)).toEqual({
      axis: "x",
      at: 15 / 20.1,
    });
    expect(targetBoundary({ x: 0, y: 0, w: 30, h: 50 }, 20, 10)).toEqual({
      axis: "y",
      at: 0.5,
    });
  });

  it("實際不高於目標、沒有目標、或地塊沒有面積時不畫", () => {
    const r = { x: 0, y: 0, w: 60, h: 40 };
    expect(targetBoundary(r, 16, 20)).toBeNull();
    expect(targetBoundary(r, 20, 20)).toBeNull();
    expect(targetBoundary(r, 20, 0)).toBeNull();
    expect(targetBoundary({ x: 0, y: 0, w: 0, h: 0 }, 20, 10)).toBeNull();
  });
});
