export type ReplayAccount = {
  id: string;
  name: string;
  assetClass: string;
  symbol: string | null;
  priceMarket: string;
  createdAt: string;
};

export type ReplaySnapshot = {
  accountId: string;
  date: string;
  quantity: number;
  unitPrice: number | null;
  fxRate: number | null;
  valueBase: number;
  costBasisTwd: number | null;
  costBasisNative: number | null;
  realizedPnlTwd: number | null;
  accountStatus: "active" | "archived" | null;
};

export type AccountStatusEvent = {
  accountId: string;
  status: "active" | "archived";
  effectiveAt: string;
  source: "account_create" | "account_update" | "migration_baseline";
};

export type ReplayTransaction = {
  accountId: string;
  type: string;
  cashflowTwd: number | null;
  realizedPnlTwd: number | null;
  createdAt: string;
};

export type ReplayHolding = {
  accountId: string;
  name: string;
  assetClass: string;
  symbol: string | null;
  valueTwd: number;
  quantity: number;
  unitPrice: number | null;
  fxRate: number | null;
  costBasisTwd: number | null;
  realizedPnlTwd: number | null;
  snapshotDate: string;
  carriedForward: boolean;
  statusKnown: boolean;
};

export type PortfolioReplay = {
  targetDate: string;
  totalValueTwd: number;
  totalCostBasisTwd: number | null;
  holdings: ReplayHolding[];
  gaps: string[];
};

export type AttributionResult = {
  openingValueTwd: number;
  endingValueTwd: number;
  contributionsTwd: number;
  withdrawalsTwd: number;
  scopeContributionTwd: number;
  scopeWithdrawalTwd: number;
  incomeTwd: number;
  marketPriceEffectTwd: number;
  fxEffectTwd: number;
  realizedPnlMemoTwd: number;
  residualTwd: number;
  toleranceTwd: number;
  reconciled: boolean;
  gaps: string[];
};

export function replayPortfolioAsOf({
  targetDate,
  accounts,
  snapshots,
  statusEvents,
  sourceTruncated = false,
}: {
  targetDate: string;
  accounts: ReplayAccount[];
  snapshots: ReplaySnapshot[];
  statusEvents: AccountStatusEvent[];
  sourceTruncated?: boolean;
}): PortfolioReplay {
  const gaps = new Set<string>();
  if (sourceTruncated) gaps.add("快照查詢已達筆數上限，較舊資料可能未載入");

  const holdings: ReplayHolding[] = [];
  for (const account of accounts) {
    if (taipeiDate(account.createdAt) > targetDate) continue;

    const candidates = snapshots
      .filter((snapshot) => snapshot.accountId === account.id && snapshot.date <= targetDate)
      .sort((left, right) => right.date.localeCompare(left.date));
    const selected = candidates[0];
    if (!selected) {
      gaps.add(`${account.name} 在 ${targetDate} 或之前沒有快照`);
      continue;
    }

    const status = statusAsOf(account.id, targetDate, selected, statusEvents);
    if (status.value === "archived") continue;
    if (!status.known) {
      gaps.add(`${account.name} 的歷史封存狀態不完整`);
    }
    if (selected.unitPrice == null && account.priceMarket !== "manual") {
      gaps.add(`${account.name} 的 ${selected.date} 快照缺少單價`);
    }
    if (selected.fxRate == null) gaps.add(`${account.name} 的 ${selected.date} 快照缺少匯率`);
    if (selected.costBasisTwd == null) gaps.add(`${account.name} 的歷史成本未知`);

    holdings.push({
      accountId: account.id,
      name: account.name,
      assetClass: account.assetClass,
      symbol: account.symbol,
      valueTwd: Number(selected.valueBase),
      quantity: Number(selected.quantity),
      unitPrice: numberOrNull(selected.unitPrice),
      fxRate: numberOrNull(selected.fxRate),
      costBasisTwd: numberOrNull(selected.costBasisTwd),
      realizedPnlTwd: numberOrNull(selected.realizedPnlTwd),
      snapshotDate: selected.date,
      carriedForward: selected.date !== targetDate,
      statusKnown: status.known,
    });
  }

  holdings.sort((left, right) => right.valueTwd - left.valueTwd || left.name.localeCompare(right.name));
  const knownCosts = holdings.filter((holding) => holding.costBasisTwd != null);

  return {
    targetDate,
    totalValueTwd: holdings.reduce((sum, holding) => sum + holding.valueTwd, 0),
    totalCostBasisTwd:
      knownCosts.length === holdings.length
        ? knownCosts.reduce((sum, holding) => sum + Number(holding.costBasisTwd), 0)
        : null,
    holdings,
    gaps: [...gaps],
  };
}

