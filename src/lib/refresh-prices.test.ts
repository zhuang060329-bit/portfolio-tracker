import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// refreshAccountPrices 的行為測試，聚焦兩件監控相關的事：
// 1. 帳戶清單查詢失敗時必須標記 queryFailed，不能只回 ok=0/failed=0——
//    那和「今天沒有待刷帳戶」長得一樣，整條 cron 掛掉會被讀成正常。
// 2. byMarket 依市場分列成功／失敗，cron log 才看得出是哪一家上游掛了。

const getQuote = vi.fn();
vi.mock("@/lib/prices/router", () => ({
  getQuote: (...args: unknown[]) => getQuote(...args),
}));

const applyAccountMutation = vi.fn();
vi.mock("@/lib/account-mutation", () => ({
  applyAccountMutation: (...args: unknown[]) => applyAccountMutation(...args),
}));

import { refreshAccountPrices } from "./refresh-prices";

type Account = {
  id: string;
  user_id: string;
  price_market: string;
  symbol: string;
  quantity: number;
};

// 只鋪出 refreshAccountPrices 實際走過的那條 query chain。
function fakeSupabase(result: {
  data: Account[] | null;
  error: { code?: string } | null;
}) {
  return {
    from: () => ({
      select: () => ({
        neq: () => ({
          not: () => ({
            eq: () => Promise.resolve(result),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const account = (id: string, market: string, symbol: string): Account => ({
  id,
  user_id: "u1",
  price_market: market,
  symbol,
  quantity: 10,
});

beforeEach(() => {
  vi.clearAllMocks();
  getQuote.mockResolvedValue({
    unitPrice: 100,
    nativeCurrency: "TWD",
    fxToBase: 1,
    asOf: "2026-09-04T00:00:00.000Z",
  });
  applyAccountMutation.mockResolvedValue({ error: null });
});

describe("refreshAccountPrices", () => {
  it("查詢帳戶清單失敗時標記 queryFailed，且不外洩 Postgres 原文", async () => {
    const result = await refreshAccountPrices(
      fakeSupabase({ data: null, error: { code: "42501" } }),
    );

    expect(result.queryFailed).toBe(true);
    expect(result.ok).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toEqual(["查詢帳戶清單失敗 code=42501"]);
  });

  it("沒有待刷帳戶時 queryFailed 為 false（與查詢失敗區分開）", async () => {
    const result = await refreshAccountPrices(
      fakeSupabase({ data: [], error: null }),
    );

    expect(result.queryFailed).toBe(false);
    expect(result.ok).toBe(0);
    expect(result.byMarket).toEqual({});
  });

  it("byMarket 依市場分列成功與失敗", async () => {
    getQuote.mockImplementation((market: string) =>
      market === "tw"
        ? Promise.reject(new Error("上游無回應"))
        : Promise.resolve({
            unitPrice: 100,
            nativeCurrency: "TWD",
            fxToBase: 1,
            asOf: "2026-09-04T00:00:00.000Z",
          }),
    );

    const result = await refreshAccountPrices(
      fakeSupabase({
        data: [
          account("a1", "us", "QQQM"),
          account("a2", "us", "VT"),
          account("a3", "tw", "2330"),
        ],
        error: null,
      }),
    );

    expect(result.ok).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.byMarket).toEqual({
      us: { ok: 2, failed: 0 },
      tw: { ok: 0, failed: 1 },
    });
  });

  it("寫入失敗也算進該市場的 failed，不會被靜默吞掉", async () => {
    applyAccountMutation.mockResolvedValue({ error: "寫入衝突" });

    const result = await refreshAccountPrices(
      fakeSupabase({ data: [account("a1", "crypto", "bitcoin")], error: null }),
    );

    expect(result.ok).toBe(0);
    expect(result.byMarket).toEqual({ crypto: { ok: 0, failed: 1 } });
  });
});
