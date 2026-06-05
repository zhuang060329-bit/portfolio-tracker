"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export type FormState = { error?: string } | undefined;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return { ok: false as const, error: "需要 admin 權限" };
  }
  return { ok: true as const, currentUserId: user.id };
}

// 刪除使用者：呼叫 Supabase Admin API。CASCADE 會清掉該使用者的 profiles / accounts / transactions 等所有資料。
export async function deleteUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { error: "缺少 userId" };
  if (userId === auth.currentUserId) {
    return { error: "不能刪除自己" };
  }

  const svc = createServiceClient();
  const { error } = await svc.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/allowlist");
  return undefined;
}
