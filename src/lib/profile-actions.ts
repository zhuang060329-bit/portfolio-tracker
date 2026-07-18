"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  SetAllocationTargetsSchema,
  SetConcentrationLimitSchema,
} from "@/lib/schemas/action/set-allocation-targets";

export type FormState = { error?: string } | undefined;

// 儲存使用者的資產配置目標到 profiles.allocation_targets (jsonb)
// 表單欄位命名：target_<asset_class>，值為百分比 0-100；"" 或 "0" 表示清除該類別目標
export async function setAllocationTargets(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const rawEntries: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key.startsWith("target_")) {
      rawEntries[key.slice("target_".length)] = value;
    }
  }

  const result = SetAllocationTargetsSchema.safeParse(rawEntries);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "輸入資料無效" };
  }

  const targets: Record<string, number> = {};
  for (const [cls, val] of Object.entries(result.data)) {
    if (val !== 0) targets[cls] = val; // 0 視為「不設目標」，從 jsonb 移除
  }

  const { error } = await supabase
    .from("profiles")
    .update({ allocation_targets: targets })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/");
  return undefined;
}

export async function setConcentrationLimit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = SetConcentrationLimitSchema.safeParse({
    concentrationLimitPct: formData.get("concentrationLimitPct"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "輸入資料無效" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const { error } = await supabase
    .from("profiles")
    .update({ concentration_limit_pct: parsed.data.concentrationLimitPct })
    .eq("id", user.id);
  if (error) return { error: "無法儲存集中度上限" };

  revalidatePath("/settings");
  revalidatePath("/whatif");
  return undefined;
}
