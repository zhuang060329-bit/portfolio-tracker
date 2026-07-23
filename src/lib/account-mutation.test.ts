import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { importIncomeTransactions } from "./account-mutation";

function clientWithRpc(
  result: { data: unknown; error: { message: string } | null },
) {
  const rpc = vi.fn().mockResolvedValue(result);
  return {
    client: { rpc } as unknown as SupabaseClient,
    rpc,
  };
}

describe("importIncomeTransactions", () => {
  it("只傳送收益業務欄位給原子 RPC", async () => {
    const { client, rpc } = clientWithRpc({ data: 1, error: null });

    const result = await importIncomeTransactions(client, [
      {
        accId: "account-1",
        type: "dividend",
        amount: 125.5,
        occurredAt: "2026-07-10T02:00:00.000Z",
        note: "VOO 配息",
      },
    ]);

    expect(rpc).toHaveBeenCalledWith("import_income_transactions", {
      p_rows: [
        {
          account_id: "account-1",
          type: "dividend",
          amount: 125.5,
          occurred_at: "2026-07-10T02:00:00.000Z",
          note: "VOO 配息",
        },
      ],
    });
    expect(result).toEqual({ imported: 1, error: null });
  });

  it("傳回資料庫錯誤，並拒絕無效回應", async () => {
    const rpcError = clientWithRpc({
      data: null,
      error: { message: "transaction failed" },
    });
    await expect(
      importIncomeTransactions(rpcError.client, []),
    ).resolves.toEqual({ imported: 0, error: "transaction failed" });

    const invalidResult = clientWithRpc({ data: null, error: null });
    await expect(
      importIncomeTransactions(invalidResult.client, []),
    ).resolves.toEqual({ imported: 0, error: "收益匯入結果無效" });
  });
});
