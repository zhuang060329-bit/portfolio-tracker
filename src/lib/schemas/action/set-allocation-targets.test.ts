import { describe, expect, it } from "vitest";
import {
  SetAllocationTargetsSchema,
  SetConcentrationLimitSchema,
} from "./set-allocation-targets";

describe("SetAllocationTargetsSchema", () => {
  it("接受合計 100% 的配置目標", () => {
    expect(
      SetAllocationTargetsSchema.parse({ stock: "60", liquid_cash: "40" }),
    ).toEqual({ stock: 60, liquid_cash: 40 });
  });

  it("拒絕合計超過 100%", () => {
    expect(
      SetAllocationTargetsSchema.safeParse({ stock: "80", crypto: "30" }).success,
    ).toBe(false);
  });
});

describe("SetConcentrationLimitSchema", () => {
  it("接受 0 到 100 之間的集中度上限", () => {
    expect(
      SetConcentrationLimitSchema.parse({ concentrationLimitPct: "22.5" }),
    ).toEqual({ concentrationLimitPct: 22.5 });
  });

  it("拒絕 0 與超過 100% 的門檻", () => {
    expect(
      SetConcentrationLimitSchema.safeParse({ concentrationLimitPct: 0 }).success,
    ).toBe(false);
    expect(
      SetConcentrationLimitSchema.safeParse({ concentrationLimitPct: 101 }).success,
    ).toBe(false);
  });
});
