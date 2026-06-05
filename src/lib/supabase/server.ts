import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 伺服器端 Supabase client（Server Component / Server Action / Route Handler 用）。
// Next 16 的 cookies() 為 async，必須 await。
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 在 Server Component 內呼叫 setAll 會被忽略（無法寫 response header）。
            // 只要有 proxy 負責刷新 session cookie，這裡可安全忽略。
          }
        },
      },
    },
  );
}
