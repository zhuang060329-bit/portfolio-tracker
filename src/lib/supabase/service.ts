import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// 僅供伺服器端 / cron 使用，繞過 RLS（用 SUPABASE_SECRET_KEY）。
// 嚴禁在前端 import 此檔。
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL 未設定");
  if (!secret) throw new Error("SUPABASE_SECRET_KEY 未設定");
  return createSupabaseClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
