import type { SupabaseClient } from "@supabase/supabase-js";
import { getQuote } from "@/lib/prices/router";
import { todayTaipei } from "@/lib/dates";
import type { Market } from "@/lib/prices/types";

// 共用：給定一筆 TWD 投入，依當下市價 + 可選 override 換算股數，加到 account.quantity，
// 寫 adjust_quantity transaction（created_at 可指定）+ snapshot upsert。
// 同時被 server actions（user 操作）與 cron route（service-role 自動執行）使用。

export type ContributionAccount = {
  id: string;
  user_id: string;
  price_market: "us" | "tw" | "crypto" | "manual";
  symbol: string | null;
  quantity: number;
  native_currency: string;
  last_unit_price: number | null;
  last_fx_rate: number;
  cost_basis_twd: number;
  cost_basis_native: number;
};

export type ContributionResult =
  | { ok: true; sharesAdded: number; newQty: number }
  | { ok: false; error: string };

export async function applyContribution(args: {
  supabase: SupabaseClient;
  userId: string;
  account: ContributionAccount;
  twd: number;
  priceOverride: number | null;
  fxOverride: number | null;
  occurredAt: Date;
  noteSuffix: string | null;
}): Promise<ContributionResult> {
  const { supabase, userId, account, twd, priceOverride, fxOverride, occurredAt } = args;

  if (account.price_market === "manual" || !account.symbol) {
    return { ok: false, error: "此操作僅限非手動帳戶" };
  }

  // 抓最新市價（即使有 override，也用 quote 來刷新 accounts.last_*）
  let quote;
  try {
    quote = await getQuote(
      account.price_market as Market,
      account.symbol,
      "TWD",
    );
  } catch (e) {
    return { ok: false, error: `抓價失敗：${(e as Error).message}` };
  }

  const priceUsed = priceOverride ?? quote.unitPrice;
  const fxUsed = fxOverride ?? quote.fxToBase;
  const perShareTwd = priceUsed * fxUsed;
  if (!Number.isFinite(perShareTwd) || perShareTwd <= 0) {
    return { ok: false, error: "換算失敗：單位 TWD 為零或無效" };
  }
  const sharesAdded = twd / perShareTwd;
  const newQty = Number(account.quantity) + sharesAdded;

  const newCost = Number(account.cost_basis_twd ?? 0) + twd;
  // 原幣成本：用「實際買到的原幣量」累加
  // 美股：twd / fxUsed = USD；台股 / crypto(TWD)：twd / 1 = TWD
  const nativeAdded = fxUsed > 0 ? twd / fxUsed : 0;
  const newCostNative =
    Number(account.cost_basis_native ?? 0) + nativeAdded;

  const { error: u } = await supabase
    .from("accounts")
    .update({
      quantity: newQty,
      last_unit_price: quote.unitPrice,
      last_fx_rate: quote.fxToBase,
      last_priced_at: quote.asOf,
      cost_basis_twd: newCost,
      cost_basis_native: newCostNative,
    })
    .eq("id", account.id);
  if (u) return { ok: false, error: u.message };

  const noteParts = [`加碼 ${twd} TWD`];
  if (args.noteSuffix) noteParts.push(args.noteSuffix);

  await supabase.from("transactions").insert({
    user_id: userId,
    account_id: account.id,
    type: "adjust_quantity",
    quantity_after: newQty,
    unit_price: priceUsed,
    fx_rate: fxUsed,
    value_after_base: newQty * priceUsed * fxUsed,
    note: noteParts.join(" · "),
    created_at: occurredAt.toISOString(),
    cashflow_twd: -twd, // 投入：負現金流
  });

  // 快照：occurredAt 那天用 priceUsed/fxUsed；不是今天就同時刷今天一筆。
  const occurredDate = occurredAt.toLocaleDateString("en-CA", {
    timeZone: "Asia/Taipei",
  });
  const isToday = occurredDate === todayTaipei();
  await supabase.from("account_snapshots").upsert(
    {
      user_id: userId,
      account_id: account.id,
      snapshot_date: occurredDate,
      quantity: newQty,
      unit_price: priceUsed,
      fx_rate: fxUsed,
      value_base: newQty * priceUsed * fxUsed,
    },
    { onConflict: "account_id,snapshot_date" },
  );
  if (!isToday) {
    await supabase.from("account_snapshots").upsert(
      {
        user_id: userId,
        account_id: account.id,
        snapshot_date: todayTaipei(),
        quantity: newQty,
        unit_price: quote.unitPrice,
        fx_rate: quote.fxToBase,
        value_base: newQty * quote.unitPrice * quote.fxToBase,
      },
      { onConflict: "account_id,snapshot_date" },
    );
  }

  return { ok: true, sharesAdded, newQty };
}

// 共用：把月頻計劃推進到下一個月的 day-of-month。
export function nextMonthlyAfter(fromIso: string, dayOfMonth: number): string {
  const [y, m] = fromIso.split("-").map(Number);
  const padded = String(dayOfMonth).padStart(2, "0");
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}-${padded}`;
}
