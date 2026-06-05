import { createClient } from "@/lib/supabase/server";

/**
 * 取得當前使用者未讀通知數。
 * 給 server pages 用來餵 AppHeader 的鈴鐺紅點。
 * 沒登入 / 表不存在 / 任何錯誤都回 0，UI 不顯示紅點，這是安全 fallback。
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}
