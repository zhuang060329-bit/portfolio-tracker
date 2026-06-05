// Next 16 client instrumentation：在瀏覽器啟動時跑。
// 沒設 NEXT_PUBLIC_SENTRY_DSN 就不 init。
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // 預設不開 Session Replay（會送大量資料）；要的話自行加入 replaysSessionSampleRate
    enabled: process.env.NODE_ENV === "production",
  });
}
