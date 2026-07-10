import type { PerfPoint } from "./DashboardCharts";

export const RANGES: { key: string; days: number | null }[] = [
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 182 },
  { key: "YTD", days: null },
  { key: "1Y", days: 365 },
  { key: "ALL", days: 9999 },
];

function calendarCutoff(today: string, days: number): string {
  const [year, month, day] = today.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

export function sliceByRange<T extends { date: string }>(
  full: T[],
  range: string,
  today: string,
): T[] {
  if (full.length === 0 || range === "ALL") return full;
  if (range === "YTD") {
    return full.filter((point) => point.date >= `${today.slice(0, 4)}-01-01`);
  }

  const days = RANGES.find((item) => item.key === range)?.days ?? null;
  if (days === null) return full;
  const cutoff = calendarCutoff(today, days);
  return full.filter((point) => point.date >= cutoff);
}

export function sliceToCommonStart(
  data: PerfPoint[],
  keys: string[],
): PerfPoint[] {
  const first = data.findIndex((point) =>
    keys.every((key) => typeof point[key] === "number"),
  );
  return first >= 0 ? data.slice(first) : [];
}
