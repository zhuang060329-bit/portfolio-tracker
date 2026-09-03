import type { PostgrestError } from "@supabase/supabase-js";

/**
 * 逐頁取回完整結果集。
 *
 * PostgREST 的 `db-max-rows`（Supabase 預設 1000）是**硬上限**：
 * `.limit(20000)` 這種寫法會被直接壓回上限，而且不報錯、不警告。
 * 需要完整資料的地方（匯出備份、稅務報表、匯入去重）只能用 `.range()`
 * 一頁一頁拿，否則就是靜默少資料。
 *
 * 推進量用「實際拿到的列數」而不是 pageSize：專案的 max-rows 若被調成
 * 小於 pageSize，用 pageSize 推進會跳過中間的列。
 * 終止條件是「某一頁回 0 列」，代價是最後多打一次空查詢，換取不論
 * max-rows 設多少都拿得完整。
 */
export const SUPABASE_PAGE_SIZE = 1000;

// 防呆上限，同時是 maxRows 的預設值：避免呼叫端排序不穩定或上游行為異常時無限迴圈。
const HARD_CAP = 200_000;

export async function fetchAllPages<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize: number = SUPABASE_PAGE_SIZE,
  maxRows: number = HARD_CAP,
): Promise<{ data: T[]; error: PostgrestError | null; truncated: boolean }> {
  const all: T[] = [];
  let from = 0;

  for (;;) {
    // 拿滿 maxRows 就停，並告知呼叫端資料不完整。
    // 頁面若要顯示「資料已截斷」提示，靠的是這面旗標而不是
    // `rows.length >= LIMIT`——後者在 max-rows 硬上限之下永遠不成立。
    const remaining = maxRows - all.length;
    if (remaining <= 0) return { data: all, error: null, truncated: true };

    const size = Math.min(pageSize, remaining);
    const { data, error } = await page(from, from + size - 1);
    if (error) return { data: all, error, truncated: false };

    const rows = data ?? [];
    if (rows.length === 0) return { data: all, error: null, truncated: false };

    all.push(...rows);
    from += rows.length;
  }
}
