"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export type FormState = { error?: string } | undefined;

async function requireAdmin(): Promise<{
  user: { email: string };
  error: null;
} | { user: null; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return { user: null, error: "需要 admin 權限" };
  }
  return { user: { email: user.email! }, error: null };
}

export async function addAllowedEmail(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, error: authErr } = await requireAdmin();
  if (!user) return { error: authErr! };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Email 格式不正確" };
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("allowed_emails")
    .insert({ email, note });
  if (error) {
    if (error.code === "23505") return { error: "這個 email 已在名單上" };
    return { error: error.message };
  }

  revalidatePath("/admin/allowlist");
  return undefined;
}

export async function removeAllowedEmail(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, error: authErr } = await requireAdmin();
  if (!user) return { error: authErr! };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "缺少 email" };

  const svc = createServiceClient();
  const { error } = await svc
    .from("allowed_emails")
    .delete()
    .eq("email", email);
  if (error) return { error: error.message };

  revalidatePath("/admin/allowlist");
  return undefined;
}
