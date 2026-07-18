import {
  attributePortfolioPeriod,
  buildScopeAdjustments,
  replayPortfolioAsOf,
  type AccountStatusEvent,
  type AttributionResult,
  type PortfolioReplay,
  type ReplayAccount,
  type ReplaySnapshot,
  type ReplayTransaction,
} from "./history-replay";
import {
  buildTwrSeries,
  computeMaxDrawdown,
  computeTwr,
} from "./metrics";
import { computeXirr } from "./xirr";

export type MonthBounds = {
  month: string;
  startDate: string;
  endDate: string;
  openingDate: string;
};

export type MonthlySource = {
  accountId: string;
  name: string;
  impactTwd: number;
};

export type MonthlyReportResult = {
  bounds: MonthBounds;
  opening: PortfolioReplay;
  ending: PortfolioReplay;
  attribution: AttributionResult;
  netContributionTwd: number;
  twr: number | null;
  xirrAnnualized: number | null;
  maxDrawdown: { pct: number; peakDate: string; troughDate: string } | null;
  openingAllocation: Record<string, number>;
  endingAllocation: Record<string, number>;
  topConcentrationPct: number;
  largestPositiveSource: MonthlySource | null;
  largestNegativeSource: MonthlySource | null;
  dataGaps: string[];
};

export function getMonthBounds(month: string): MonthBounds | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  if (year < 1970 || year > 9999 || monthNumber < 1 || monthNumber > 12) return null;
  const startDate = `${year.toString().padStart(4, "0")}-${String(monthNumber).padStart(2, "0")}-01`;
  const endDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const endDate = `${startDate.slice(0, 8)}${String(endDay).padStart(2, "0")}`;
  return {
    month,
    startDate,
    endDate,
    openingDate: shiftDate(startDate, -1),
  };
}

