// Next 16 client instrumentation：在瀏覽器啟動時跑。
// 沒設 NEXT_PUBLIC_SENTRY_DSN 就不 init。
//
// 用動態 import 而不是靜態 import：`import * as Sentry` 會把整包 SDK
// 拉進「每頁必載」的底座 chunk，而且即使這個 if 在建置期就是 false
// （DSN 沒設）也照樣打包——SDK 有 side effect，bundler 不敢 tree-shake。
// 實測底座 244.6 → 168.5 KB gzip，每開一頁都省下 76 KB。
//
// 代價：Sentry 變成非同步載入，瀏覽器剛啟動那一瞬間發生的錯誤可能來不及捕捉。
// 這是個人用的資產追蹤工具，不是要靠 Sentry 抓 cold-start crash 的服務，
// 用可觀測性的一點延遲換每頁 31% 的載入量是划算的。
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      // 預設不開 Session Replay（會送大量資料）；要的話自行加入 replaysSessionSampleRate
      enabled: process.env.NODE_ENV === "production",
    });
  });
}
