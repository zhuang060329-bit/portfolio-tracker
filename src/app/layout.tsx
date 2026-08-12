import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { NONCE_HEADER } from "@/lib/csp";
import { SwRegister } from "@/components/SwRegister";
import { LiveAnnouncer } from "@/components/a11y/LiveAnnouncer";
import localFont from "next/font/local";
import "./globals.css";

/* 字體自架。檔案由 scripts/build-fonts.py 產生並 commit 進 repo，
   建置流程不需要 Python，也不對外抓字體——建置期抓 Noto Sans TC 失敗
   是這次改動要解決的問題。

   三支都是變數字體，一個檔涵蓋整個字重範圍，取代原本各三到四個靜態字重。 */

const fontSerif = localFont({
  src: "./fonts/Newsreader-latin.woff2",
  variable: "--font-serif",
  weight: "200 800",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "serif"],
});

const fontSans = localFont({
  src: "./fonts/SpaceGrotesk-latin.woff2",
  variable: "--font-sans",
  weight: "300 700",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["system-ui", "sans-serif"],
});

/* preload 關掉：這個檔 1.68 MB，preload 會讓它跟關鍵 JS 搶頻寬，
   而 display:swap 本來就會先用系統中文字體把字顯示出來。
   adjustFontFallback 也關掉：那個選項只會拿 Arial / Times 的度量去校正，
   對中文字沒有意義，硬套反而會讓 fallback 期間的字級不對。 */
const fontTc = localFont({
  src: "./fonts/NotoSansTC-big5.woff2",
  variable: "--font-tc",
  weight: "100 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0D0F12" },
    { media: "(prefers-color-scheme: light)", color: "#F1F0EC" },
  ],
};

export const metadata: Metadata = {
  title: "StackWorth",
  description: "個人投資組合追蹤工具",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: {
    capable: true,
    title: "StackWorth",
    statusBarStyle: "default",
  },
};

const themeInit = `(function(){try{
  var pref = localStorage.getItem('themePref') || localStorage.getItem('theme') || 'system';
  if (pref !== 'light' && pref !== 'dark') pref = 'system';
  var resolved = pref === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : pref;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePref = pref;
  document.documentElement.dataset.privacy = localStorage.getItem('privacy') === 'on' ? 'on' : 'off';
}catch(e){
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.dataset.themePref = 'system';
  document.documentElement.dataset.privacy = 'off';
}})();`;

/* 讀 nonce 會讓整個 app 變成動態渲染——這是 nonce 型 CSP 的既定代價
   （Next 官方文件明列：static optimization 與 ISR 停用、CDN 不能快取）。
   改動前有 7 個靜態頁：/login、/methodology、/demo/decisions、/demo/whatif、
   /auth/mfa、/auth/reset-password、/_not-found。 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /* Next 會自動把 nonce 加到框架 script 與它自己產生的 inline script 上，
     但這支主題初始化 script 是手寫的，不在自動範圍內，要自己掛。
     proxy 沒跑到的路徑（見 proxy.ts 的 matcher）拿不到 x-nonce，
     此時為 undefined，React 不會輸出該屬性。 */
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;

  return (
    <html
      lang="zh-Hant"
      suppressHydrationWarning
      className={`${fontSerif.variable} ${fontSans.variable} ${fontTc.variable} h-full antialiased`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* 跳至主內容（WCAG 2.4.1 Bypass Blocks，Level A）。
            導覽列每頁有 7 個項目加通知與帳號，鍵盤使用者換頁都要重 tab 一遍。
            平時視覺隱藏，取得焦點才顯示；目標 <main> 帶 tabIndex={-1}，
            否則 Safari 只會捲動而不移動焦點。 */}
        <a href="#main" className="skip-link">
          跳至主內容
        </a>
        <SwRegister />
        {/* 常駐播報區。動作結果要被螢幕閱讀器唸到，live region 必須先存在於
            無障礙樹裡，所以掛在這裡而不是跟訊息一起條件渲染。 */}
        <LiveAnnouncer />
        {children}
      </body>
    </html>
  );
}
