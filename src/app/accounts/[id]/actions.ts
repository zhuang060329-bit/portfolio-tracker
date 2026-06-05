"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/prices/router";
import { todayTaipei } from "@/lib/dates";
import type { Market } from "@/lib/prices/types";
import { applyContribution, nextMonthlyAfter } from "@/lib/contributions";

export type FormState = { error?: string } | undefined;

type AccountForAction = {
  id: string;
  user_id: string;
  price_market: "us" | "tw" | "crypto" | "manual";
  symbol: string | null;
  quantity: number;
  native_currency: string;
  last_unit_price: number | null;
  last_fx_rate: number;
  manual_value_base: number | null;
  cost_basis_twd: number;
  cost_basis_native: number;
  realized_pnl_twd: number;
};

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// ====== 共用 helper ======

async function loadAccount(accountId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, account: null, error: "請先登入" };
  const { data, error } = await supabase
    .from("accounts")
    .select(
      "id,user_id,price_market,symbol,quantity,native_currency,last_unit_price,last_fx_rate,manual_value_base,cost_basis_twd,cost_basis_native,realized_pnl_twd",
    )
    .eq("id", accountId)
    .single();
  if (error || !data) {
    return { supabase, user, account: null, error: "找不到帳戶" };
  }
  return { supabase, user, account: data as AccountForAction, error: null };
}

async function upsertTodaySnapshot(
  supabase: SupabaseServer,
  args: {
    userId: string;
    accountId: string;
    quantity: number;
    unitPrice: number | null;
    fxRate: number;
    valueBase: number;
  },
) {
  return supabase.from("account_snapshots").upsert(
    {
      user_id: args.userId,
      account_id: args.accountId,
      snapshot_date: todayTaipei(),
      quantity: args.quantity,
      unit_price: args.unitPrice,
      fx_rate: args.fxRate,
      value_base: args.valueBase,
    },
    { onConflict: "account_id,snapshot_date" },
  );
}

function done(accountId: string): FormState {
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/");
  return undefined;
}

