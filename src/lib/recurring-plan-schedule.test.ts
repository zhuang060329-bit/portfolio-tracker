import { describe, expect, it } from "vitest";
import { firstMonthlyRunDate } from "./recurring-plan-schedule";

describe("firstMonthlyRunDate", () => {
  it("起始日在扣款日前時使用本月", () => {
    expect(firstMonthlyRunDate("2026-07-03", 5)).toBe("2026-07-05");
  });

  it("起始日等於扣款日時使用當天", () => {
    expect(firstMonthlyRunDate("2026-07-05", 5)).toBe("2026-07-05");
  });

  it("起始日已過扣款日時順延一個月", () => {
    expect(firstMonthlyRunDate("2026-07-06", 5)).toBe("2026-08-05");
  });

  it("十二月順延時跨年", () => {
    expect(firstMonthlyRunDate("2026-12-20", 5)).toBe("2027-01-05");
  });
});
