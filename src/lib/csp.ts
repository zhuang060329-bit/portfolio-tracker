/**
 * Content-Security-Policy。由 src/proxy.ts 每個 request 呼叫一次。
 *
 * 政策依 Next 16 隨附的官方指引
 * （node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md）。
 *
 * 兩件事先講清楚，免得日後被當成漏做：
 *
 * 1. style-src 只能是 'self' 'unsafe-inline'，收不緊。
 *    全站有 40 幾處 style={{...}}（配置圖顏色、進度條寬度、圖表座標都靠它），
 *    SSR 之後是 HTML 裡的 style="..." 屬性，會被 style-src 擋掉。
 *    而且只要 style-src 帶了 nonce，瀏覽器就會依 CSP3 規範忽略 'unsafe-inline'，
 *    所以這裡刻意不放 nonce。要真收緊得把那些動態顏色改成 CSS class，改不掉。
 *
 * 2. 用了 nonce 就等於全站動態渲染。這是官方文件明講的取捨：
 *    static optimization 與 ISR 停用、CDN 不能快取。
 *    本專案原本有 7 個靜態頁（/login、/methodology、/demo/* 等），改動後全變動態。
 */

/**
 * 翻成 true 就從「只回報」改為「實際攔截」。
 *
 * 先上 Report-Only 的理由：這是唯一有機會把線上站打白的改動，
 * 而 CSP 違規只有在真實瀏覽器裡才看得到。
 * 開站繞一圈（首頁、/whatif 圖表、/settings 的 MFA QR、登入、/demo），
 * console 沒有 CSP 違規之後再翻。
 */
export const CSP_ENFORCE = false;

/** Report-Only 時瀏覽器照常渲染，只在 console 印違規。 */
export const CSP_RESPONSE_HEADER = CSP_ENFORCE
  ? "Content-Security-Policy"
  : "Content-Security-Policy-Report-Only";

/**
 * 不論是否強制執行，送進 request 的一律是 Content-Security-Policy。
 * Next 是從 request 上的這個標頭解析出 nonce，再自動加到框架 script 上；
 * 標頭名不對就抓不到 nonce，翻成強制執行的那一刻整站會白。
 */
export const CSP_REQUEST_HEADER = "Content-Security-Policy";

export const NONCE_HEADER = "x-nonce";

/** 從 URL 或 Sentry DSN 取出 origin。取不到回 null，不讓壞值污染政策。 */
function originOf(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function createNonce(): string {
  // btoa + randomUUID 都是 Edge runtime 有的 Web API，不依賴 Node 的 Buffer。
  return btoa(crypto.randomUUID());
}

export function buildCsp(nonce: string, isDev: boolean): string {
  // 瀏覽器端的 supabase client 直接連 Supabase，必須放行。
  // 報價 API（Twelve Data / FinMind / CoinGecko）全在伺服器端，不需要列。
  const connect = ["'self'"];
  const supabase = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (supabase) connect.push(supabase);
  const sentry = originOf(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (sentry) connect.push(sentry);

  const directives = [
    "default-src 'self'",
    /* 刻意不加 'strict-dynamic'，加了會把 /demo、/demo/whatif、/demo/report 打壞。
       那三頁的 HTML 裡各有一支 Next 內部 chunk（useMergedRef，next/link 在用）
       是以沒有 nonce 的 <script src> 直接寫進初始 HTML 的，屬 parser-inserted，
       不在 strict-dynamic 的信任範圍內；而 strict-dynamic 一出現，
       'self' 這類 host 來源就會被瀏覽器忽略，那支 chunk 於是被擋。
       Report-Only 階段實測，Chrome 原文：
         "Note that 'strict-dynamic' is present, so host-based allowlisting is disabled."

       拿掉之後 'self' 生效，同源 script 放行，inline script 仍然必須帶 nonce。
       擋得住的：注入 <script>…</script>、載入外站 script。
       擋不住的：自家 origin 上的 script gadget——本站沒有任何讓使用者把檔案
       放上 origin 的路徑，這個缺口在實務上很小。

       dev 需要 unsafe-eval：React 用 eval 重建伺服器端錯誤堆疊。production 不需要。 */
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // data: 是給 /settings 的 MFA QR code（Supabase 回傳 data: URI）。
    "img-src 'self' blob: data:",
    // 字體已自架在 src/app/fonts/，不需要外部網域。
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    // public/sw.js
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // 與既有的 X-Frame-Options: DENY 同義，兩個都留著給舊瀏覽器。
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}
