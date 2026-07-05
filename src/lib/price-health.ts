// 報價健康：cron 每日跑一次，任何追蹤中帳戶超過 36 小時沒更新
// 代表至少漏跑一輪（快照斷檔會讓日漲跌與 TWR 失真，壞了要看得到）。

export type PriceHealth = {
  tracked: number;
  lastPricedAt: string | null;
  staleAccounts: string[];
};

const STALE_MS = 36 * 3600 * 1000;

export function buildPriceHealth(
  rows: { name: string; last_priced_at: string | null }[],
  nowMs = Date.now(),
): PriceHealth {
  return {
    tracked: rows.length,
    lastPricedAt:
      rows
        .map((r) => r.last_priced_at)
        .filter((x): x is string => !!x)
        .sort()
        .pop() ?? null,
    staleAccounts: rows
      .filter(
        (r) =>
          !r.last_priced_at ||
          nowMs - new Date(r.last_priced_at).getTime() > STALE_MS,
      )
      .map((r) => r.name),
  };
}
