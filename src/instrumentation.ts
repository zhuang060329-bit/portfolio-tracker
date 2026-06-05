// Next 16 register hook：server / edge runtime 啟動時跑一次。
// 沒設 SENTRY_DSN 就不 init，避免無 DSN 警告。
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      // 開發環境不送 event 出去
      enabled: process.env.NODE_ENV === "production",
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      enabled: process.env.NODE_ENV === "production",
    });
  }
}

// Next 16 提供 onRequestError hook，把 server-side 例外送進 Sentry
export const onRequestError = Sentry.captureRequestError;
