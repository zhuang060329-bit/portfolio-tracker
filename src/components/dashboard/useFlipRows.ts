"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * FLIP（First-Last-Invert-Play）：排序改變後讓列滑到新位置，而不是瞬間跳位。
 *
 * 兩個刻意的設計：
 *
 * 1. 動畫由 capture() 觸發，不是由資料變動觸發。
 *    持倉列表除了使用者按排序鍵之外，背景刷新報價也會讓市值變、順序跟著重排。
 *    若掛在資料上，刷新報價時整張表會無故滑動。所以只有 setSort 會呼叫 capture()，
 *    呼叫過的下一次 render 才播動畫。
 *
 * 2. 用 Web Animations API 而不是 CSS transition。
 *    transition 需要先寫入 inverted 的 transform、強制 reflow、再清掉才會動，
 *    中間任何一次 React re-render 都可能把那個中繼樣式洗掉。
 *    element.animate() 是一次性的，不碰 inline style，結束後自己回到 none。
 *
 * <tr> 能不能吃 transform 是這個做法的前提，已在 Chrome 148 對實際的持倉表實測：
 * display 為 table-row，套 translateY(40px) 後 getBoundingClientRect().top 正好位移
 * 40px，animate() 中途的 computed transform 是內插出來的 matrix，結束後回 none。
 */

const DURATION_MS = 260;
const EASING = "cubic-bezier(0.2, 0, 0, 1)";

/** 小於這個位移不值得動畫，也順帶擋掉隱藏元素（rect 全為 0）算出的 0 位移。 */
const MIN_DELTA_PX = 1;

/**
 * 比對前後兩次的位置，算出哪些列該動、動多少。
 *
 * 純函式，與 DOM 無關，方便單獨測。delta 是「從哪裡飛過來」：
 * 舊位置減新位置，正值代表這列往上移了，動畫要先把它壓回下面再放開。
 */
export function planFlip<K>(
  first: ReadonlyMap<K, number>,
  last: ReadonlyMap<K, number>,
): { key: K; delta: number }[] {
  const moves: { key: K; delta: number }[] = [];
  for (const [key, to] of last) {
    const from = first.get(key);
    // 這次才出現的列沒有前一個位置，讓它直接就位，不要從畫面外飛進來。
    if (from === undefined) continue;
    const delta = from - to;
    if (Math.abs(delta) < MIN_DELTA_PX) continue;
    moves.push({ key, delta });
  }
  return moves;
}

function prefersReducedMotion(): boolean {
  // WAAPI 動畫不受 globals.css 那段 @media (prefers-reduced-motion) 管轄，
  // 得在 JS 這邊自己擋。寫法對齊 useCountUp。
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useFlipRows<K>() {
  const nodes = useRef(new Map<K, HTMLElement>());
  const running = useRef(new Map<K, Animation>());
  // 非 null 代表「這次 render 之後要播動畫」，播完立刻清掉。
  const firstTops = useRef<Map<K, number> | null>(null);

  /** 掛在每一列上的 ref callback。key 要能穩定識別同一列。 */
  const register = useCallback(
    (key: K) => (node: HTMLElement | null) => {
      if (node) nodes.current.set(key, node);
      else nodes.current.delete(key);
    },
    [],
  );

  /** 在改變排序狀態「之前」呼叫，記下目前每列的位置。 */
  const capture = useCallback(() => {
    if (prefersReducedMotion()) return;
    const tops = new Map<K, number>();
    for (const [key, node] of nodes.current) {
      // 動畫進行中時 rect 讀到的是「畫面上當下」的位置，正是接續動畫要的起點。
      tops.set(key, node.getBoundingClientRect().top);
    }
    firstTops.current = tops;
  }, []);

  // 沒有依賴陣列：每次 render 後都檢查一下有沒有被 arm，沒有就立刻返回。
  useLayoutEffect(() => {
    const first = firstTops.current;
    if (!first) return;
    firstTops.current = null;

    // 先取消進行中的動畫，元素才會回到真正的版面位置。
    // 不取消的話，下面量到的 last 還帶著上一段動畫的位移，delta 會算錯。
    for (const anim of running.current.values()) anim.cancel();
    running.current.clear();

    const last = new Map<K, number>();
    for (const [key, node] of nodes.current) {
      last.set(key, node.getBoundingClientRect().top);
    }

    for (const { key, delta } of planFlip(first, last)) {
      const node = nodes.current.get(key);
      if (!node) continue;
      const anim = node.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
        { duration: DURATION_MS, easing: EASING },
      );
      // cancel 不會觸發 onfinish，而取消時上面已經整個 clear，不會殘留。
      anim.onfinish = () => {
        running.current.delete(key);
      };
      running.current.set(key, anim);
    }
  });

  useEffect(() => {
    const inFlight = running.current;
    return () => {
      for (const anim of inFlight.values()) anim.cancel();
      inFlight.clear();
    };
  }, []);

  return { register, capture };
}
