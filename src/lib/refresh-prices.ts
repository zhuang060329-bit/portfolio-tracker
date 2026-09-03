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

export type MarketStat = { ok: number; failed: number };

export type RefreshResult = {
  ok: number;
  failed: number;
  errors: string[];
  // 連帳戶清單都查不到：一筆都沒刷到。少了這面旗標，查詢失敗與「今天本來
  // 就沒有待刷帳戶」在監控端長得一模一樣（ok=0、failed=0），整條 cron 掛掉
  // 也看不出來。
  queryFailed?: boolean;
  // 依市場分列的成功／失敗。市場與報價來源一對一，用來判斷是哪一家掛了。
  byMarket?: Record<string, MarketStat>;
};

export async function refreshAccountPrices(
  supabase: SupabaseClient,
): Promise<RefreshResult> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id,user_id,price_market,symbol,quantity")
    .neq("price_market", "manual")
    .not("symbol", "is", null)
    .eq("status", "active");
  if (error) {
    // 只回 code，不回 error.message：那是 Postgres 原文，會帶出 schema 細節。
    return {
      ok: 0,
      failed: 0,
      queryFailed: true,
      byMarket: {},
      errors: [`查詢帳戶清單失敗 code=${error.code ?? "unknown"}`],
    };
  }

  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  const byMarket: Record<string, MarketStat> = {};
  const bump = (market: string, key: "ok" | "failed") => {
    const stat = (byMarket[market] ??= { ok: 0, failed: 0 });
    stat[key] += 1;
  };

  for (const acc of data ?? []) {
    const market = String(acc.price_market);
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
      bump(market, "ok");
    } catch (e) {
      failed++;
      bump(market, "failed");
      errors.push(`${acc.symbol}: ${(e as Error).message}`);
    }
  }
  return { ok, failed, errors, queryFailed: false, byMarket };
}
