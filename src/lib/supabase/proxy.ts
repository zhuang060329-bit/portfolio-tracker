import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Session 刷新 + 未登入導向。Next 16 用 Proxy（root src/proxy.ts）每個 request 呼叫此函式。
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 重要：建立 client 後必須立刻呼叫 getUser()，中間不要插入其他邏輯，
  // 否則 session 可能被隨機登出（Supabase 官方提醒）。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // 未登入，且不在 /login、/auth/*（OAuth callback）或 /demo（公開展示頁）→ 導向登入頁。
  if (
    !user &&
    !path.startsWith("/login") &&
    !path.startsWith("/auth") &&
    !path.startsWith("/demo")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 已登入但有 MFA factor 且 session 仍為 AAL1 → 導向 /auth/mfa 升級到 AAL2。
  // /auth/mfa、/auth/signout、/login 不檢查避免 redirect loop。
  if (
    user &&
    !path.startsWith("/auth/mfa") &&
    !path.startsWith("/auth/signout") &&
    !path.startsWith("/login")
  ) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      aal &&
      aal.nextLevel === "aal2" &&
      aal.currentLevel === "aal1"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/mfa";
      // 帶 next 參數，驗完轉回原本要去的頁面
      if (path !== "/") url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
