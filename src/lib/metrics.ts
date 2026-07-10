export type Snapshot = { date: string; value: number };
export type Cashflow = { date: string; amount: number };

function calendarDaysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return (end - start) / 86_400_000;
}

export function computeTwr(
  snapshots: Snapshot[],
  cashflows: Cashflow[],
): { total: number; annualized: number } | null {
  if (snapshots.length < 2) return null;

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const cfSorted = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));
  let cfPtr = 0;
  while (cfPtr < cfSorted.length && cfSorted[cfPtr].date <= sorted[0].date) {
    cfPtr++;
  }

  let product = 1;
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1].value;
    const current = sorted[i].value;
    const currentDate = sorted[i].date;

    // 每個子期間使用 (前一快照日, 當前快照日] 內的全部現金流。
    let cashflowSum = 0;
    while (cfPtr < cfSorted.length && cfSorted[cfPtr].date <= currentDate) {
      cashflowSum += cfSorted[cfPtr].amount;
      cfPtr++;
    }

    const currentExCashflow = current - cashflowSum;
    if (!Number.isFinite(previous) || previous <= 0) return null;
    const growth = currentExCashflow / previous;
    if (!Number.isFinite(growth) || growth <= 0) return null;
    product *= growth;
  }

  const total = product - 1;
  const days = calendarDaysBetween(sorted[0].date, sorted[sorted.length - 1].date);
  if (days <= 0) return { total, annualized: total };
  const annualized = Math.pow(1 + total, 365.25 / days) - 1;
  return { total, annualized };
}

export function computeMaxDrawdown(snapshots: Snapshot[]): {
  pct: number;
  peakDate: string;
  troughDate: string;
} | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  let peak = sorted[0].value;
  let peakDate = sorted[0].date;
  let maxDrawdown = 0;
  let maxPeakDate = sorted[0].date;
  let maxTroughDate = sorted[0].date;

  for (const snapshot of sorted) {
    if (snapshot.value > peak) {
      peak = snapshot.value;
      peakDate = snapshot.date;
    }
    if (peak <= 0) continue;
    const drawdown = (snapshot.value - peak) / peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxPeakDate = peakDate;
      maxTroughDate = snapshot.date;
    }
  }

  if (maxDrawdown === 0) return null;
  return {
    pct: maxDrawdown,
    peakDate: maxPeakDate,
    troughDate: maxTroughDate,
  };
}

function periodReturns(
  snapshots: Snapshot[],
  cashflows: Cashflow[],
): { value: number; days: number }[] {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return [];

  const cfSorted = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));
  let cfPtr = 0;
  while (cfPtr < cfSorted.length && cfSorted[cfPtr].date <= sorted[0].date) {
    cfPtr++;
  }

  const returns: { value: number; days: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    let cashflowSum = 0;
    while (cfPtr < cfSorted.length && cfSorted[cfPtr].date <= current.date) {
      cashflowSum += cfSorted[cfPtr].amount;
      cfPtr++;
    }

    const days = calendarDaysBetween(previous.date, current.date);
    if (!Number.isFinite(previous.value) || previous.value <= 0 || days <= 0) {
      continue;
    }
    const value = (current.value - cashflowSum) / previous.value - 1;
    if (Number.isFinite(value) && value > -1) returns.push({ value, days });
  }
  return returns;
}

// 快照若有斷日，先把整段報酬換算成等效單日報酬，避免把多日變動當成一天。
export function dailyReturns(
  snapshots: Snapshot[],
  cashflows: Cashflow[],
): number[] {
  return periodReturns(snapshots, cashflows).map(({ value, days }) =>
    Math.expm1(Math.log1p(value) / days),
  );
}

export function buildTwrSeries(
  snapshots: Snapshot[],
  cashflows: Cashflow[],
): { date: string; index: number }[] {
  if (snapshots.length < 1) return [];
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const cfSorted = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));

  const result: { date: string; index: number }[] = [
    { date: sorted[0].date, index: 100 },
  ];
  let product = 1;
  let cfPtr = 0;
  while (cfPtr < cfSorted.length && cfSorted[cfPtr].date <= sorted[0].date) {
    cfPtr++;
  }

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1].value;
    const current = sorted[i].value;
    const currentDate = sorted[i].date;

    // 每個子期間使用 (前一快照日, 當前快照日] 內的全部現金流。
    let cashflowSum = 0;
    while (cfPtr < cfSorted.length && cfSorted[cfPtr].date <= currentDate) {
      cashflowSum += cfSorted[cfPtr].amount;
      cfPtr++;
    }

    const currentExCashflow = current - cashflowSum;
    if (Number.isFinite(previous) && previous > 0) {
      const growth = currentExCashflow / previous;
      if (Number.isFinite(growth) && growth > 0) product *= growth;
    }
    result.push({ date: currentDate, index: product * 100 });
  }
  return result;
}

export function forwardFillBenchmarks(
  series: { [key: string]: number | string | undefined }[],
  keys: string[],
): void {
  const carry = new Map<string, number>();
  for (const point of series) {
    for (const key of keys) {
      const value = point[key];
      if (typeof value === "number") {
        carry.set(key, value);
      } else if (carry.has(key)) {
        point[key] = carry.get(key);
      }
    }
  }
}

export function computeSharpe(
  snapshots: Snapshot[],
  cashflows: Cashflow[],
  rfAnnual: number,
): number | null {
  const returns = dailyReturns(snapshots, cashflows);
  if (returns.length < 5) return null;

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (returns.length - 1);
  const stdDaily = Math.sqrt(variance);
  if (!Number.isFinite(stdDaily) || stdDaily <= 0) return null;

  // 組合含週末仍有報價的資產，年化尺度使用日曆日。
  const rfDaily = Math.pow(1 + rfAnnual, 1 / 365.25) - 1;
  const sharpe = ((mean - rfDaily) / stdDaily) * Math.sqrt(365.25);
  return Number.isFinite(sharpe) ? sharpe : null;
}
