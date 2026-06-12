"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

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
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--c-page)] p-6 text-center">
      <p className="font-serif text-3xl font-semibold tracking-tight text-[var(--c-text)]">
        出了點問題
      </p>
      <p className="max-w-md text-sm text-[var(--c-muted)]">
        {error.message || "未知錯誤"}
      </p>
      {error.digest && (
        <p className="text-[10px] font-mono text-[var(--c-faint)]">
          digest: {error.digest}
        </p>
      )}
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-sm bg-[var(--c-accent)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          重試
        </button>
        <Link
          href="/"
          className="rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-2 text-sm text-[var(--c-text)] hover:bg-[var(--c-page)]"
        >
          回首頁
        </Link>
      </div>
    </main>
  );
}
