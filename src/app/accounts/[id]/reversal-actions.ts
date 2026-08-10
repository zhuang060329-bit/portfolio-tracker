"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ReverseTransactionSchema } from "@/lib/schemas/action/reverse-transaction";
import type { FormState } from "./action-shared";

/**
 * 撤銷最新一筆（undo）或沖銷較早的一筆（reverse）。
 *
 * 帳戶增量、快照、定期定額 ledger 與排程日期的回退全部在單一 RPC 的交易內完成，
 * 任一步失敗整體回滾。哪些型別可撤銷、以及反向量怎麼從流水列回推，
 * 判斷都在 RPC 端（見 supabase/migrations/20260810234500_transaction_reversal.sql），
 * 這裡不重複一份會漂移的規則。
 */
export async function reverseTransaction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = ReverseTransactionSchema.safeParse({
    accountId: String(formData.get("accountId") ?? ""),
    transactionId: String(formData.get("transactionId") ?? ""),
    mode: String(formData.get("mode") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "輸入資料無效" };
  }

  const { accountId, transactionId, mode } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const { error } = await supabase.rpc("reverse_transaction_mutation", {
    p_transaction_id: transactionId,
    p_mode: mode,
  });
  if (error) {
    // P0001 = plpgsql raise exception，訊息是我們自己寫的中文說明（為什麼不能撤銷），
    // 顯示出來才有用。其他 SQLSTATE 是底層錯誤，不外洩內容。
    if (error.code === "P0001") return { error: error.message };
    console.error(`[reverseTransaction] RPC 失敗 code=${error.code ?? "unknown"}`);
    return { error: "撤銷失敗，資料未變更。請重新整理後再試" };
  }

  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/activity");
  revalidatePath("/");

  return {
    ok: mode === "undo" ? "已撤銷這筆交易" : "已記錄一筆沖銷交易",
  };
}
