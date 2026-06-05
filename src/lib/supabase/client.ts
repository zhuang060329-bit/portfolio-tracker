import { createBrowserClient } from "@supabase/ssr";

// 瀏覽器端 Supabase client（Client Component 用）。
// 只使用 NEXT_PUBLIC_* 金鑰，不可放任何 secret。
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
