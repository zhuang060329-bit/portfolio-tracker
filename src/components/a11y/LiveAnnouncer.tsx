"use client";

import { useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "./live-announcer";

/**
 * 常駐的隱藏播報區，在 layout 掛一次就好。
 *
 * 四個 region：polite / assertive 各兩格，輪流寫入的理由見 live-announcer.ts。
 * 用 sr-only 而非 hidden 或 display:none —— 後兩者會把元素從無障礙樹移除，
 * 螢幕閱讀器就讀不到了。
 */
export function LiveAnnouncer() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {s.politeA}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {s.politeB}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {s.assertiveA}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {s.assertiveB}
      </div>
    </>
  );
}
