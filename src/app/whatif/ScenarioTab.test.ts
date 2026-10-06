import { describe, expect, it } from "vitest";
import type { ScenarioHolding } from "@/lib/scenario";
import { relevantTemplates } from "./ScenarioTab";

const holding = (overrides: Partial<ScenarioHolding>): ScenarioHolding => ({
  id: "h",
  name: "持倉",
  symbol: null,
  assetClass: "fund",
  market: "us",
  currency: "USD",
  valueTwd: 100,
  ...overrides,
});

describe("relevantTemplates", () => {
  it("範本只留命中持倉的規則，沒有的類別不佔名額", () => {
    const templates = relevantTemplates([
      holding({ id: "voo", assetClass: "fund", market: "us", currency: "USD" }),
      holding({ id: "0050", assetClass: "stock", market: "tw", currency: "TWD" }),
      holding({ id: "gold", assetClass: "precious_metal", market: "manual", currency: "TWD" }),
    ]);
    const global = templates.find((template) => template.label === "全球風險下降")!;
    expect(global.shocks.map((shock) => shock.target)).toEqual(["fund", "stock", "precious_metal", "USD"]);
    expect(templates.map((template) => template.label)).toEqual(["全球風險下降", "台股修正", "美元回落"]);
  });

  it("一條規則都命中不了的持倉組合，不顯示任何範本", () => {
    expect(
      relevantTemplates([holding({ assetClass: "liquid_cash", market: "manual", currency: "TWD" })]),
    ).toEqual([]);
  });
});
