export type DecisionMetricSnapshot = {
  date: string;
  unitPrice: number | null;
  fxRate: number | null;
};

export type DecisionReviewMetrics = {
  assetReturnPct: number | null;
  twdReturnPct: number | null;
  fxEffectPct: number | null;
  maxFavorableExcursionPct: number | null;
  maxAdverseExcursionPct: number | null;
  startSnapshotDate: string | null;
  endSnapshotDate: string | null;
  gaps: string[];
};

export function calculateDecisionReviewMetrics({
  decisionDate,
  reviewDate,
  snapshots,
}: {
  decisionDate: string;
  reviewDate: string;
  snapshots: DecisionMetricSnapshot[];
}): DecisionReviewMetrics {
  const sorted = snapshots
    .filter((snapshot) => snapshot.date <= reviewDate)
    .sort((left, right) => left.date.localeCompare(right.date));
  const start = [...sorted]
    .reverse()
    .find((snapshot) => snapshot.date <= decisionDate) ?? null;
  const end = [...sorted]
    .reverse()
    .find((snapshot) => snapshot.date <= reviewDate) ?? null;
  const gaps: string[] = [];
  if (!start) gaps.push("決策日或之前沒有價格快照");
  if (!end) gaps.push("檢討日或之前沒有價格快照");
  if (!start || !end) return emptyMetrics(start?.date ?? null, end?.date ?? null, gaps);

  const startPrice = validPositive(start.unitPrice);
  const endPrice = validPositive(end.unitPrice);
  const startFx = validPositive(start.fxRate);
  const endFx = validPositive(end.fxRate);
  if (startPrice == null || endPrice == null) gaps.push("價格快照不足，無法計算標的報酬");
  if (startFx == null || endFx == null) gaps.push("匯率快照不足，無法計算 TWD 與匯率效果");

  const assetReturnPct =
    startPrice != null && endPrice != null
      ? ((endPrice / startPrice) - 1) * 100
      : null;
  const fxEffectPct =
    startFx != null && endFx != null ? ((endFx / startFx) - 1) * 100 : null;
  const startTwdPrice =
    startPrice != null && startFx != null ? startPrice * startFx : null;
  const endTwdPrice = endPrice != null && endFx != null ? endPrice * endFx : null;
  const twdReturnPct =
    startTwdPrice != null && endTwdPrice != null
      ? ((endTwdPrice / startTwdPrice) - 1) * 100
      : null;

  const periodTwdPrices = sorted
    .filter((snapshot) => snapshot.date >= start.date && snapshot.date <= end.date)
    .map((snapshot) => {
      const price = validPositive(snapshot.unitPrice);
      const fx = validPositive(snapshot.fxRate);
      return price != null && fx != null ? price * fx : null;
    })
    .filter((value): value is number => value != null);
  const excursions =
    startTwdPrice == null
      ? []
      : periodTwdPrices.map((value) => ((value / startTwdPrice) - 1) * 100);

  return {
    assetReturnPct,
    twdReturnPct,
    fxEffectPct,
    maxFavorableExcursionPct: excursions.length > 0 ? Math.max(...excursions) : null,
    maxAdverseExcursionPct: excursions.length > 0 ? Math.min(...excursions) : null,
    startSnapshotDate: start.date,
    endSnapshotDate: end.date,
    gaps,
  };
}

function emptyMetrics(
  startSnapshotDate: string | null,
  endSnapshotDate: string | null,
  gaps: string[],
): DecisionReviewMetrics {
  return {
    assetReturnPct: null,
    twdReturnPct: null,
    fxEffectPct: null,
    maxFavorableExcursionPct: null,
    maxAdverseExcursionPct: null,
    startSnapshotDate,
    endSnapshotDate,
    gaps,
  };
}

function validPositive(value: number | null): number | null {
  return value != null && Number.isFinite(Number(value)) && Number(value) > 0
    ? Number(value)
    : null;
}
