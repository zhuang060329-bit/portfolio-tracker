import type { Metadata, Viewport } from "next";
import { SwRegister } from "@/components/SwRegister";
import { Newsreader, Space_Grotesk, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

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
        {/* 跳至主內容（WCAG 2.4.1 Bypass Blocks，Level A）。
            導覽列每頁有 7 個項目加通知與帳號，鍵盤使用者換頁都要重 tab 一遍。
            平時視覺隱藏，取得焦點才顯示；目標 <main> 帶 tabIndex={-1}，
            否則 Safari 只會捲動而不移動焦點。 */}
        <a href="#main" className="skip-link">
          跳至主內容
        </a>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