// ====== 月頻首次扣款日（僅 createRecurringPlan 用，留在本檔） ======
function firstRunDate(startIso: string, dayOfMonth: number): string {
  const [y, m, d] = startIso.split("-").map(Number);
  const padded = String(dayOfMonth).padStart(2, "0");
  if (d <= dayOfMonth) {
    return `${y}-${String(m).padStart(2, "0")}-${padded}`;
  }
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}-${padded}`;
}

// ====== 帳戶層級 actions ======

// 更新價格
export async function updatePrice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return { error: "缺少帳戶 ID" };
  const { supabase, user, account, error } = await loadAccount(accountId);
  if (error || !account || !user) return { error: error ?? "錯誤" };
  if (account.price_market === "manual" || !account.symbol) {
    return { error: "手動帳戶無需更新價格" };
  }

  let quote;
  try {
    quote = await getQuote(
      account.price_market as Market,
      account.symbol,
      "TWD",
    );
  } catch (e) {
    return { error: `抓價失敗：${(e as Error).message}` };
  }

  const qty = Number(account.quantity);
  const valueBase = qty * quote.unitPrice * quote.fxToBase;

  const { error: u } = await supabase
    .from("accounts")
    .update({
      last_unit_price: quote.unitPrice,
      last_fx_rate: quote.fxToBase,
      last_priced_at: quote.asOf,
    })
    .eq("id", accountId);
  if (u) return { error: u.message };

  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: accountId,
    type: "price_update",
    quantity_after: qty,
    unit_price: quote.unitPrice,
    fx_rate: quote.fxToBase,
    value_after_base: valueBase,
    cashflow_twd: 0, // 純價格更新，無現金流
  });

  await upsertTodaySnapshot(supabase, {
    userId: user.id,
    accountId,
    quantity: qty,
    unitPrice: quote.unitPrice,
    fxRate: quote.fxToBase,
    valueBase,
  });

  return done(accountId);
}

// 增減股數 / 數量（覆寫總量）
export async function adjustQuantity(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accountId = String(formData.get("accountId") ?? "");
  const newQty = Number(formData.get("quantity"));
  if (!accountId) return { error: "缺少帳戶 ID" };
  if (!Number.isFinite(newQty) || newQty < 0) {
    return { error: "數量需為非負數" };
  }
  const { supabase, user, account, error } = await loadAccount(accountId);
  if (error || !account || !user) return { error: error ?? "錯誤" };
  if (account.price_market === "manual" || !account.symbol) {
    return { error: "此操作僅限非手動帳戶" };
  }

  let quote;
  try {
    quote = await getQuote(
      account.price_market as Market,
      account.symbol,
      "TWD",
    );
  } catch (e) {
    return { error: `抓價失敗：${(e as Error).message}` };
  }
  const valueBase = newQty * quote.unitPrice * quote.fxToBase;

  // 成本基礎調整：
  //   newQty > oldQty → 視為以當下市價買入差額 → 成本加上「差額 × 現價」
  //   newQty < oldQty → 視為賣出部分 → 成本按比例縮減（平均成本法）
  //   newQty == oldQty → 不動
  const oldQty = Number(account.quantity);
  const oldCost = Number(account.cost_basis_twd ?? 0);
  const oldCostNative = Number(account.cost_basis_native ?? 0);
  let newCost = oldCost;
  let newCostNative = oldCostNative;
  if (newQty > oldQty) {
    const diff = newQty - oldQty;
    newCost = oldCost + diff * quote.unitPrice * quote.fxToBase;
    newCostNative = oldCostNative + diff * quote.unitPrice;
  } else if (newQty < oldQty && oldQty > 0) {
    const ratio = newQty / oldQty;
    newCost = oldCost * ratio;
    newCostNative = oldCostNative * ratio;
  }

  await supabase
    .from("accounts")
    .update({
      quantity: newQty,
      last_unit_price: quote.unitPrice,
      last_fx_rate: quote.fxToBase,
      last_priced_at: quote.asOf,
      cost_basis_twd: newCost,
      cost_basis_native: newCostNative,
    })
    .eq("id", accountId);

  // 覆寫總量視為「以現價買/賣差額」近似現金流（要精準損益請走 sell 流程）
  const cashflow = -(newQty - oldQty) * quote.unitPrice * quote.fxToBase;

  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: accountId,
    type: "adjust_quantity",
    quantity_after: newQty,
    unit_price: quote.unitPrice,
    fx_rate: quote.fxToBase,
    value_after_base: valueBase,
    cashflow_twd: cashflow,
  });

  await upsertTodaySnapshot(supabase, {
    userId: user.id,
    accountId,
    quantity: newQty,
    unitPrice: quote.unitPrice,
    fxRate: quote.fxToBase,
    valueBase,
  });

  return done(accountId);
}

// 加碼買入：依 TWD 換算股數
export async function addByAmount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accountId = String(formData.get("accountId") ?? "");
  const twd = Number(formData.get("twd"));
  const priceOverrideRaw = String(formData.get("priceOverride") ?? "").trim();
  const fxOverrideRaw = String(formData.get("fxOverride") ?? "").trim();
  const occurredAtRaw = String(formData.get("occurredAt") ?? "").trim();
  const userNote = String(formData.get("note") ?? "").trim() || null;

  if (!accountId) return { error: "缺少帳戶 ID" };
  if (!Number.isFinite(twd) || twd <= 0) {
    return { error: "投入金額需為正數 TWD" };
  }

  const priceOverride = priceOverrideRaw ? Number(priceOverrideRaw) : null;
  const fxOverride = fxOverrideRaw ? Number(fxOverrideRaw) : null;
  if (priceOverride !== null && (!Number.isFinite(priceOverride) || priceOverride <= 0)) {
    return { error: "成交價需為正數" };
  }
  if (fxOverride !== null && (!Number.isFinite(fxOverride) || fxOverride <= 0)) {
    return { error: "匯率需為正數" };
  }

  let occurredAt: Date;
  if (occurredAtRaw) {
    const d = new Date(occurredAtRaw);
    if (Number.isNaN(d.getTime())) return { error: "時間格式無效" };
    occurredAt = d;
  } else {
    occurredAt = new Date();
  }

  const { supabase, user, account, error } = await loadAccount(accountId);
  if (error || !account || !user) return { error: error ?? "錯誤" };

  const res = await applyContribution({
    supabase,
    userId: user.id,
    account,
    twd,
    priceOverride,
    fxOverride,
    occurredAt,
    noteSuffix: userNote,
  });
  if (!res.ok) return { error: res.error };

  return done(accountId);
}

// 修改餘額（manual）
export async function adjustBalance(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accountId = String(formData.get("accountId") ?? "");
  const newBalance = Number(formData.get("balance"));
  if (!accountId) return { error: "缺少帳戶 ID" };
  if (!Number.isFinite(newBalance) || newBalance < 0) {
    return { error: "餘額需為非負數" };
  }
  const { supabase, user, account, error } = await loadAccount(accountId);
  if (error || !account || !user) return { error: error ?? "錯誤" };
  if (account.price_market !== "manual") {
    return { error: "此操作僅限手動帳戶" };
  }

  // manual 帳戶：成本 = 餘額（沒有市場價變動，PnL 永遠為 0）
  const oldBalance = Number(account.manual_value_base ?? 0);
  await supabase
    .from("accounts")
    .update({
      manual_value_base: newBalance,
      cost_basis_twd: newBalance,
      cost_basis_native: newBalance,
    })
    .eq("id", accountId);

  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: accountId,
    type: "adjust_balance",
    quantity_after: 0,
    unit_price: null,
    fx_rate: 1,
    value_after_base: newBalance,
    cashflow_twd: -(newBalance - oldBalance), // 存入 = 負，提領 = 正
  });

  await upsertTodaySnapshot(supabase, {
    userId: user.id,
    accountId,
    quantity: 0,
    unitPrice: null,
    fxRate: 1,
    valueBase: newBalance,
  });

  return done(accountId);
}

// ====== 賣出 ======
// 賣出 N 股，計算已實現損益（平均成本法）。
//   收入(TWD) = 使用者填寫；若未填，預設用「當下市價 × fx × 股數」。
//   已實現損益 = 收入 − 被賣掉的那部分成本（cost × sellQty / oldQty）
// 寫一筆 type='sell' 的 transaction，帶 realized_pnl 與 cashflow_twd（正值）。
export async function sellQuantity(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accountId = String(formData.get("accountId") ?? "");
  const sellQty = Number(formData.get("sellQty"));
  const proceedsRaw = String(formData.get("proceedsTwd") ?? "").trim();
  const priceOverrideRaw = String(formData.get("priceOverride") ?? "").trim();
  const fxOverrideRaw = String(formData.get("fxOverride") ?? "").trim();
  const occurredAtRaw = String(formData.get("occurredAt") ?? "").trim();
  const userNote = String(formData.get("note") ?? "").trim() || null;

  if (!accountId) return { error: "缺少帳戶 ID" };
  if (!Number.isFinite(sellQty) || sellQty <= 0) {
    return { error: "賣出股數需為正數" };
  }

  let occurredAt: Date;
  if (occurredAtRaw) {
    const d = new Date(occurredAtRaw);
    if (Number.isNaN(d.getTime())) return { error: "時間格式無效" };
    occurredAt = d;
  } else {
    occurredAt = new Date();
  }

  const { supabase, user, account, error } = await loadAccount(accountId);
  if (error || !account || !user) return { error: error ?? "錯誤" };
  if (account.price_market === "manual" || !account.symbol) {
    return { error: "此操作僅限非手動帳戶（手動帳戶用『修改餘額』）" };
  }
  const oldQty = Number(account.quantity);
  if (sellQty > oldQty) {
    return { error: `賣出股數超過持有（目前 ${oldQty}）` };
  }

  let quote;
  try {
    quote = await getQuote(
      account.price_market as Market,
      account.symbol,
      "TWD",
    );
  } catch (e) {
    return { error: `抓價失敗：${(e as Error).message}` };
  }

  const priceOverride = priceOverrideRaw ? Number(priceOverrideRaw) : null;
  const fxOverride = fxOverrideRaw ? Number(fxOverrideRaw) : null;
  const priceUsed = priceOverride ?? quote.unitPrice;
  const fxUsed = fxOverride ?? quote.fxToBase;

  // 收入：使用者填的金額優先；否則 = 股數 × 成交價 × fx
  const proceeds = proceedsRaw
    ? Number(proceedsRaw)
    : sellQty * priceUsed * fxUsed;
  if (!Number.isFinite(proceeds) || proceeds < 0) {
    return { error: "收入需為非負數" };
  }

  // 平均成本法：分配給賣出部分的成本（同步算原幣成本）
  const oldCost = Number(account.cost_basis_twd ?? 0);
  const oldCostNative = Number(account.cost_basis_native ?? 0);
  const ratio = oldQty > 0 ? sellQty / oldQty : 0;
  const allocatedCost = oldCost * ratio;
  const realizedPnl = proceeds - allocatedCost;

  const newQty = oldQty - sellQty;
  const newCost = oldCost - allocatedCost;
  const newCostNative = oldCostNative * (1 - ratio);
  const newRealizedTotal = Number(account.realized_pnl_twd ?? 0) + realizedPnl;

  await supabase
    .from("accounts")
    .update({
      quantity: newQty,
      cost_basis_twd: newCost,
      cost_basis_native: newCostNative,
      realized_pnl_twd: newRealizedTotal,
      last_unit_price: quote.unitPrice,
      last_fx_rate: quote.fxToBase,
      last_priced_at: quote.asOf,
    })
    .eq("id", accountId);

  const noteParts = [`賣出 ${sellQty} 股，收入 ${Math.round(proceeds)} TWD`];
  if (userNote) noteParts.push(userNote);

  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: accountId,
    type: "sell",
    quantity_after: newQty,
    unit_price: priceUsed,
    fx_rate: fxUsed,
    value_after_base: newQty * quote.unitPrice * quote.fxToBase,
    realized_pnl: realizedPnl,
    cashflow_twd: proceeds, // 收回現金：正
    note: noteParts.join(" · "),
    created_at: occurredAt.toISOString(),
  });

  await upsertTodaySnapshot(supabase, {
    userId: user.id,
    accountId,
    quantity: newQty,
    unitPrice: quote.unitPrice,
    fxRate: quote.fxToBase,
    valueBase: newQty * quote.unitPrice * quote.fxToBase,
  });

  return done(accountId);
}

// ====== 配息 / 利息 ======
// 共用內部：寫一筆「收入」transaction，不動 quantity / cost，
// realized_pnl_twd 累加（視為已實現現金收益）。
async function recordIncome(
  formData: FormData,
  type: "dividend" | "interest",
): Promise<FormState> {
  const accountId = String(formData.get("accountId") ?? "");
  const amount = Number(formData.get("amount"));
  const occurredAtRaw = String(formData.get("occurredAt") ?? "").trim();
  const userNote = String(formData.get("note") ?? "").trim() || null;

  if (!accountId) return { error: "缺少帳戶 ID" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "金額需為正數" };
  }

  let occurredAt: Date;
  if (occurredAtRaw) {
    const d = new Date(occurredAtRaw);
    if (Number.isNaN(d.getTime())) return { error: "時間格式無效" };
    occurredAt = d;
  } else {
    occurredAt = new Date();
  }

  const { supabase, user, account, error } = await loadAccount(accountId);
  if (error || !account || !user) return { error: error ?? "錯誤" };

  const newRealizedTotal = Number(account.realized_pnl_twd ?? 0) + amount;

  await supabase
    .from("accounts")
    .update({ realized_pnl_twd: newRealizedTotal })
    .eq("id", accountId);

  // 計算目前估值（給 value_after_base 填）
  const isManual = account.price_market === "manual";
  const curValue = isManual
    ? Number(account.manual_value_base ?? 0)
    : Number(account.quantity) *
      Number(account.last_unit_price ?? 0) *
      Number(account.last_fx_rate ?? 1);

  const noteLabel = type === "dividend" ? "配息" : "利息";
  const noteParts = [`${noteLabel} ${amount} TWD`];
  if (userNote) noteParts.push(userNote);

  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: accountId,
    type,
    quantity_after: Number(account.quantity),
    unit_price: null,
    fx_rate: null,
    value_after_base: curValue,
    realized_pnl: amount,
    cashflow_twd: amount, // 收到現金：正
    note: noteParts.join(" · "),
    created_at: occurredAt.toISOString(),
  });

  return done(accountId);
}

export async function recordDividend(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return recordIncome(formData, "dividend");
}

export async function recordInterest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return recordIncome(formData, "interest");
}

// ====== 歸檔 / 取消歸檔 ======
async function setStatus(
  accountId: string,
  status: "active" | "archived",
): Promise<FormState> {
  if (!accountId) return { error: "缺少帳戶 ID" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };
  const { error } = await supabase
    .from("accounts")
    .update({ status })
    .eq("id", accountId);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath(`/accounts/${accountId}`);
  return undefined;
}

export async function archiveAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return setStatus(String(formData.get("accountId") ?? ""), "archived");
}

export async function unarchiveAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return setStatus(String(formData.get("accountId") ?? ""), "active");
}

// 刪除帳戶
export async function deleteAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return { error: "缺少帳戶 ID" };
  const { supabase, user, error } = await loadAccount(accountId);
  if (error || !user) return { error: error ?? "錯誤" };

  const { error: delErr } = await supabase
    .from("accounts")
    .delete()
    .eq("id", accountId);
  if (delErr) return { error: delErr.message };

  revalidatePath("/");
  redirect("/");
}

// ====== 定期定額 actions ======

// 建立計劃
export async function createRecurringPlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accountId = String(formData.get("accountId") ?? "");
  const amount = Number(formData.get("amount"));
  const dayOfMonth = Number(formData.get("dayOfMonth"));
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!accountId) return { error: "缺少帳戶 ID" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "金額需為正數" };
  }
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
    return { error: "日期需為 1-28（避開月底）" };
  }
  const startDate = startDateRaw || todayTaipei();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { error: "起始日期格式錯誤" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  // 驗證 account 存在且非手動
  const { data: account } = await supabase
    .from("accounts")
    .select("id,price_market")
    .eq("id", accountId)
    .single();
  if (!account) return { error: "找不到帳戶" };
  if (account.price_market === "manual") {
    return { error: "手動帳戶無法設定定期定額" };
  }

  const nextRun = firstRunDate(startDate, dayOfMonth);

  const { error: insErr } = await supabase.from("recurring_plans").insert({
    user_id: user.id,
    account_id: accountId,
    amount_twd: amount,
    day_of_month: dayOfMonth,
    start_date: startDate,
    next_run_date: nextRun,
    active: true,
    note: note,
  });
  if (insErr) return { error: insErr.message };

  revalidatePath(`/accounts/${accountId}`);
  return undefined;
}

// 立即執行（手動觸發一次定額買入，並推進 next_run_date 到下一個月）
export async function executePlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = String(formData.get("planId") ?? "");
  if (!planId) return { error: "缺少計劃 ID" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const { data: plan, error: pErr } = await supabase
    .from("recurring_plans")
    .select("id,account_id,amount_twd,day_of_month,active")
    .eq("id", planId)
    .single();
  if (pErr || !plan) return { error: "找不到計劃" };
  if (!plan.active) return { error: "計劃已暫停，請先啟用" };

  const { account, error: aErr } = await loadAccount(plan.account_id);
  if (aErr || !account) return { error: aErr ?? "找不到帳戶" };

  const res = await applyContribution({
    supabase,
    userId: user.id,
    account,
    twd: Number(plan.amount_twd),
    priceOverride: null,
    fxOverride: null,
    occurredAt: new Date(),
    noteSuffix: "定期定額",
  });
  if (!res.ok) return { error: res.error };

  const today = todayTaipei();
  await supabase
    .from("recurring_plans")
    .update({
      last_run_date: today,
      next_run_date: nextMonthlyAfter(today, plan.day_of_month),
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  revalidatePath(`/accounts/${plan.account_id}`);
  revalidatePath("/");
  return undefined;
}

// 暫停 / 啟用
export async function togglePlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = String(formData.get("planId") ?? "");
  const newActive = String(formData.get("newActive") ?? "") === "true";
  if (!planId) return { error: "缺少計劃 ID" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const { data: plan } = await supabase
    .from("recurring_plans")
    .select("account_id")
    .eq("id", planId)
    .single();
  if (!plan) return { error: "找不到計劃" };

  await supabase
    .from("recurring_plans")
    .update({ active: newActive, updated_at: new Date().toISOString() })
    .eq("id", planId);

  revalidatePath(`/accounts/${plan.account_id}`);
  return undefined;
}

// 刪除計劃
export async function deletePlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = String(formData.get("planId") ?? "");
  if (!planId) return { error: "缺少計劃 ID" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "請先登入" };

  const { data: plan } = await supabase
    .from("recurring_plans")
    .select("account_id")
    .eq("id", planId)
    .single();
  if (!plan) return { error: "找不到計劃" };

  await supabase.from("recurring_plans").delete().eq("id", planId);
  revalidatePath(`/accounts/${plan.account_id}`);
  return undefined;
}
