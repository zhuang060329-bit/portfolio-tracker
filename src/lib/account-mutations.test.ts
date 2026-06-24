import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyAccountMutation } from "./account-mutations";

describe("applyAccountMutation", () => {
  it("以單一 RPC 提交帳戶、交易與快照資料", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const supabase = { rpc } as unknown as SupabaseClient;

    const error = await applyAccountMutation(supabase, {
      accountId: "account-1",
      patch: { quantity: 2, lastUnitPrice: 100 },
      transaction: {
        type: "adjust_quantity",
        quantityAfter: 2,
        unitPrice: 100,
        fxRate: 1,
        valueAfterBase: 200,
        cashflowTwd: -100,
      },
      snapshots: [{
        snapshotDate: "2026-06-25",
        quantity: 2,
        unitPrice: 100,
        fxRate: 1,
        valueBase: 200,
      }],
    });

    expect(error).toBeNull();
    expect(rpc).toHaveBeenCalledWith("apply_account_mutation", {
      p_account_id: "account-1",
      p_account: { quantity: 2, last_unit_price: 100 },
      p_transaction: {
        type: "adjust_quantity",
        quantity_after: 2,
        unit_price: 100,
        fx_rate: 1,
        value_after_base: 200,
        cashflow_twd: -100,
        realized_pnl: null,
        note: null,
        created_at: null,
      },
      p_snapshots: [{
        snapshot_date: "2026-06-25",
        quantity: 2,
        unit_price: 100,
        fx_rate: 1,
        value_base: 200,
      }],
    });
  });
});
