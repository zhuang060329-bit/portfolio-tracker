"use client";

import { useEffect, useRef, useState } from "react";

/**
 * count-up：掛載時從 0 揭示，之後每次目標值變動都從「目前顯示的數字」過渡到新值。
 *
 * 舊版一律以 0 為起點（`setVal(target * ease(p))`），且 effect 依賴 target，
 * 所以按下「刷新報價」後淨資產會先視覺歸零再花 1.1 秒爬回來。金融數字這樣跳
 * 會讓人以為資產真的掉了。
 *
 * 時長從 1100ms 收到 450ms：這是主要指標，讀到數字的優先級高於揭示效果。
 */
export function useCountUp(target: number, dur = 450) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  // 目前畫面上的值，供下一次動畫當起點。放 ref 是因為它每幀都變，
  // 不該進 effect 的依賴陣列。
  const shownRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    // 目標沒變（含空組合 target=0）就不要啟動動畫。
    if (from === target) return;

    const write = (next: number) => {
      shownRef.current = next;
      setVal(next);
    };

    // prefers-reduced-motion 守衛：跳過 rAF，以 setTimeout 非同步設定終值（對齊 settle 模式）
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => write(target), 0);
      return () => clearTimeout(id);
    }

    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      write(from + (target - from) * ease(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    const settle = setTimeout(() => write(target), dur + 80);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(settle);
    };
  }, [target, dur]);

  return val;
}
