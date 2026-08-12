import { describe, expect, it } from "vitest";
import { planFlip } from "./useFlipRows";

/** 方便寫測資：{ key: top } 轉成 Map。 */
function tops(record: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(record));
}

describe("planFlip：delta 方向", () => {
  it("往上移的列，delta 為正（先壓回下面再放開）", () => {
    // b 從 200 移到 100，視覺上要從「下面 100px 處」滑上來。
    const moves = planFlip(tops({ a: 100, b: 200 }), tops({ a: 200, b: 100 }));
    expect(moves).toContainEqual({ key: "b", delta: 100 });
  });

  it("往下移的列，delta 為負", () => {
    const moves = planFlip(tops({ a: 100, b: 200 }), tops({ a: 200, b: 100 }));
    expect(moves).toContainEqual({ key: "a", delta: -100 });
  });

  it("兩列互換時兩列都要動", () => {
    const moves = planFlip(tops({ a: 100, b: 200 }), tops({ a: 200, b: 100 }));
    expect(moves).toHaveLength(2);
  });
});

describe("planFlip：不該動的情況", () => {
  it("完全沒動的列不進清單", () => {
    expect(planFlip(tops({ a: 100, b: 200 }), tops({ a: 100, b: 200 }))).toEqual(
      [],
    );
  });

  it("位移小於 1px 視為沒動", () => {
    // 次像素抖動（例如捲軸出現造成的重排）不值得播動畫。
    expect(planFlip(tops({ a: 100 }), tops({ a: 100.4 }))).toEqual([]);
  });

  it("剛好 1px 就要動", () => {
    expect(planFlip(tops({ a: 100 }), tops({ a: 101 }))).toEqual([
      { key: "a", delta: -1 },
    ]);
  });

  it("這次才出現的列不動畫，避免從畫面外飛進來", () => {
    // 例如按下「查看封存帳戶」後多出來的列。
    const moves = planFlip(tops({ a: 100 }), tops({ a: 150, newcomer: 100 }));
    expect(moves).toEqual([{ key: "a", delta: -50 }]);
  });

  it("消失的列不會被算進去", () => {
    const moves = planFlip(tops({ a: 100, gone: 200 }), tops({ a: 100 }));
    expect(moves).toEqual([]);
  });
});

describe("planFlip：隱藏的那一份 DOM", () => {
  it("display:none 的列 rect 全為 0，算出 0 位移而被略過", () => {
    // 桌面表格與手機卡片同時存在，其中一份被 hidden 關掉。
    // 被關掉那份每一列的 getBoundingClientRect().top 都是 0，
    // 前後相減為 0，靠 MIN_DELTA_PX 自然擋掉，不需要額外的可見性判斷。
    const hidden = tops({ "m-1": 0, "m-2": 0, "m-3": 0 });
    expect(planFlip(hidden, hidden)).toEqual([]);
  });

  it("桌面與手機共用一個 map 時前綴讓兩份互不干擾", () => {
    const first = tops({ "d-1": 100, "d-2": 200, "m-1": 0, "m-2": 0 });
    const last = tops({ "d-1": 200, "d-2": 100, "m-1": 0, "m-2": 0 });
    expect(planFlip(first, last).map((m) => m.key).sort()).toEqual([
      "d-1",
      "d-2",
    ]);
  });
});

describe("planFlip：邊界", () => {
  it("空的前次位置代表沒東西可動", () => {
    expect(planFlip(new Map(), tops({ a: 100 }))).toEqual([]);
  });

  it("空的這次位置也不會炸", () => {
    expect(planFlip(tops({ a: 100 }), new Map())).toEqual([]);
  });
});
