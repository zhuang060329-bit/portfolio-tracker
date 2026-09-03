import { describe, it, expect } from "vitest";
import { fetchAllPages } from "./paginate";
import type { PostgrestError } from "@supabase/supabase-js";

// 模擬 PostgREST：不論呼叫端要多大的 range，最多只回 maxRows 列。
function makeSource(total: number, maxRows: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    page(from: number, to: number) {
      calls++;
      const size = Math.min(to - from + 1, maxRows);
      return Promise.resolve({
        data: rows.slice(from, from + size),
        error: null as PostgrestError | null,
      });
    },
  };
}

describe("fetchAllPages", () => {
  it("資料量小於單頁時一次取完", async () => {
    const src = makeSource(42, 1000);
    const { data, error, truncated } = await fetchAllPages(src.page);
    expect(error).toBeNull();
    expect(truncated).toBe(false);
    expect(data).toHaveLength(42);
  });

  it("超過 max-rows 時不截斷（這是修掉的 bug）", async () => {
    const src = makeSource(2500, 1000);
    const { data } = await fetchAllPages(src.page);
    expect(data).toHaveLength(2500);
    expect(data[2499]).toEqual({ id: 2499 });
  });

  it("max-rows 小於 pageSize 時仍拿得完整", async () => {
    // 專案把 Max rows 調成 500、呼叫端仍用 1000 分頁的情況。
    // 若用 pageSize 推進 offset，這裡會每頁跳過 500 列。
    const src = makeSource(1200, 500);
    const { data } = await fetchAllPages(src.page);
    expect(data).toHaveLength(1200);
    expect(data.map((r) => r.id)).toEqual(
      Array.from({ length: 1200 }, (_, i) => i),
    );
  });

  it("剛好整除頁長時會多打一次空查詢後結束", async () => {
    const src = makeSource(2000, 1000);
    const { data } = await fetchAllPages(src.page);
    expect(data).toHaveLength(2000);
    expect(src.calls).toBe(3); // 1000 + 1000 + 0
  });

  it("空結果集回空陣列", async () => {
    const src = makeSource(0, 1000);
    const { data, error } = await fetchAllPages(src.page);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("中途出錯時回傳錯誤，不假裝成功", async () => {
    const err = { message: "boom", code: "XX000" } as PostgrestError;
    let calls = 0;
    const { data, error } = await fetchAllPages((from, to) => {
      calls++;
      if (calls === 2) return Promise.resolve({ data: null, error: err });
      const size = to - from + 1;
      return Promise.resolve({
        data: Array.from({ length: size }, (_, i) => ({ id: from + i })),
        error: null as PostgrestError | null,
      });
    });
    expect(error).toBe(err);
    expect(data).toHaveLength(1000); // 已取回的部分照樣回傳，但 error 不為 null
  });
});

describe("fetchAllPages 的 maxRows", () => {
  it("拿滿 maxRows 就停，並回報 truncated", async () => {
    const src = makeSource(5_000, 1_000);
    const { data, truncated } = await fetchAllPages(src.page, 1_000, 2_500);

    expect(data).toHaveLength(2_500);
    expect(truncated).toBe(true);
  });

  it("maxRows 不是頁長倍數時，最後一頁只要剩下的量", async () => {
    const src = makeSource(5_000, 1_000);
    const { data } = await fetchAllPages(src.page, 1_000, 1_200);

    expect(data).toHaveLength(1_200);
    // 1000 + 200，兩次就夠，不會多抓一整頁再丟掉
    expect(src.calls).toBe(2);
  });

  it("總數少於 maxRows 時不算截斷", async () => {
    const src = makeSource(300, 1_000);
    const { data, truncated } = await fetchAllPages(src.page, 1_000, 2_500);

    expect(data).toHaveLength(300);
    expect(truncated).toBe(false);
  });
});
