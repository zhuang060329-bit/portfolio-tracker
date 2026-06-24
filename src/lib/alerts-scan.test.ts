import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scanAlerts } from "./alerts-scan";

describe("scanAlerts", () => {
  it("以 profiles.id 讀取配置目標並觸發配置偏離警示", async () => {
    const profileSelects: string[] = [];
    const profileFilters: string[] = [];
    const notifications: unknown[] = [];

    const supabase = {
      from(table: string) {
        if (table === "alerts") {
          return {
            select() {
              return {
                async eq() {
                  return {
                    data: [
                      {
                        id: "alert-1",
                        user_id: "user-1",
                        type: "allocation_drift",
                        account_id: null,
                        threshold: 5,
                        note: null,
                        last_triggered_at: null,
                      },
                    ],
                    error: null,
                  };
                },
              };
            },
            update() {
              return {
                async eq() {
                  return { error: null };
                },
              };
            },
          };
        }

        if (table === "profiles") {
          return {
            select(columns: string) {
              profileSelects.push(columns);
              return {
                async in(column: string) {
                  profileFilters.push(column);
                  return {
                    data: [
                      {
                        id: "user-1",
                        allocation_targets: { stock: 50 },
                      },
                    ],
                  };
                },
              };
            },
          };
        }

        if (table === "accounts") {
          return {
            select() {
              return {
                in() {
                  return {
                    async eq() {
                      return {
                        data: [
                          {
                            id: "account-1",
                            user_id: "user-1",
                            name: "測試股票",
                            asset_class: "stock",
                            price_market: "tw",
                            symbol: "0050",
                            quantity: 10,
                            last_unit_price: 100,
                            last_fx_rate: 1,
                            manual_value_base: null,
                            status: "active",
                          },
                        ],
                      };
                    },
                  };
                },
              };
            },
          };
        }

        if (table === "notifications") {
          return {
            async insert(notification: unknown) {
              notifications.push(notification);
              return { error: null };
            },
          };
        }

        throw new Error(`未預期的資料表：${table}`);
      },
    } as unknown as SupabaseClient;

    const result = await scanAlerts(supabase);

    expect(profileSelects).toEqual(["id,allocation_targets"]);
    expect(profileFilters).toEqual(["id"]);
    expect(result).toEqual({ triggered: 1, errors: [] });
    expect(notifications).toHaveLength(1);
  });
});