export function attributePortfolioPeriod({
  opening,
  ending,
  snapshots,
  transactions,
  scopeContributionTwd = 0,
  scopeWithdrawalTwd = 0,
  scopeGaps = [],
}: {
  opening: PortfolioReplay;
  ending: PortfolioReplay;
  snapshots: ReplaySnapshot[];
  transactions: ReplayTransaction[];
  scopeContributionTwd?: number;
  scopeWithdrawalTwd?: number;
  scopeGaps?: string[];
}): AttributionResult {
  const gaps = new Set([...opening.gaps, ...ending.gaps, ...scopeGaps]);
  let contributionsTwd = 0;
  let withdrawalsTwd = 0;
  let incomeTwd = 0;
  let realizedPnlMemoTwd = 0;

  for (const transaction of transactions) {
    const date = taipeiDate(transaction.createdAt);
    if (date <= opening.targetDate || date > ending.targetDate) continue;
    const cashflow = numberOrNull(transaction.cashflowTwd);
    if (cashflow == null) {
      gaps.add(`交易 ${date} 缺少現金流，已留在未解釋差額`);
    } else if (cashflow < 0) {
      contributionsTwd += -cashflow;
    } else if (cashflow > 0) {
      withdrawalsTwd += cashflow;
      if (transaction.type === "dividend" || transaction.type === "interest") {
        incomeTwd += cashflow;
      }
    }
    realizedPnlMemoTwd += Number(transaction.realizedPnlTwd ?? 0);
  }

  let marketPriceEffectTwd = 0;
  let fxEffectTwd = 0;
  const accountIds = new Set([
    ...opening.holdings.map((holding) => holding.accountId),
    ...ending.holdings.map((holding) => holding.accountId),
    ...snapshots.map((snapshot) => snapshot.accountId),
  ]);

  for (const accountId of accountIds) {
    const points = periodPoints(accountId, opening, ending, snapshots);
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      if (
        previous.unitPrice == null ||
        current.unitPrice == null ||
        previous.fxRate == null ||
        current.fxRate == null
      ) {
        gaps.add(`帳戶 ${accountId.slice(0, 8)} 的價格或匯率不足，部分變動留在未解釋差額`);
        continue;
      }
      const commonQuantity = Math.min(
        Math.max(0, Number(previous.quantity)),
        Math.max(0, Number(current.quantity)),
      );
      marketPriceEffectTwd +=
        commonQuantity *
        (Number(current.unitPrice) - Number(previous.unitPrice)) *
        Number(previous.fxRate);
      fxEffectTwd +=
        commonQuantity *
        Number(current.unitPrice) *
        (Number(current.fxRate) - Number(previous.fxRate));
    }
  }

  const knownLeft =
    opening.totalValueTwd +
    contributionsTwd +
    scopeContributionTwd +
    marketPriceEffectTwd +
    fxEffectTwd +
    incomeTwd;
  const knownRight = ending.totalValueTwd + withdrawalsTwd + scopeWithdrawalTwd;
  const residualTwd = knownRight - knownLeft;
  const scale = Math.max(
    Math.abs(knownLeft) + Math.abs(knownRight),
    Number.EPSILON,
  );
  const toleranceTwd = scale * 0.001;
  const reconciled = Math.abs(residualTwd) <= toleranceTwd;
  if (!reconciled) gaps.add("未解釋差額超過相對容差 0.1%");

  return {
    openingValueTwd: opening.totalValueTwd,
    endingValueTwd: ending.totalValueTwd,
    contributionsTwd,
    withdrawalsTwd,
    scopeContributionTwd,
    scopeWithdrawalTwd,
    incomeTwd,
    marketPriceEffectTwd,
    fxEffectTwd,
    realizedPnlMemoTwd,
    residualTwd,
    toleranceTwd,
    reconciled,
    gaps: [...gaps],
  };
}

