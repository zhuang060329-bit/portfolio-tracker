"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AUTH_MAIN, AuthCard } from "@/components/AuthCard";

// 全域錯誤邊界。Next 16 要求 client component。
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // client error boundary 需在此主動送出 Sentry event（onRequestError 只捕捉 server-side）
    console.error("App error boundary:", error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      // 同樣走動態 import。靜態的話整包 SDK 會進每頁必載的底座，
      // 而這條路徑只有真的出錯才會踩到。錯誤邊界已經渲染出來了，
      // 晚幾十毫秒送出報告不影響使用者看到的東西。
      void import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(error);
      });
    }
  }, [error]);

  return (
    <main id="main" tabIndex={-1} className={AUTH_MAIN}>
      <AuthCard
        label="錯誤"
        title="出了點問題"
        sub={
          /* production 不外洩內部錯誤細節（訊息可能含 SQL / API 資訊），
             開發環境才直出 message 方便除錯；digest 是不透明代碼，
             保留給使用者回報時對 Sentry 事件用。 */
          process.env.NODE_ENV === "development"
            ? error.message || "未知錯誤"
            : "暫時無法載入，請稍後再試。"
        }
        footer={
          error.digest ? <span className="font-mono tnum">digest: {error.digest}</span> : undefined
        }
      >
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={reset} className="btn btn-primary btn-lg flex-1">
            重試
          </button>
          <Link href="/" className="btn btn-outline btn-lg flex-1">
            回首頁
          </Link>
        </div>
      </AuthCard>
    </main>
  );
}
