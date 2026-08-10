"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { executeRecurringPlan } from "@/lib/contributions";
import { ExecuteRecurringPlanSchema } from "@/lib/schemas/action/execute-recurring-plan";
import type { FormState } from "./action-shared";

export async function executePlan(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const parsed = ExecuteRecurringPlanSchema.safeParse({
    planId: String(formData.get("planId") ?? ""),
    // 留空 = 不覆寫，沿用計劃金額。
    ...(rawAmount === "" ? {} : { amount: rawAmount }),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "輸入資料無效" };
  }

  const { planId, amount } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const { data: plan, error: planError } = await supabase
    .from("recurring_plans")
    .select("id,account_id,next_run_date,active,amount_twd")
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

  // 與計劃金額相同就不算覆寫，ledger 備註維持一般定期定額。
  const overrides =
    amount !== undefined && amount !== Number(plan.amount_twd);

  const result = await executeRecurringPlan({
    supabase,
    planId: plan.id,
    expectedRunDate: plan.next_run_date,
    account,
    source: "manual",
    amountOverride: overrides ? amount : null,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/accounts/${plan.account_id}`);
  revalidatePath("/");

  if (!result.executed) return { ok: "本期已由另一個請求執行" };
  return {
    ok: overrides
      ? `已用 NT$ ${amount.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} 執行本期定期定額`
      : "已執行本期定期定額",
  };
}
