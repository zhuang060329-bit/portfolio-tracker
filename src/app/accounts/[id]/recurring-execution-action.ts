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
  const rawFee = String(formData.get("fee") ?? "").trim();
  const parsed = ExecuteRecurringPlanSchema.safeParse({
    planId: String(formData.get("planId") ?? ""),
    // 留空 = 不覆寫，沿用計劃的預設值。
    ...(rawAmount === "" ? {} : { amount: rawAmount }),
    ...(rawFee === "" ? {} : { fee: rawFee }),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "輸入資料無效" };
  }

  const { planId, amount, fee } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const { data: plan, error: planError } = await supabase
    .from("recurring_plans")
    .select("id,account_id,next_run_date,active,amount_twd,fee_twd")
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

  // 與計劃預設值相同就不算覆寫，ledger 備註維持一般定期定額。
  const amountOverridden =
    amount !== undefined && amount !== Number(plan.amount_twd);
  const feeOverridden =
    fee !== undefined && fee !== Number(plan.fee_twd ?? 0);

  const result = await executeRecurringPlan({
    supabase,
    planId: plan.id,
    expectedRunDate: plan.next_run_date,
    account,
    source: "manual",
    amountOverride: amountOverridden ? amount : null,
    feeOverride: feeOverridden ? fee : null,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/accounts/${plan.account_id}`);
  revalidatePath("/");

  if (!result.executed) return { ok: "本期已由另一個請求執行" };
  if (!amountOverridden && !feeOverridden) {
    return { ok: "已執行本期定期定額" };
  }
  const parts: string[] = [];
  if (amountOverridden) parts.push(`NT$ ${fmtTwd(amount!)}`);
  if (feeOverridden) parts.push(`手續費 NT$ ${fmtTwd(fee!)}`);
  return { ok: `已用 ${parts.join("、")} 執行本期定期定額` };
}

function fmtTwd(value: number): string {
  return value.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
}
