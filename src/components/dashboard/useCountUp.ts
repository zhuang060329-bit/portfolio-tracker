"use client";

import { useEffect, useRef, useState } from "react";

// count-up：掛載後從 0 緩動到目標值（cubic ease-out）。
export function useCountUp(target: number, dur = 1100) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    // prefers-reduced-motion 守衛：跳過 rAF，以 setTimeout 非同步設定終值（對齊 settle 模式）
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setVal(target), 0);
      return () => clearTimeout(id);
    }
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setVal(target * ease(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    const settle = setTimeout(() => setVal(target), dur + 80);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(settle);
    };
  }, [target, dur]);
  return val;
}
