import { describe, expect, it } from "vitest";
import { buildPriceHealth } from "./price-health";

const H = 3600 * 1000;
const now = Date.parse("2026-07-06T12:00:00+08:00");
const at = (hoursAgo: number) => new Date(now - hoursAgo * H).toISOString();

describe("buildPriceHealth", () => {
  it("全部新鮮：無 stale，取最新一筆為最後成功時間", () => {
    const h = buildPriceHealth(
      [
        { name: "A", last_priced_at: at(20) },
        { name: "B", last_priced_at: at(2) },
      ],
      now,
    );
    expect(h.staleAccounts).toEqual([]);
    expect(h.lastPricedAt).toBe(at(2));
    expect(h.tracked).toBe(2);
  });

  it("超過 36 小時或從未更新 → 列入 stale", () => {
    const h = buildPriceHealth(
      [
        { name: "舊帳戶", last_priced_at: at(37) },
        { name: "沒抓過", last_priced_at: null },
        { name: "正常", last_priced_at: at(1) },
      ],
      now,
    );
    expect(h.staleAccounts).toEqual(["舊帳戶", "沒抓過"]);
  });

  it("無追蹤帳戶：tracked 0、lastPricedAt null", () => {
    expect(buildPriceHealth([], now)).toEqual({
      tracked: 0,
      lastPricedAt: null,
      staleAccounts: [],
    });
  });
});
