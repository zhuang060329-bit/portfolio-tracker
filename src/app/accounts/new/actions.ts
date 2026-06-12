"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/prices/router";
import { todayTaipei } from "@/lib/dates";
import {
  CreateStockAccountSchema,
  CreateCryptoAccountSchema,
  CreateManualAccountSchema,
} from "@/lib/schemas/action/create-account";

export type FormState = { error?: string } | undefined;

// 共用：取已登入使用者，未登入回錯。
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null as null, error: "請先登入" };
  }
  return { supabase, user, error: null as null };
}

// 共用：寫入 accounts → transactions → account_snapshots 三表。
// 任一步失敗回傳 error 訊息。成功則 redirect 不回傳。
async function persistCreate(args: {
  name: string;
  assetClass: "stock" | "crypto" | "other_investment";
  priceMarket: "us" | "tw" | "crypto" | "manual";
  symbol: string | null;
  quantity: number;
  nativeCurrency: string;
  unitPrice: number | null;
  fxToBase: number;
  manualValueBase: number | null;
  lastPricedAt: string | null;
  valueBase: number;
}): Promise<FormState> {
  const { supabase, user, error: userErr } = await requireUser();
  if (userErr || !user) return { error: userErr ?? "未登入" };

  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: args.name,
      asset_class: args.assetClass,
      price_market: args.priceMarket,
      symbol: args.symbol,
      quantity: args.quantity,
      native_currency: args.nativeCurrency,
      last_unit_price: args.unitPrice,
      last_fx_rate: args.fxToBase,
      manual_value_base: args.manualValueBase,
      last_priced_at: args.lastPricedAt,
      cost_basis_twd: args.valueBase, // 建立時：成本 = 當下市值
      cost_basis_native:
        args.manualValueBase ??
        (args.unitPrice != null ? args.quantity * args.unitPrice : args.valueBase),
    })
    .select("id")
    .single();
  if (accErr || !account) {
    return { error: `建立帳戶失敗：${accErr?.message ?? "未知錯誤"}` };
  }

  const { error: txErr } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: account.id,
    type: "create",
    quantity_after: args.quantity,
    unit_price: args.unitPrice,
    fx_rate: args.fxToBase,
    value_after_base: args.valueBase,
    cashflow_twd: -args.valueBase, // 建立帳戶 = 一次性投入：負現金流
  });
  if (txErr) return { error: `寫入交易失敗：${txErr.message}` };

  const { error: snapErr } = await supabase.from("account_snapshots").insert({
    user_id: user.id,
    account_id: account.id,
    snapshot_date: todayTaipei(),
    quantity: args.quantity,
    unit_price: args.unitPrice,
    fx_rate: args.fxToBase,
    value_base: args.valueBase,
  });
  if (snapErr) return { error: `寫入快照失敗：${snapErr.message}` };

  redirect("/");
}

// ===== 股票（美股/台股）=====
export async function createStockAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = CreateStockAccountSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    market: String(formData.get("market") ?? ""),
    symbol: String(formData.get("symbol") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
  });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "輸入資料無效" };
  }
  const { name, market, symbol, quantity: qty } = result.data;

  // 即時抓一次價格驗證 symbol 正確。
  let quote;
  try {
    quote = await getQuote(market, symbol, "TWD");
  } catch (e) {
    return { error: `找不到 ${symbol} 的價格：${(e as Error).message}` };
  }

  return persistCreate({
    name,
    assetClass: "stock",
    priceMarket: market,
    symbol,
    quantity: qty,
    nativeCurrency: quote.nativeCurrency,
    unitPrice: quote.unitPrice,
    fxToBase: quote.fxToBase,
    manualValueBase: null,
    lastPricedAt: quote.asOf,
    valueBase: qty * quote.unitPrice * quote.fxToBase,
  });
}

// ===== 加密貨幣 =====
export async function createCryptoAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = CreateCryptoAccountSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    symbol: String(formData.get("symbol") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
  });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "輸入資料無效" };
  }
  const { name, symbol, quantity: qty } = result.data;

  let quote;
  try {
    quote = await getQuote("crypto", symbol, "TWD");
  } catch (e) {
    return { error: `找不到 ${symbol} 的價格：${(e as Error).message}` };
  }

  return persistCreate({
    name,
    assetClass: "crypto",
    priceMarket: "crypto",
    symbol,
    quantity: qty,
    nativeCurrency: quote.nativeCurrency,
    unitPrice: quote.unitPrice,
    fxToBase: quote.fxToBase,
    manualValueBase: null,
    lastPricedAt: quote.asOf,
    valueBase: qty * quote.unitPrice * quote.fxToBase,
  });
}

// ===== 其他投資（manual）=====
export async function createManualAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = CreateManualAccountSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    balance: String(formData.get("balance") ?? ""),
  });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "輸入資料無效" };
  }
  const { name, balance } = result.data;

  return persistCreate({
    name,
    assetClass: "other_investment",
    priceMarket: "manual",
    symbol: null,
    quantity: 0,
    nativeCurrency: "TWD",
    unitPrice: null,
    fxToBase: 1,
    manualValueBase: balance,
    lastPricedAt: null,
    valueBase: balance,
  });
}
