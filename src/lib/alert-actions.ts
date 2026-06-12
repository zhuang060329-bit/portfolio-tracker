"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CreateAlertSchema } from "@/lib/schemas/action/create-alert";

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function createAlert(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const result = CreateAlertSchema.safeParse({
    type: fd.get("type"),
    threshold: fd.get("threshold"),
    accountId: fd.get("accountId") || null,
    note: fd.get("note") || null,
  });

  if (!result.success) {
    const firstIssue = result.error.issues[0]?.message ?? "輸入資料無效";
    return { error: firstIssue };
  }

  const { type, threshold, accountId, note } = result.data;

  const { error } = await supabase.from("alerts").insert({
    user_id: user.id,
    type,
    account_id: type === "allocation_drift" ? null : accountId,
    threshold,
    note,
  });
  if (error) return { error: error.message };

  revalidatePath("/alerts");
  return { ok: true };
}

export async function deleteAlert(fd: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await supabase.from("alerts").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/alerts");
}

export async function toggleAlert(fd: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const id = String(fd.get("id") ?? "");
  const active = fd.get("active") === "1";
  if (!id) return;
  await supabase
    .from("alerts")
    .update({ active })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/alerts");
}

export async function markNotificationRead(fd: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/notifications");
  revalidatePath("/");
}
