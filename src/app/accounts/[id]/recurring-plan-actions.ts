"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayTaipei } from "@/lib/dates";
import { CreateRecurringPlanSchema } from "@/lib/schemas/action/create-recurring-plan";
import type { FormState } from "./action-shared";

// 月頻計畫的首次執行日：起始日已過本月扣款日時，順延到下個月。
function firstRunDate(startDate: string, dayOfMonth: number): string {
  const [year, month, day] = startDate.split("-").map(Number);
  const targetDay = String(dayOfMonth).padStart(2, "0");
  if (day <= dayOfMonth) {
    return `${year}-${String(month).padStart(2, "0")}-${targetDay}`;
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${targetDay}`;
}

export async function createRecurringPlan(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = CreateRecurringPlanSchema.safeParse({
    accountId: String(formData.get("accountId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    dayOfMonth: String(formData.get("dayOfMonth") ?? ""),
    startDate: String(formData.get("startDate") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "輸入資料無效" };
  }

  const { accountId, amount, dayOfMonth, startDate, note } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id,price_market,status")
    .eq("id", accountId)
    .single();
  if (accountError || !account) return { error: "找不到帳戶" };
  if (account.status === "archived") return { error: "帳戶已歸檔" };
  if (account.price_market === "manual") {
    return { error: "手動帳戶無法設定定期定額" };
  }

  const startDateFinal = startDate ?? todayTaipei();
  const { error: insertError } = await supabase.from("recurring_plans").insert({
    user_id: user.id,
    account_id: accountId,
    amount_twd: amount,
    day_of_month: dayOfMonth,
    start_date: startDateFinal,
    next_run_date: firstRunDate(startDateFinal, dayOfMonth),
    active: true,
    note,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath(`/accounts/${accountId}`);
  return { ok: "定期定額計畫已建立" };
}

export async function togglePlan(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = String(formData.get("planId") ?? "");
  const active = String(formData.get("newActive") ?? "") === "true";
  if (!planId) return { error: "缺少計劃 ID" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const { data: plan, error: planError } = await supabase
    .from("recurring_plans")
    .select("account_id")
    .eq("id", planId)
    .single();
  if (planError || !plan) return { error: "找不到計劃" };

  const { error: updateError } = await supabase
    .from("recurring_plans")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/accounts/${plan.account_id}`);
  return { ok: active ? "計畫已啟用" : "計畫已暫停" };
}

export async function deletePlan(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = String(formData.get("planId") ?? "");
  if (!planId) return { error: "缺少計劃 ID" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const { data: plan, error: planError } = await supabase
    .from("recurring_plans")
    .select("account_id")
    .eq("id", planId)
    .single();
  if (planError || !plan) return { error: "找不到計劃" };

  const { error: deleteError } = await supabase
    .from("recurring_plans")
    .delete()
    .eq("id", planId);
  if (deleteError) return { error: deleteError.message };

  revalidatePath(`/accounts/${plan.account_id}`);
  return { ok: "計畫已刪除" };
}
