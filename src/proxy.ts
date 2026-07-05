import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16 的 Proxy（前身為 Middleware）。每個 request 先刷新 Supabase session，
// 未登入則導向 /login。
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // 排除靜態資源、圖檔與 cron route（cron 自己驗 CRON_SECRET）。
  // sw.js / offline.html / manifest 必須公開可達：SW 註冊與 PWA 安裝
  // 都發生在瀏覽器背景 fetch，被 307 到 /login 會整個裝不起來。
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|sw\\.js|offline\\.html|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
