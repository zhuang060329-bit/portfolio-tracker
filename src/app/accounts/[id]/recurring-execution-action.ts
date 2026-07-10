"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { executeRecurringPlan } from "@/lib/contributions";
import type { FormState } from "./action-shared";

export async function executePlan(
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
    .select("id,account_id,next_run_date,active")
    .eq("id", planId)
    .single();
  if (planError || !plan) return { error: "找不到計劃" };
  if (!plan.active) return { error: "計劃已暫停，請先啟用" };

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("price_market,symbol,status")
    .eq("id", plan.account_id)
    .single();
  if (accountError || !account) return { error: "找不到帳戶" };

  const result = await executeRecurringPlan({
    supabase,
    planId: plan.id,
    expectedRunDate: plan.next_run_date,
    account,
    source: "manual",
  });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/accounts/${plan.account_id}`);
  revalidatePath("/");
  return {
    ok: result.executed
      ? "已執行本期定期定額"
      : "本期已由另一個請求執行",
  };
}
