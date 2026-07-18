import { describe, expect, it } from "vitest";
import {
  runPortfolioScenario,
  targetDeviationPct,
  type ScenarioHolding,
} from "./scenario";

const holdings: ScenarioHolding[] = [
  {
    id: "us-stock",
    name: "美股",
    symbol: "AAA",
    assetClass: "stock",
    market: "us",
    currency: "USD",
    valueTwd: 600,
  },
  {
    id: "tw-cash",
    name: "台幣現金",
    symbol: null,
    assetClass: "liquid_cash",
    market: "manual",
    currency: "TWD",
    valueTwd: 400,
  },
];

describe("runPortfolioScenario", () => {
  it("同一持倉的價格與匯率衝擊以乘法套用", () => {
    const result = runPortfolioScenario({
      holdings,
      shocks: [
        { id: "price", kind: "price", scope: "account", target: "us-stock", changePct: -20 },
        { id: "fx", kind: "fx", scope: "currency", target: "USD", changePct: -10 },
      ],
    });
    const stock = result.holdings.find((holding) => holding.id === "us-stock");
    expect(stock?.stressedValueTwd).toBeCloseTo(600 * 0.8 * 0.9, 8);
    expect(result.stressedTotalTwd).toBeCloseTo(832, 8);
    expect(result.stressChangePct).toBeCloseTo(-0.168, 8);
  });

  it("多個價格衝擊不相加，避免跌幅超過 100% 產生負估值", () => {
    const result = runPortfolioScenario({
      holdings,
      shocks: [
        { id: "one", kind: "price", scope: "all", target: null, changePct: -50 },
        { id: "two", kind: "price", scope: "account", target: "us-stock", changePct: -80 },
      ],
    });
    expect(result.holdings.find((holding) => holding.id === "us-stock")?.stressedValueTwd).toBeCloseTo(60, 8);
    expect(result.holdings.every((holding) => holding.stressedValueTwd >= 0)).toBe(true);
  });

  it("試買視為外部新增現金，買後權重合計為 100%", () => {
    const result = runPortfolioScenario({
      holdings,
      shocks: [],
      buyAccountId: "us-stock",
      buyAmountTwd: 500,
    });
    expect(result.finalTotalTwd).toBe(1500);
    expect(result.holdings.find((holding) => holding.id === "us-stock")?.finalValueTwd).toBe(1100);
    expect(result.holdings.reduce((sum, holding) => sum + holding.finalWeightPct, 0)).toBeCloseTo(100, 8);
  });

  it("計算配置目標的正負偏離", () => {
    const result = runPortfolioScenario({ holdings, shocks: [] });
    expect(targetDeviationPct({ result, targets: { stock: 50, liquid_cash: 50 } })).toEqual({
      stock: 10,
      liquid_cash: -10,
    });
  });
});
