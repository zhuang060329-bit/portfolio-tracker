// 儀表板對外資料型別：由 buildDashboardData（server 端）產出、DashboardClient 消費。

import type {
  AllocDatum,
  BenchSeries,
  PerfPoint,
  SeriesPoint,
} from "./DashboardCharts";

export type DashSummary = {
  total: number;
  totalCost: number;
  unrealized: number;
  unrealizedPct: number;
  totalRealized: number;
  xirr: number | null;
  xirrShowable: boolean;
  dayChange: number | null; // 由快照差算；不足兩筆快照為 null
  dayChangePct: number | null;
  accounts: number;
  lastUpdate: string | null;
  twrCum: number | null;
  twrAnn: number | null;
  maxDrawdown: number | null;
  ddPeak: string | null;
  ddTrough: string | null;
  sharpe: number | null;
  twrShowable: boolean;
  hasIncome: boolean;
  incomeYtd: number;
  income12m: number;
  monthlyAvg: number;
  yieldOnCost: number;
  dividendAll: number;
  interestAll: number;
};

export type AllocTarget = {
  cls: string;
  label: string;
  actual: number;
  target: number;
};

export type Holding = {
  id: string;
  name: string;
  symbol: string | null;
  market: string;
  cls: string;
  value: number;
  cost: number;
  realized: number;
  day: number | null; // 今日漲跌（小數），null = 無前一日快照
  status: string;
};

export type DashboardData = {
  summary: DashSummary;
  series: SeriesPoint[];
  perf: PerfPoint[];
  benchmarks: BenchSeries[];
  hasPerf: boolean;
  benchNotice?: string | null;
  allocation: AllocDatum[];
  allocTargets: AllocTarget[];
  holdings: Holding[];
  marketLabel: Record<string, string>;
  today: string;
  archivedCount: number;
  showArchived: boolean;
};
