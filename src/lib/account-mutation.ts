import type { SupabaseClient } from "@supabase/supabase-js";

// apply_account_mutation RPC 的 TS 包裝（見 supabase/rpc-mutations.sql）。
// 「更新帳戶 + 寫流水 + upsert 快照」在 Postgres 端是單一交易：
// 任一步失敗整體回滾，不會再有「帳已變、流水沒寫」的 partial state。
// 權限走 security invoker + RLS：user client 只能動自己的帳戶，
// cron 的 service client 行為與直接寫表相同。

/** accounts 可部分更新的欄位；未出現的鍵保持原值（無法藉此設 NULL） */
export type AccountPatch = {
  quantity?: number;
  cost_basis_twd?: number;
  cost_basis_native?: number;
  realized_pnl_twd?: number;
  last_unit_price?: number;
  last_fx_rate?: number;
  last_priced_at?: string;
  manual_value_base?: number;
};

export type MutationTransaction = {
  type: string;
  quantity_after?: number | null;
  unit_price?: number | null;
  fx_rate?: number | null;
  value_after_base?: number | null;
  note?: string | null;
  created_at?: string;
  cashflow_twd?: number | null;
  realized_pnl?: number | null;
};

export type MutationSnapshot = {
  snapshot_date: string;
  quantity: number;
  unit_price: number | null;
  fx_rate: number;
  value_base: number;
};

export type IncomeImportRow = {
  accId: string;
  type: "dividend" | "interest";
  amount: number;
  occurredAt: string;
  note: string | null;
};

export async function applyAccountMutation(
  supabase: SupabaseClient,
  args: {
    accountId: string;
    patch?: AccountPatch;
    transaction?: MutationTransaction | null;
    snapshots?: MutationSnapshot[];
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("apply_account_mutation", {
    p_account_id: args.accountId,
    p_account_patch: args.patch ?? {},
    p_transaction: args.transaction ?? null,
    p_snapshots: args.snapshots ?? [],
  });
  return { error: error ? error.message : null };
}

export async function importIncomeTransactions(
  supabase: SupabaseClient,
  rows: IncomeImportRow[],
): Promise<{ imported: number; error: string | null }> {
  const { data, error } = await supabase.rpc("import_income_transactions", {
    p_rows: rows.map((row) => ({
      account_id: row.accId,
      type: row.type,
      amount: row.amount,
      occurred_at: row.occurredAt,
      note: row.note,
    })),
  });

  if (error) return { imported: 0, error: error.message };

  if (data === null || data === undefined) {
    return { imported: 0, error: "收益匯入結果無效" };
  }

  const imported = Number(data);
  if (!Number.isInteger(imported) || imported < 0) {
    return { imported: 0, error: "收益匯入結果無效" };
  }

  return { imported, error: null };
}
