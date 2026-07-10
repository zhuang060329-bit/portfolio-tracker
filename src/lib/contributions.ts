import type { SupabaseClient } from "@supabase/supabase-js";
import { getQuote } from "@/lib/prices/router";
import {
  applyAccountMutation,
  type MutationSnapshot,
} from "@/lib/account-mutation";
import { todayTaipei } from "@/lib/dates";
import type { Market } from "@/lib/prices/types";

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
  const { supabase, account, twd, priceOverride, fxOverride, occurredAt } = args;

  if (account.price_market === "manual" || !account.symbol) {
    return { ok: false, error: "此操作僅限非手動帳戶" };
  }

  let quote;
  try {
    quote = await getQuote(
      account.price_market as Market,
      account.symbol,
      "TWD",
    );
  } catch (error) {
    return { ok: false, error: `抓價失敗：${(error as Error).message}` };
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
  const nativeAdded = fxUsed > 0 ? twd / fxUsed : 0;
  const newCostNative =
    Number(account.cost_basis_native ?? 0) + nativeAdded;

  const noteParts = [`加碼 ${twd} TWD`];
  if (args.noteSuffix) noteParts.push(args.noteSuffix);

  const occurredDate = occurredAt.toLocaleDateString("en-CA", {
    timeZone: "Asia/Taipei",
  });
  const snapshots: MutationSnapshot[] = [
    {
      snapshot_date: occurredDate,
      quantity: newQty,
      unit_price: priceUsed,
      fx_rate: fxUsed,
      value_base: newQty * priceUsed * fxUsed,
    },
  ];
  if (occurredDate !== todayTaipei()) {
    snapshots.push({
      snapshot_date: todayTaipei(),
      quantity: newQty,
      unit_price: quote.unitPrice,
      fx_rate: quote.fxToBase,
      value_base: newQty * quote.unitPrice * quote.fxToBase,
    });
  }

  const { error: mutationError } = await applyAccountMutation(supabase, {
    accountId: account.id,
    patch: {
      quantity: newQty,
      last_unit_price: quote.unitPrice,
      last_fx_rate: quote.fxToBase,
      last_priced_at: quote.asOf,
      cost_basis_twd: newCost,
      cost_basis_native: newCostNative,
    },
    transaction: {
      type: "adjust_quantity",
      quantity_after: newQty,
      unit_price: priceUsed,
      fx_rate: fxUsed,
      value_after_base: newQty * priceUsed * fxUsed,
      note: noteParts.join(" · "),
      created_at: occurredAt.toISOString(),
      cashflow_twd: -twd,
    },
    snapshots,
  });
  if (mutationError) return { ok: false, error: mutationError };

  return { ok: true, sharesAdded, newQty };
}

export type RecurringExecutionAccount = {
  price_market: "us" | "tw" | "crypto" | "manual";
  symbol: string | null;
  status?: string;
};

export type RecurringExecutionResult =
  | {
      ok: true;
      executed: boolean;
      sharesAdded: number | null;
      newQty: number | null;
      nextRunDate: string;
    }
  | { ok: false; error: string };

type RecurringRpcRow = {
  executed: boolean;
  shares_added: number | string | null;
  new_quantity: number | string | null;
  next_run_date: string;
};

// 報價在應用層取得；帳戶增量、流水、快照、ledger 與排程推進由單一 RPC 提交。
export async function executeRecurringPlan(args: {
  supabase: SupabaseClient;
  planId: string;
  expectedRunDate: string;
  account: RecurringExecutionAccount;
  source: "cron" | "manual";
  executedAt?: Date;
}): Promise<RecurringExecutionResult> {
  const { supabase, planId, expectedRunDate, account, source } = args;

  if (account.status === "archived") {
    return { ok: false, error: "帳戶已歸檔" };
  }
  if (account.price_market === "manual" || !account.symbol) {
    return { ok: false, error: "手動帳戶無法執行定期定額" };
  }

  let quote;
  try {
    quote = await getQuote(
      account.price_market as Market,
      account.symbol,
      "TWD",
    );
  } catch (error) {
    return { ok: false, error: `抓價失敗：${(error as Error).message}` };
  }

  if (
    !Number.isFinite(quote.unitPrice) ||
    quote.unitPrice <= 0 ||
    !Number.isFinite(quote.fxToBase) ||
    quote.fxToBase <= 0
  ) {
    return { ok: false, error: "報價或匯率無效" };
  }

  const executedAt = args.executedAt ?? new Date();
  const { data, error } = await supabase.rpc(
    "execute_recurring_plan_mutation",
    {
      p_plan_id: planId,
      p_expected_run_date: expectedRunDate,
      p_executed_at: executedAt.toISOString(),
      p_unit_price: quote.unitPrice,
      p_fx_rate: quote.fxToBase,
      p_priced_at: quote.asOf,
      p_source: source,
    },
  );
  if (error) return { ok: false, error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as RecurringRpcRow | null;
  if (!row || typeof row.executed !== "boolean" || !row.next_run_date) {
    return { ok: false, error: "定期定額執行結果無效" };
  }

  return {
    ok: true,
    executed: row.executed,
    sharesAdded:
      row.shares_added == null ? null : Number(row.shares_added),
    newQty: row.new_quantity == null ? null : Number(row.new_quantity),
    nextRunDate: row.next_run_date,
  };
}

export function nextMonthlyAfter(fromIso: string, dayOfMonth: number): string {
  const [year, month] = fromIso.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}