export function buildScopeAdjustments({
  fromExclusive,
  toInclusive,
  snapshots,
  statusEvents,
}: {
  fromExclusive: string;
  toInclusive: string;
  snapshots: ReplaySnapshot[];
  statusEvents: AccountStatusEvent[];
}): { contributionTwd: number; withdrawalTwd: number; gaps: string[] } {
  let contributionTwd = 0;
  let withdrawalTwd = 0;
  const gaps: string[] = [];
  const events = statusEvents.filter((event) => {
    const date = taipeiDate(event.effectiveAt);
    return (
      event.source === "account_update" &&
      date > fromExclusive &&
      date <= toInclusive
    );
  });

  for (const event of events) {
    const eventDate = taipeiDate(event.effectiveAt);
    const snapshot = snapshots
      .filter(
        (candidate) =>
          candidate.accountId === event.accountId && candidate.date <= eventDate,
      )
      .sort((left, right) => right.date.localeCompare(left.date))[0];
    if (!snapshot) {
      gaps.push(`帳戶 ${event.accountId.slice(0, 8)} 在範圍變更時缺少估值快照`);
      continue;
    }
    if (event.status === "archived") withdrawalTwd += Number(snapshot.valueBase);
    else contributionTwd += Number(snapshot.valueBase);
  }

  if (contributionTwd !== 0 || withdrawalTwd !== 0) {
    gaps.push("帳戶啟用／封存以非現金的組合範圍調整列示，未計入實際投入或提領");
  }
  return { contributionTwd, withdrawalTwd, gaps };
}

function statusAsOf(
  accountId: string,
  targetDate: string,
  selected: ReplaySnapshot,
  events: AccountStatusEvent[],
): { value: "active" | "archived"; known: boolean } {
  const event = events
    .filter((candidate) => candidate.accountId === accountId && taipeiDate(candidate.effectiveAt) <= targetDate)
    .sort((left, right) => right.effectiveAt.localeCompare(left.effectiveAt))[0];
  if (event) return { value: event.status, known: true };
  if (selected.accountStatus) return { value: selected.accountStatus, known: true };
  return { value: "active", known: false };
}

function periodPoints(
  accountId: string,
  opening: PortfolioReplay,
  ending: PortfolioReplay,
  snapshots: ReplaySnapshot[],
): ReplaySnapshot[] {
  const points = snapshots.filter(
    (snapshot) =>
      snapshot.accountId === accountId &&
      snapshot.date >= opening.targetDate &&
      snapshot.date <= ending.targetDate,
  );
  const openingHolding = opening.holdings.find((holding) => holding.accountId === accountId);
  const endingHolding = ending.holdings.find((holding) => holding.accountId === accountId);
  if (openingHolding) points.push(holdingAsSnapshot(openingHolding));
  if (endingHolding) points.push(holdingAsSnapshot(endingHolding));

  const unique = new Map<string, ReplaySnapshot>();
  for (const point of points) unique.set(`${point.accountId}:${point.date}`, point);
  return [...unique.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function holdingAsSnapshot(holding: ReplayHolding): ReplaySnapshot {
  return {
    accountId: holding.accountId,
    date: holding.snapshotDate,
    quantity: holding.quantity,
    unitPrice: holding.unitPrice,
    fxRate: holding.fxRate,
    valueBase: holding.valueTwd,
    costBasisTwd: holding.costBasisTwd,
    costBasisNative: null,
    realizedPnlTwd: holding.realizedPnlTwd,
    accountStatus: holding.statusKnown ? "active" : null,
  };
}

function taipeiDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function numberOrNull(value: number | null | undefined): number | null {
  return value == null || !Number.isFinite(Number(value)) ? null : Number(value);
}
