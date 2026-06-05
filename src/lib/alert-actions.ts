"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const type = String(fd.get("type") ?? "");
  const threshold = Number(fd.get("threshold"));
  const accountId = fd.get("accountId") ? String(fd.get("accountId")) : null;
  const note = fd.get("note") ? String(fd.get("note")) : null;

  if (!["price_above", "price_below", "allocation_drift"].includes(type)) {
    return { error: "未知警示類型" };
  }
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return { error: "閾值必須是正數" };
  }
  if (
    (type === "price_above" || type === "price_below") &&
    !accountId
  ) {
    return { error: "價格警示須指定帳戶" };
  }

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
