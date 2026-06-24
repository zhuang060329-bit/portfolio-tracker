import type { SupabaseClient } from "@supabase/supabase-js";

type AccountPatch = {
  quantity?: number;
  lastUnitPrice?: number | null;
  lastFxRate?: number;
  lastPricedAt?: string | null;
  manualValueBase?: number | null;
  costBasisTwd?: number;
  costBasisNative?: number;
  realizedPnlTwd?: number;
};

export type AccountTransaction = {
  type: string;
  quantityAfter: number;
  unitPrice: number | null;
  fxRate: number | null;
  valueAfterBase: number;
  cashflowTwd: number;
  realizedPnl?: number | null;
  note?: string | null;
  createdAt?: string;
};

export type AccountSnapshot = {
  snapshotDate: string;
  quantity: number;
  unitPrice: number | null;
  fxRate: number;
  valueBase: number;
};

function toAccountPayload(patch: AccountPatch) {
  const payload: Record<string, number | string | null> = {};
  if (patch.quantity !== undefined) payload.quantity = patch.quantity;
  if (patch.lastUnitPrice !== undefined) {
    payload.last_unit_price = patch.lastUnitPrice;
  }
  if (patch.lastFxRate !== undefined) payload.last_fx_rate = patch.lastFxRate;
  if (patch.lastPricedAt !== undefined) {
    payload.last_priced_at = patch.lastPricedAt;
  }
  if (patch.manualValueBase !== undefined) {
    payload.manual_value_base = patch.manualValueBase;
  }
  if (patch.costBasisTwd !== undefined) {
    payload.cost_basis_twd = patch.costBasisTwd;
  }
  if (patch.costBasisNative !== undefined) {
    payload.cost_basis_native = patch.costBasisNative;
  }
  if (patch.realizedPnlTwd !== undefined) {
    payload.realized_pnl_twd = patch.realizedPnlTwd;
  }
  return payload;
}

function toTransactionPayload(transaction: AccountTransaction) {
  return {
    type: transaction.type,
    quantity_after: transaction.quantityAfter,
    unit_price: transaction.unitPrice,
    fx_rate: transaction.fxRate,
    value_after_base: transaction.valueAfterBase,
    cashflow_twd: transaction.cashflowTwd,
    realized_pnl: transaction.realizedPnl ?? null,
    note: transaction.note ?? null,
    created_at: transaction.createdAt ?? null,
  };
}

function toSnapshotPayload(snapshot: AccountSnapshot) {
  return {
    snapshot_date: snapshot.snapshotDate,
    quantity: snapshot.quantity,
    unit_price: snapshot.unitPrice,
    fx_rate: snapshot.fxRate,
    value_base: snapshot.valueBase,
  };
}

export async function applyAccountMutation(
  supabase: SupabaseClient,
  args: {
    accountId: string;
    patch: AccountPatch;
    transaction: AccountTransaction;
    snapshots: AccountSnapshot[];
  },
): Promise<string | null> {
  const { error } = await supabase.rpc("apply_account_mutation", {
    p_account_id: args.accountId,
    p_account: toAccountPayload(args.patch),
    p_transaction: toTransactionPayload(args.transaction),
    p_snapshots: args.snapshots.map(toSnapshotPayload),
  });
  return error?.message ?? null;
}

export async function createAccountWithInitialRecords(
  supabase: SupabaseClient,
  args: {
    account: {
      name: string;
      assetClass: string;
      priceMarket: string;
      symbol: string | null;
      quantity: number;
      nativeCurrency: string;
      unitPrice: number | null;
      fxToBase: number;
      manualValueBase: number | null;
      lastPricedAt: string | null;
      costBasisTwd: number;
      costBasisNative: number;
    };
    transaction: AccountTransaction;
    snapshot: AccountSnapshot;
  },
): Promise<string | null> {
  const { account, transaction, snapshot } = args;
  const { error } = await supabase.rpc("create_account_with_initial_records", {
    p_account: {
      name: account.name,
      asset_class: account.assetClass,
      price_market: account.priceMarket,
      symbol: account.symbol,
      quantity: account.quantity,
      native_currency: account.nativeCurrency,
      last_unit_price: account.unitPrice,
      last_fx_rate: account.fxToBase,
      manual_value_base: account.manualValueBase,
      last_priced_at: account.lastPricedAt,
      cost_basis_twd: account.costBasisTwd,
      cost_basis_native: account.costBasisNative,
    },
    p_transaction: toTransactionPayload(transaction),
    p_snapshot: toSnapshotPayload(snapshot),
  });
  return error?.message ?? null;
}
