import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeApiQuota } from "@/lib/api-budget";
import {
  fetchTwTotalReturnSeries,
  parseFinmindDividends,
  parseFinmindPrices,
  parseFinmindSplits,
} from "./finmind-total-return";
import fixture from "../__fixtures__/finmind-0050.json";

vi.mock("@/lib/api-budget", () => ({
  consumeApiQuota: vi.fn(),
}));

const quotaMock = vi.mocked(consumeApiQuota);

describe("FinMind 資料列解析", () => {
  it("收盤：只留 date 與 close，丟掉無效的列", () => {
    expect(
      parseFinmindPrices([
        { date: "2026-09-29", close: 111.3, open: 110 },
        { date: "2026-09-30", close: "112.05" },
        { date: "2026-10-01", close: 0 },
        { date: "2026-10-02", close: null },
        { close: 100 },
      ]),
    ).toEqual([
      { date: "2026-09-29", close: 111.3 },
      { date: "2026-09-30", close: 112.05 },
    ]);
  });

  it("除權息：金額取「權值＋息值」", () => {
    expect(parseFinmindDividends(fixture.dividends)).toEqual([
      { date: "2025-01-17", amount: 2.7 },
      { date: "2025-07-21", amount: 0.36 },
      { date: "2026-01-22", amount: 1 },
      { date: "2026-07-21", amount: 0.6 },
    ]);
  });

  it("分割：比例 = 分割後參考價 ÷ 分割前收盤", () => {
    const [split] = parseFinmindSplits(fixture.splits);
    expect(split.date).toBe("2025-06-18");
    expect(split.ratio).toBeCloseTo(47.16 / 188.65, 12);
  });

  it("分割：前後價格無效的列被丟掉", () => {
    expect(
      parseFinmindSplits([
        { date: "2025-06-18", before_price: 0, after_price: 47.16 },
        { date: "2025-06-18", before_price: 188.65 },
      ]),
    ).toEqual([]);
  });
});

describe("fetchTwTotalReturnSeries", () => {
  const datasetOf = (url: string) =>
    new URL(url).searchParams.get("dataset") ?? "";

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify({ data }), { status });

  /** 依資料集回應；沒列到的資料集回 fixture 的內容。 */
  function stubFetch(overrides: Record<string, () => Response> = {}) {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const dataset = datasetOf(String(input));
      if (overrides[dataset]) return overrides[dataset]();
      if (dataset === "TaiwanStockPrice") return respond(fixture.prices);
      if (dataset === "TaiwanStockDividendResult") {
        return respond(fixture.dividends);
      }
      return respond(fixture.splits);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  beforeEach(() => {
    quotaMock.mockReset();
    quotaMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("抓三個資料集、扣 3 次額度，回傳還原後的序列", async () => {
    const fetchMock = stubFetch();

    const result = await fetchTwTotalReturnSeries("0050");

    expect(quotaMock).toHaveBeenCalledWith("finmind", 3);
    expect(fetchMock.mock.calls.map(([url]) => datasetOf(String(url))).sort()).toEqual([
      "TaiwanStockDividendResult",
      "TaiwanStockPrice",
      "TaiwanStockSplitPrice",
    ]);
    expect(result.dividendCount).toBe(4);
    expect(result.splitCount).toBe(1);
    expect(result.series).toHaveLength(fixture.prices.length);
    expect(result.series.at(-1)).toEqual({ date: "2026-09-30", close: 112.05 });
    // 分割前的第一列已經被還原到分割後的量級。
    expect(result.series[0].close).toBeLessThan(60);
  });

  it("預設走一小時的 fetch 快取，fresh 改成 no-store 且兩者不同時出現", async () => {
    const fetchMock = stubFetch();
    const initOf = (call: unknown[]) =>
      call[1] as RequestInit & { next?: { revalidate?: number } };

    await fetchTwTotalReturnSeries("0050");
    for (const call of fetchMock.mock.calls) {
      expect(initOf(call).next).toEqual({ revalidate: 3600 });
      expect(initOf(call).cache).toBeUndefined();
    }

    fetchMock.mockClear();
    await fetchTwTotalReturnSeries("0050", { fresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) {
      expect(initOf(call).cache).toBe("no-store");
      expect(initOf(call).next).toBeUndefined();
    }
  });

  it("額度用完時一個請求都不打", async () => {
    const fetchMock = stubFetch();
    quotaMock.mockRejectedValue(new Error("台股報價今日的共用額度已用完"));

    await expect(fetchTwTotalReturnSeries("0050")).rejects.toThrow("額度已用完");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("分割資料集失敗時往上丟，不回傳沒還原的序列", async () => {
    stubFetch({ TaiwanStockSplitPrice: () => respond(null, 400) });

    await expect(fetchTwTotalReturnSeries("0050")).rejects.toThrow(
      "FinMind TaiwanStockSplitPrice 回應 HTTP 400",
    );
  });

  it("回應沒有 data 陣列時往上丟", async () => {
    stubFetch({
      TaiwanStockDividendResult: () =>
        new Response(JSON.stringify({ msg: "success" }), { status: 200 }),
    });

    await expect(fetchTwTotalReturnSeries("0050")).rejects.toThrow(
      "FinMind TaiwanStockDividendResult 回應格式異常",
    );
  });

  it("查不到這個代號的收盤時往上丟", async () => {
    stubFetch({ TaiwanStockPrice: () => respond([]) });

    await expect(fetchTwTotalReturnSeries("9999")).rejects.toThrow(
      "FinMind 找不到台股 9999 的歷史收盤",
    );
  });
});
