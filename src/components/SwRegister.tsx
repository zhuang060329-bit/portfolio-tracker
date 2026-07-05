"use client";

import { useEffect } from "react";

// 註冊 service worker（見 public/sw.js：只給離線頁 + 滿足可安裝條件，不快取資料）。
// 只在 production 註冊：dev 下 SW 攔導航會干擾 HMR 與除錯。
export function SwRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 註冊失敗不影響任何功能，靜默即可
    });
  }, []);
  return null;
}
