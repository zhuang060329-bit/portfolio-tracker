"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string } | undefined;

// 儲存使用者的資產配置目標到 profiles.allocation_targets (jsonb)
// 表單欄位命名：target_<asset_class>，值為百分比 0-100
export async function setAllocationTargets(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const targets: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (!key.startsWith("target_")) continue;
    const cls = key.slice("target_".length);
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) continue;
    if (n === 0) continue; // 0 視為「不設目標」，從 jsonb 移除
    targets[cls] = n;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ allocation_targets: targets })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/");
  return undefined;
}
