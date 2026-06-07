import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";
import { fetchUsDailyClose } from "@/lib/prices/twelvedata";
import { fetchUsdTwdHistory } from "@/lib/prices/fx";
import { fetchTwDailyClose } from "@/lib/prices/finmind";
import { simulateBuyAndHold, type DailyClose } from "@/lib/whatif";
import {
  WhatIfClient,
  type CfRow,
  type CounterfactualData,
} from "./WhatIfClient";

export default async function WhatIfPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = await getUnreadCount();

  // 所有 cashflow_twd（給回測）
  const { data: cfRows } = await supabase
    .from("transactions")
    .select("created_at,cashflow_twd")
    .not("cashflow_twd", "is", null)
    .order("created_at", { ascending: true });

  const cashflows = ((cfRows ?? []) as {
    created_at: string;
    cashflow_twd: number;
  }[])
    .map((r) => ({
      date: r.created_at.slice(0, 10),
      amount: Number(r.cashflow_twd),
    }))
    .filter((c) => Number.isFinite(c.amount) && c.amount !== 0);

  const totalInvested = cashflows
    .filter((c) => c.amount < 0)
    .reduce((s, c) => s + Math.abs(c.amount), 0);

  // 目前實際組合估值（= 未來推算的起點本金）
  const { data: accs } = await supabase
    .from("accounts")
    .select(
      "price_market,quantity,last_unit_price,last_fx_rate,manual_value_base",
    )
    .eq("status", "active");
  let actualValue = 0;
  for (const a of accs ?? []) {
    if (a.price_market === "manual") {
      actualValue += Number(a.manual_value_base ?? 0);
    } else {
      actualValue +=
        Number(a.quantity) *
        Number(a.last_unit_price ?? 0) *
        Number(a.last_fx_rate ?? 1);
    }
  }

  const firstDate = cashflows[0]?.date ?? "";
  const hasData = cashflows.length > 0 && totalInvested > 0 && !!firstDate;

  // 三個 ETF 歷史 close + USD/TWD（換算 SPY/QQQ）
  const [tw0050, spyUsd, qqqUsd, fxHistory] = hasData
    ? await Promise.all([
        fetchTwDailyClose("0050", firstDate),
        fetchUsDailyClose("SPY", firstDate),
        fetchUsDailyClose("QQQ", firstDate),
        fetchUsdTwdHistory(firstDate),
      ])
    : [[], [], [], []];

  const fxSorted = [...fxHistory].sort((a, b) => a.date.localeCompare(b.date));
  function fxAt(date: string): number | null {
    let last: number | null = null;
    for (const r of fxSorted) {
      if (r.date <= date) last = r.rate;
      else break;
    }
    return last;
  }

  const spyTwd: DailyClose[] = spyUsd
    .map((r) => {
      const fx = fxAt(r.date);
      return fx === null ? null : { date: r.date, close: Number(r.close) * fx };
    })
    .filter((x): x is DailyClose => x !== null);
  const qqqTwd: DailyClose[] = qqqUsd
    .map((r) => {
      const fx = fxAt(r.date);
      return fx === null ? null : { date: r.date, close: Number(r.close) * fx };
    })
    .filter((x): x is DailyClose => x !== null);
  const tw0050Prices: DailyClose[] = tw0050.map((r) => ({
    date: r.date,
    close: Number(r.close),
  }));

  let counterfactual: CounterfactualData | null = null;
  if (hasData) {
    const actualReturnPct =
      totalInvested > 0 ? (actualValue - totalInvested) / totalInvested : 0;
    const sims: CfRow[] = [
      {
        label: "S&P 500",
        sym: "SPY",
        color: "#7FA8C9",
        ...resultOf(simulateBuyAndHold(cashflows, spyTwd)),
        actual: false,
      },
      {
        label: "Nasdaq 100",
        sym: "QQQ",
        color: "#C58BD6",
        ...resultOf(simulateBuyAndHold(cashflows, qqqTwd)),
        actual: false,
      },
      {
        label: "台股 0050",
        sym: "0050",
        color: "#7FBFA3",
        ...resultOf(simulateBuyAndHold(cashflows, tw0050Prices)),
        actual: false,
      },
    ];
    const rows: CfRow[] = [
      ...sims,
      {
        label: "我的實際組合",
        sym: null,
        color: "var(--c-accent)",
        finalValue: actualValue,
        returnPct: actualReturnPct,
        actual: true,
        skipped: 0,
      },
    ].sort((a, b) => b.returnPct - a.returnPct);

    counterfactual = {
      invested: totalInvested,
      firstDate,
      contributions: cashflows.filter((c) => c.amount < 0).length,
      rows,
    };
  }

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="whatif" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-[980px] px-7 py-9 pb-28">
        <div className="mb-4 text-sm">
          <Link href="/" className="text-[var(--c-muted)] hover:text-[var(--c-text)]">
            ← 回總覽
          </Link>
        </div>
        <header className="mb-5">
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            What-if 試算
          </h1>
          <p className="mt-1.5 text-[13.5px] text-[var(--c-muted)]">
            推算未來淨值與 FIRE 進度，或回看「當初如果全買 ETF」的對照。
          </p>
        </header>

        <WhatIfClient netWorth={actualValue} counterfactual={counterfactual} />
      </main>
    </div>
  );
}

// 把 simulateBuyAndHold 結果整成 CfRow 需要的欄位
function resultOf(r: {
  finalValue: number;
  returnPct: number;
  skippedCashflows: number;
}): Pick<CfRow, "finalValue" | "returnPct" | "skipped"> {
  return {
    finalValue: r.finalValue,
    returnPct: r.returnPct,
    skipped: r.skippedCashflows,
  };
}