export function buildMonthlyReport({
  bounds,
  accounts,
  snapshots,
  statusEvents,
  transactions,
  sourceTruncated = false,
}: {
  bounds: MonthBounds;
  accounts: ReplayAccount[];
  snapshots: ReplaySnapshot[];
  statusEvents: AccountStatusEvent[];
  transactions: ReplayTransaction[];
  sourceTruncated?: boolean;
}): MonthlyReportResult {
  const opening = replayPortfolioAsOf({
    targetDate: bounds.openingDate,
    accounts,
    snapshots,
    statusEvents,
    sourceTruncated,
  });
  const ending = replayPortfolioAsOf({
    targetDate: bounds.endDate,
    accounts,
    snapshots,
    statusEvents,
    sourceTruncated,
  });
  const scope = buildScopeAdjustments({
    fromExclusive: bounds.openingDate,
    toInclusive: bounds.endDate,
    snapshots,
    statusEvents,
  });
  const attribution = attributePortfolioPeriod({
    opening,
    ending,
    snapshots,
    transactions,
    scopeContributionTwd: scope.contributionTwd,
    scopeWithdrawalTwd: scope.withdrawalTwd,
    scopeGaps: scope.gaps,
  });

  const periodTransactions = transactions.filter((transaction) => {
    const date = taipeiDate(transaction.createdAt);
    return date > bounds.openingDate && date <= bounds.endDate;
  });
  const reportDates = new Set<string>([bounds.openingDate, bounds.endDate]);
  for (const snapshot of snapshots) {
    if (snapshot.date > bounds.openingDate && snapshot.date <= bounds.endDate) {
      reportDates.add(snapshot.date);
    }
  }
  const metricSnapshots = [...reportDates]
    .sort()
    .map((date) => ({
      date,
      value: replayPortfolioAsOf({
        targetDate: date,
        accounts,
        snapshots,
        statusEvents,
      }).totalValueTwd,
    }));
  const metricCashflows = periodTransactions
    .filter((transaction) => transaction.cashflowTwd != null && transaction.cashflowTwd !== 0)
    .map((transaction) => ({
      date: taipeiDate(transaction.createdAt),
      amount: -Number(transaction.cashflowTwd),
    }));
  const hasScopeChange = scope.contributionTwd !== 0 || scope.withdrawalTwd !== 0;
  const twrResult = hasScopeChange ? null : computeTwr(metricSnapshots, metricCashflows);
  const twrSeries = hasScopeChange
    ? []
    : buildTwrSeries(metricSnapshots, metricCashflows).map((point) => ({
        date: point.date,
        value: point.index,
      }));
  const maxDrawdown = computeMaxDrawdown(twrSeries);

  const xirrFlows = [
    {
      amount: -opening.totalValueTwd,
      when: new Date(`${bounds.openingDate}T23:59:59+08:00`),
    },
    ...periodTransactions
      .filter((transaction) => transaction.cashflowTwd != null && transaction.cashflowTwd !== 0)
      .map((transaction) => ({
        amount: Number(transaction.cashflowTwd),
        when: new Date(transaction.createdAt),
      })),
    {
      amount: ending.totalValueTwd,
      when: new Date(`${bounds.endDate}T23:59:59+08:00`),
    },
  ];
  const xirrAnnualized = hasScopeChange ? null : computeXirr(xirrFlows);

  const continuousIds = opening.holdings
    .map((holding) => holding.accountId)
    .filter((id) => ending.holdings.some((holding) => holding.accountId === id));
  const sources = continuousIds.map<MonthlySource>((accountId) => {
    const account = accounts.find((candidate) => candidate.id === accountId)!;
    const accountOpening = replayPortfolioAsOf({
      targetDate: bounds.openingDate,
      accounts: [account],
      snapshots: snapshots.filter((snapshot) => snapshot.accountId === accountId),
      statusEvents: statusEvents.filter((event) => event.accountId === accountId),
    });
    const accountEnding = replayPortfolioAsOf({
      targetDate: bounds.endDate,
      accounts: [account],
      snapshots: snapshots.filter((snapshot) => snapshot.accountId === accountId),
      statusEvents: statusEvents.filter((event) => event.accountId === accountId),
    });
    const accountAttribution = attributePortfolioPeriod({
      opening: accountOpening,
      ending: accountEnding,
      snapshots: snapshots.filter((snapshot) => snapshot.accountId === accountId),
      transactions: periodTransactions.filter((transaction) => transaction.accountId === accountId),
    });
    return {
      accountId,
      name: account.name,
      impactTwd:
        accountAttribution.marketPriceEffectTwd +
        accountAttribution.fxEffectTwd +
        accountAttribution.incomeTwd,
    };
  });
  const sortedSources = sources.sort((left, right) => right.impactTwd - left.impactTwd);
  const dataGaps = [...new Set(attribution.gaps)];
  if (hasScopeChange) {
    dataGaps.push("本月組合範圍有啟用或封存變動，XIRR 與 TWR 暫不顯示以避免把範圍變動當成報酬");
  }

  return {
    bounds,
    opening,
    ending,
    attribution,
    netContributionTwd: attribution.contributionsTwd - attribution.withdrawalsTwd,
    twr: twrResult?.total ?? null,
    xirrAnnualized,
    maxDrawdown,
    openingAllocation: allocationByClass(opening),
    endingAllocation: allocationByClass(ending),
    topConcentrationPct:
      ending.totalValueTwd > 0
        ? Math.max(0, ...ending.holdings.map((holding) => (holding.valueTwd / ending.totalValueTwd) * 100))
        : 0,
    largestPositiveSource: sortedSources.find((source) => source.impactTwd > 0) ?? null,
    largestNegativeSource: [...sortedSources].reverse().find((source) => source.impactTwd < 0) ?? null,
    dataGaps,
  };
}

function allocationByClass(replay: PortfolioReplay): Record<string, number> {
  const result: Record<string, number> = {};
  if (replay.totalValueTwd <= 0) return result;
  for (const holding of replay.holdings) {
    result[holding.assetClass] =
      (result[holding.assetClass] ?? 0) + (holding.valueTwd / replay.totalValueTwd) * 100;
  }
  return result;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function taipeiDate(value: string): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}
