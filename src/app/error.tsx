"use client";

import { useEffect } from "react";
import Link from "next/link";

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
    <main id="main" tabIndex={-1} className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--c-page)] p-6 text-center">
      <p className="font-serif text-3xl font-semibold tracking-tight text-[var(--c-text)]">
        出了點問題
      </p>
      <p className="max-w-md text-sm text-[var(--c-muted)]">
        {/* production 不外洩內部錯誤細節（訊息可能含 SQL / API 資訊），
            開發環境才直出 message 方便除錯；digest 是不透明代碼，
            保留給使用者回報時對 Sentry 事件用。 */}
        {process.env.NODE_ENV === "development"
          ? error.message || "未知錯誤"
          : "暫時無法載入，請稍後再試。"}
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-[var(--c-faint)]">
          digest: {error.digest}
        </p>
      )}
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn btn-primary"
        >
          重試
        </button>
        <Link
          href="/"
          className="btn btn-outline"
        >
          回首頁
        </Link>
      </div>
    </main>
  );
}
