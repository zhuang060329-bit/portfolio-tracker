export type ScenarioHolding = {
  id: string;
  name: string;
  symbol: string | null;
  assetClass: string;
  market: string;
  currency: string;
  valueTwd: number;
};

export type ShockScope = "all" | "account" | "asset_class" | "market" | "currency";

export type ScenarioShock = {
  id: string;
  kind: "price" | "fx";
  scope: ShockScope;
  target: string | null;
  changePct: number;
};

export type ScenarioHoldingResult = ScenarioHolding & {
  priceFactor: number;
  fxFactor: number;
  stressedValueTwd: number;
  proposedBuyTwd: number;
  finalValueTwd: number;
  currentWeightPct: number;
  finalWeightPct: number;
};

export type ScenarioResult = {
  currentTotalTwd: number;
  stressedTotalTwd: number;
  proposedBuyTwd: number;
  finalTotalTwd: number;
  stressChangeTwd: number;
  stressChangePct: number;
  holdings: ScenarioHoldingResult[];
  assetClassWeights: Record<string, number>;
  assumptions: string[];
};

export function runPortfolioScenario({
  holdings,
  shocks,
  buyAccountId = null,
  buyAmountTwd = 0,
}: {
  holdings: ScenarioHolding[];
  shocks: ScenarioShock[];
  buyAccountId?: string | null;
  buyAmountTwd?: number;
}): ScenarioResult {
  const currentTotalTwd = holdings.reduce(
    (sum, holding) => sum + finiteNonNegative(holding.valueTwd),
    0,
  );
  const safeBuyAmount = buyAccountId ? finiteNonNegative(buyAmountTwd) : 0;
  const intermediate = holdings.map((holding) => {
    const priceFactor = factorFor(holding, shocks, "price");
    const fxFactor = factorFor(holding, shocks, "fx");
    const stressedValueTwd = finiteNonNegative(holding.valueTwd) * priceFactor * fxFactor;
    const proposedBuyTwd = holding.id === buyAccountId ? safeBuyAmount : 0;
    return { ...holding, priceFactor, fxFactor, stressedValueTwd, proposedBuyTwd };
  });
  const stressedTotalTwd = intermediate.reduce(
    (sum, holding) => sum + holding.stressedValueTwd,
    0,
  );
  const finalTotalTwd = stressedTotalTwd + safeBuyAmount;
  const resultHoldings: ScenarioHoldingResult[] = intermediate
    .map((holding) => {
      const finalValueTwd = holding.stressedValueTwd + holding.proposedBuyTwd;
      return {
        ...holding,
        finalValueTwd,
        currentWeightPct:
          currentTotalTwd > 0
            ? (finiteNonNegative(holding.valueTwd) / currentTotalTwd) * 100
            : 0,
        finalWeightPct: finalTotalTwd > 0 ? (finalValueTwd / finalTotalTwd) * 100 : 0,
      };
    })
    .sort((left, right) => right.finalValueTwd - left.finalValueTwd || left.name.localeCompare(right.name));

  const assetClassWeights: Record<string, number> = {};
  for (const holding of resultHoldings) {
    assetClassWeights[holding.assetClass] =
      (assetClassWeights[holding.assetClass] ?? 0) + holding.finalWeightPct;
  }

  return {
    currentTotalTwd,
    stressedTotalTwd,
    proposedBuyTwd: safeBuyAmount,
    finalTotalTwd,
    stressChangeTwd: stressedTotalTwd - currentTotalTwd,
    stressChangePct:
      currentTotalTwd > 0 ? (stressedTotalTwd - currentTotalTwd) / currentTotalTwd : 0,
    holdings: resultHoldings,
    assetClassWeights,
    assumptions: [
      "同一持倉的多個價格與匯率衝擊以乘法依序套用。",
      "未計稅費、滑價、相關性改變與衝擊發生順序。",
      "試買金額視為外部新增現金，於壓力情境估值後投入，不扣除其他帳戶現金。",
    ],
  };
}

export function targetDeviationPct({
  result,
  targets,
}: {
  result: ScenarioResult;
  targets: Record<string, number>;
}): Record<string, number> {
  const classes = new Set([
    ...Object.keys(result.assetClassWeights),
    ...Object.keys(targets),
  ]);
  const deviations: Record<string, number> = {};
  for (const assetClass of classes) {
    deviations[assetClass] =
      (result.assetClassWeights[assetClass] ?? 0) - Number(targets[assetClass] ?? 0);
  }
  return deviations;
}

function factorFor(
  holding: ScenarioHolding,
  shocks: ScenarioShock[],
  kind: ScenarioShock["kind"],
): number {
  return shocks
    .filter((shock) => shock.kind === kind && matchesScope(holding, shock))
    .reduce((factor, shock) => factor * Math.max(0, 1 + clampChange(shock.changePct) / 100), 1);
}

function matchesScope(holding: ScenarioHolding, shock: ScenarioShock): boolean {
  if (shock.scope === "all") return true;
  if (shock.scope === "account") return holding.id === shock.target;
  if (shock.scope === "asset_class") return holding.assetClass === shock.target;
  if (shock.scope === "market") return holding.market === shock.target;
  return holding.currency === shock.target;
}

function clampChange(value: number): number {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(-100, Math.min(1000, Number(value)));
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}
