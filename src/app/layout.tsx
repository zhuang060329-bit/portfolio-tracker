import type { Metadata, Viewport } from "next";
import { SwRegister } from "@/components/SwRegister";
import { Newsreader, Space_Grotesk, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

// Midnight Ledger 字型配置：
// - Newsreader：大數字 / 標題（serif，財經刊物感）
// - Space Grotesk：介面與數字（sans，含 tabular nums feature）
// - Noto Sans TC：中文 fallback（preload=false 避免增加首載 weight）
const fontSerif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const fontSans = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const fontTc = Noto_Sans_TC({
  variable: "--font-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});

// 手機瀏覽器工具列顏色：跟隨系統深淺色，對齊 --c-page。
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E1014" },
    { media: "(prefers-color-scheme: light)", color: "#EAE6D8" },
  ],
};

export const metadata: Metadata = {
  title: "StackWorth",
  description: "個人投資組合追蹤工具",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: { capable: true, title: "StackWorth", statusBarStyle: "default" },
};

// FOUC 預防：
// 三態主題（light / dark / system），預設 system → 跟隨 prefers-color-scheme。
// 寫到 dataset.theme 的是「解析後」的二態（light or dark），給 CSS 變數用。
// localStorage 同時保留：
//   themePref：使用者選的（light/dark/system）
//   theme：解析後值（給跨分頁 storage event 同步）
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      suppressHydrationWarning
      className={`${fontSerif.variable} ${fontSans.variable} ${fontTc.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
