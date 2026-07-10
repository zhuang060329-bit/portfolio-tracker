import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getQuote } from "@/lib/prices/router";
import { executeRecurringPlan } from "./contributions";

vi.mock("@/lib/prices/router", () => ({
  getQuote: vi.fn(),
}));

const quoteMock = vi.mocked(getQuote);
const ACCOUNT = {
  price_market: "us" as const,
  symbol: "VOO",
  status: "active",
};
const EXECUTED_AT = new Date("2026-07-10T02:00:00.000Z");

function clientWithRpc(
  result: { data: unknown; error: { message: string } | null },
) {
  const rpc = vi.fn().mockResolvedValue(result);
  return {
    client: { rpc } as unknown as SupabaseClient,
    rpc,
  };
}

describe("executeRecurringPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quoteMock.mockResolvedValue({
      unitPrice: 500,
      nativeCurrency: "USD",
      fxToBase: 32,
      asOf: "2026-07-10T01:59:00.000Z",
    });
  });

  it("只把識別、預期排程日期與報價傳給原子 RPC", async () => {
    const { client, rpc } = clientWithRpc({
      data: [
        {
          executed: true,
          shares_added: "0.625",
          new_quantity: "12.625",
          next_run_date: "2026-08-05",
        },
      ],
      error: null,
    });

    const result = await executeRecurringPlan({
      supabase: client,
      planId: "plan-1",
      expectedRunDate: "2026-07-05",
      account: ACCOUNT,
      source: "cron",
      executedAt: EXECUTED_AT,
    });

    expect(rpc).toHaveBeenCalledWith("execute_recurring_plan_mutation", {
      p_plan_id: "plan-1",
      p_expected_run_date: "2026-07-05",
      p_executed_at: EXECUTED_AT.toISOString(),
      p_unit_price: 500,
      p_fx_rate: 32,
      p_priced_at: "2026-07-10T01:59:00.000Z",
      p_source: "cron",
    });
    expect(result).toEqual({
      ok: true,
      executed: true,
      sharesAdded: 0.625,
      newQty: 12.625,
      nextRunDate: "2026-08-05",
    });
  });

  it("stale caller 回傳未執行，不視為錯誤", async () => {
    const { client } = clientWithRpc({
      data: [
        {
          executed: false,
          shares_added: null,
          new_quantity: null,
          next_run_date: "2026-08-05",
        },
      ],
      error: null,
    });

    await expect(
      executeRecurringPlan({
        supabase: client,
        planId: "plan-1",
        expectedRunDate: "2026-07-05",
        account: ACCOUNT,
        source: "manual",
        executedAt: EXECUTED_AT,
      }),
    ).resolves.toEqual({
      ok: true,
      executed: false,
      sharesAdded: null,
      newQty: null,
      nextRunDate: "2026-08-05",
    });
  });

  it("手動或封存帳戶在抓價前拒絕", async () => {
    const { client, rpc } = clientWithRpc({ data: null, error: null });

    const manual = await executeRecurringPlan({
      supabase: client,
      planId: "plan-1",
      expectedRunDate: "2026-07-05",
      account: { price_market: "manual", symbol: null },
      source: "manual",
    });
    const archived = await executeRecurringPlan({
      supabase: client,
      planId: "plan-1",
      expectedRunDate: "2026-07-05",
      account: { ...ACCOUNT, status: "archived" },
      source: "cron",
    });

    expect(manual).toEqual({
      ok: false,
      error: "手動帳戶無法執行定期定額",
    });
    expect(archived).toEqual({ ok: false, error: "帳戶已歸檔" });
    expect(quoteMock).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("抓價與 RPC 錯誤都回傳可顯示訊息", async () => {
    const { client } = clientWithRpc({
      data: null,
      error: { message: "database unavailable" },
    });
    const rpcError = await executeRecurringPlan({
      supabase: client,
      planId: "plan-1",
      expectedRunDate: "2026-07-05",
      account: ACCOUNT,
      source: "cron",
    });
    expect(rpcError).toEqual({ ok: false, error: "database unavailable" });

    quoteMock.mockRejectedValueOnce(new Error("rate limited"));
    const quoteError = await executeRecurringPlan({
      supabase: client,
      planId: "plan-2",
      expectedRunDate: "2026-07-05",
      account: ACCOUNT,
      source: "manual",
    });
    expect(quoteError).toEqual({
      ok: false,
      error: "抓價失敗：rate limited",
    });
  });

  it("拒絕無效報價與不完整 RPC 回應", async () => {
    const { client } = clientWithRpc({ data: [], error: null });
    const emptyResult = await executeRecurringPlan({
      supabase: client,
      planId: "plan-1",
      expectedRunDate: "2026-07-05",
      account: ACCOUNT,
      source: "cron",
    });
    expect(emptyResult).toEqual({
      ok: false,
      error: "定期定額執行結果無效",
    });

    quoteMock.mockResolvedValueOnce({
      unitPrice: 0,
      nativeCurrency: "USD",
      fxToBase: 32,
      asOf: "2026-07-10T01:59:00.000Z",
    });
    const invalidQuote = await executeRecurringPlan({
      supabase: client,
      planId: "plan-2",
      expectedRunDate: "2026-07-05",
      account: ACCOUNT,
      source: "manual",
    });
    expect(invalidQuote).toEqual({ ok: false, error: "報價或匯率無效" });
  });
});
