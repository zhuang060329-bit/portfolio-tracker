import type { Metadata } from "next";

// 公開 Demo 五頁共用的分享圖，由 scripts/demo-og/render.mjs 用本機 Chrome 截圖產生。
// 不用 opengraph-image 檔案慣例：Next 的 metadata 合併是淺層的，子頁一設 openGraph
// 就整組蓋掉上層，檔案慣例的圖只留在 /demo 本頁，其他四頁的預覽卡沒有圖。
// 相對路徑由 Next 補成絕對網址：Vercel 上取 VERCEL_PROJECT_PRODUCTION_URL（預覽部署取該部署網址），
// 本機取 localhost。
const DEMO_OG_IMAGE = {
  url: "/og/demo.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "StackWorth 公開示範：投資組合追蹤，附近 6 個月淨資產走勢圖",
};

// 公開 Demo 各頁的標題與分享摘要。貼到 LINE / Slack 時預覽卡讀的是 og:title / og:description，
// 不讀 <title>，所以兩組一起給。根 layout 的 robots noindex 照舊沿用，這裡只管分享預覽。
export function demoMetadata(page: string, description: string): Metadata {
  const title = `${page} — StackWorth Demo`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_TW",
      siteName: "StackWorth",
      images: [DEMO_OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [DEMO_OG_IMAGE] },
  };
}
