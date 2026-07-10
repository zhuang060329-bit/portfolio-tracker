import { describe, expect, it } from "vitest";
import { sliceByRange, sliceToCommonStart } from "./chart-data";
import type { PerfPoint } from "./DashboardCharts";

describe("chart data boundaries", () => {
  it("月區間使用日曆日期，不受執行環境時區影響", () => {
    const data = [
      { date: "2026-05-31", value: 1 },
      { date: "2026-06-01", value: 2 },
      { date: "2026-07-01", value: 3 },
    ];

    expect(sliceByRange(data, "1M", "2026-07-01")).toEqual([
      { date: "2026-06-01", value: 2 },
      { date: "2026-07-01", value: 3 },
    ]);
  });

  it("YTD 從同一日曆年的一月一日開始", () => {
    const data = [
      { date: "2025-12-31", value: 1 },
      { date: "2026-01-01", value: 2 },
      { date: "2026-07-01", value: 3 },
    ];

    expect(sliceByRange(data, "YTD", "2026-07-01")).toEqual([
      { date: "2026-01-01", value: 2 },
      { date: "2026-07-01", value: 3 },
    ]);
  });

  it("所有啟用線有數字後才建立共同起點", () => {
    const data: PerfPoint[] = [
      { date: "2026-01-01", portfolio: 100 },
      { date: "2026-01-02", portfolio: 101, spy: 99 },
      { date: "2026-01-03", portfolio: 102, spy: 100, btc: 80 },
      { date: "2026-01-04", portfolio: 103, spy: 101, btc: 82 },
    ];

    expect(sliceToCommonStart(data, ["portfolio", "spy", "btc"])).toEqual(
      data.slice(2),
    );
  });

  it("找不到共同起點時回傳空陣列", () => {
    const data: PerfPoint[] = [
      { date: "2026-01-01", portfolio: 100 },
      { date: "2026-01-02", spy: 99 },
    ];

    expect(sliceToCommonStart(data, ["portfolio", "spy"])).toEqual([]);
  });
});
