import type { SupabaseClient } from "@supabase/supabase-js";
import { getQuote } from "@/lib/prices/router";
import { applyAccountMutation } from "@/lib/account-mutation";
import { todayTaipei } from "@/lib/dates";
import type { Market } from "@/lib/prices/types";

// 刷新「client 可見的」所有 active 非手動帳戶市價：
// 更新 accounts.last_*，並 upsert 今日 snapshot。
// - cron 路由用 service client 呼叫 → 刷全部使用者
// - refresh-actions 用 RLS user client 呼叫 → 只刷該使用者自己的帳戶
// 兩端共用同一份邏輯，避免 cron 與手動刷新的行為漂移。

export type RefreshResult = { ok: number; failed: number; errors: string[] };

export async function refreshAccountPrices(
  supabase: SupabaseClient,
): Promise<RefreshResult> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id,user_id,price_market,symbol,quantity")
    .neq("price_market", "manual")
    .not("symbol", "is", null)
    .eq("status", "active");
  if (error) return { ok: 0, failed: 0, errors: [error.message] };

  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const acc of data ?? []) {
    try {
      const quote = await getQuote(
        acc.price_market as Market,
        acc.symbol as string,
        "TWD",
      );
      const qty = Number(acc.quantity);
      const valueBase = qty * quote.unitPrice * quote.fxToBase;

      // 原子寫入 + error 檢查（先前這兩筆寫入的失敗會被靜默吞掉）
      const { error: m } = await applyAccountMutation(supabase, {
        accountId: acc.id,
        patch: {
          last_unit_price: quote.unitPrice,
          last_fx_rate: quote.fxToBase,
          last_priced_at: quote.asOf,
        },
        snapshots: [
          {
            snapshot_date: todayTaipei(),
            quantity: qty,
            unit_price: quote.unitPrice,
            fx_rate: quote.fxToBase,
            value_base: valueBase,
          },
        ],
      });
      if (m) throw new Error(m);

      ok++;
    } catch (e) {
      failed++;
      errors.push(`${acc.symbol}: ${(e as Error).message}`);
    }
  }
  return { ok, failed, errors };
}
