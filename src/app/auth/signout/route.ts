import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 登出：清除 session 後導回登入頁。用 303 讓瀏覽器把 POST 改成 GET 重導。
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
