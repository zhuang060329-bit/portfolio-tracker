import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";
import { fetchUsDailyClose } from "@/lib/prices/twelvedata";
import { fetchUsdTwdHistory } from "@/lib/prices/fx";
import { fetchTwDailyClose } from "@/lib/prices/finmind";
import { simulateBuyAndHold, type DailyClose } from "@/lib/whatif";

const fmtTwd = (n: number) =>
  n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });

export default async function WhatIfPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = await getUnreadCount();

  // 抓使用者所有 cashflow_twd
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

  // 抓使用者目前實際組合估值（重用首頁邏輯）
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

  // 抓三個 ETF 歷史 close + USD/TWD（給 SPY/QQQ 換算）
  const [tw0050, spyUsd, qqqUsd, fxHistory] = hasData
    ? await Promise.all([
        fetchTwDailyClose("0050", firstDate),
        fetchUsDailyClose("SPY", firstDate),
        fetchUsDailyClose("QQQ", firstDate),
        fetchUsdTwdHistory(firstDate),
      ])
    : [[], [], [], []];

  // forward-fill 匯率
  const fxSorted = [...fxHistory].sort((a, b) => a.date.localeCompare(b.date));
  function fxAt(date: string): number | null {
    let last: number | null = null;
    for (const r of fxSorted) {
      if (r.date <= date) last = r.rate;
      else break;
    }
    return last;
  }

  // 把 SPY/QQQ 換成 TWD 報價序列
  const spyTwd: DailyClose[] = spyUsd
    .map((r) => {
      const fx = fxAt(r.date);
      if (fx === null) return null;
      return { date: r.date, close: Number(r.close) * fx };
    })
    .filter((x): x is DailyClose => x !== null);
  const qqqTwd: DailyClose[] = qqqUsd
    .map((r) => {
      const fx = fxAt(r.date);
      if (fx === null) return null;
      return { date: r.date, close: Number(r.close) * fx };
    })
    .filter((x): x is DailyClose => x !== null);
  const tw0050Prices: DailyClose[] = tw0050.map((r) => ({
    date: r.date,
    close: Number(r.close),
  }));

  const sims = hasData
    ? [
        {
          label: "S&P 500（SPY）",
          accent: "#3B82F6",
          result: simulateBuyAndHold(cashflows, spyTwd),
        },
        {
          label: "Nasdaq 100（QQQ）",
          accent: "#A855F7",
          result: simulateBuyAndHold(cashflows, qqqTwd),
        },
        {
          label: "0050（台股）",
          accent: "#10B981",
          result: simulateBuyAndHold(cashflows, tw0050Prices),
        },
      ]
    : [];

  const actualReturnPct =
    totalInvested > 0 ? (actualValue - totalInvested) / totalInvested : 0;

  // 排名（包含實際組合）
  const all = sims.map((s) => ({
    label: s.label,
    accent: s.accent,
    finalValue: s.result.finalValue,
    returnPct: s.result.returnPct,
    skipped: s.result.skippedCashflows,
  }));
  all.push({
    label: "我的實際組合",
    accent: "var(--c-accent)",
    finalValue: actualValue,
    returnPct: actualReturnPct,
    skipped: 0,
  });
  all.sort((a, b) => b.returnPct - a.returnPct);

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active={null} userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 text-sm">
          <Link href="/" className="text-[var(--c-muted)] hover:text-[var(--c-text)]">
            ← 回總覽
          </Link>
        </div>
        <header>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            What-if 模擬
          </h1>
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            把你實際的投入時點與金額拿來，假設全部買 S&amp;P 500 / Nasdaq 100 / 0050
            並 Buy and Hold，今天會值多少？
          </p>
        </header>

        {!hasData ? (
          <div className="mt-6 rounded-md border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center">
            <p className="text-sm text-[var(--c-muted)]">
              還沒有任何投入紀錄，先到帳戶頁建立帳戶並加碼後再回來。
            </p>
          </div>
        ) : (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm">
                <div className="text-[10px] tracking-wider text-[var(--c-faint)]">
                  累積投入
                </div>
                <div className="mt-1 font-serif text-2xl font-semibold tabular-nums">
                  NT$ {fmtTwd(totalInvested)}
                </div>
                <div className="mt-1 text-[10px] text-[var(--c-faint)]">
                  從 {firstDate} 起 · 共 {cashflows.filter((c) => c.amount < 0).length} 筆投入
                </div>
              </div>
              <div className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm">
                <div className="text-[10px] tracking-wider text-[var(--c-faint)]">
                  目前實際組合
                </div>
                <div
                  className={`mt-1 font-serif text-2xl font-semibold tabular-nums ${
                    actualReturnPct > 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : actualReturnPct < 0
                        ? "text-rose-700 dark:text-rose-400"
                        : ""
                  }`}
                >
                  NT$ {fmtTwd(actualValue)}
                </div>
                <div className="mt-1 text-[10px] text-[var(--c-faint)]">
                  報酬 {actualReturnPct >= 0 ? "+" : "−"}
                  {Math.abs(actualReturnPct * 100).toFixed(2)}%
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-serif text-xl font-semibold tracking-tight">
                如果全部買 ETF 並 Buy and Hold
              </h2>
              <p className="mt-1 text-xs text-[var(--c-muted)]">
                假設：每次投入用該日 ETF 收盤價買入；之後不主動賣出、不考慮交易成本。
              </p>
              <div className="mt-4 grid gap-3">
                {all.map((row) => {
                  const diff = row.finalValue - actualValue;
                  const isActual = row.label === "我的實際組合";
                  return (
                    <div
                      key={row.label}
                      className={`rounded-md border bg-[var(--c-surface)] p-4 shadow-sm ${
                        isActual
                          ? "border-[var(--c-accent)] border-2"
                          : "border-[var(--c-border)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-sm"
                            style={{ backgroundColor: row.accent }}
                          />
                          <span className="font-medium">{row.label}</span>
                          {isActual && (
                            <span className="rounded-sm bg-[var(--c-accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--c-accent)]">
                              實際
                            </span>
                          )}
                        </div>
                        <div className="font-serif text-xl font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                          NT$ {fmtTwd(row.finalValue)}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3 text-xs">
                        <span
                          className={
                            row.returnPct > 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : row.returnPct < 0
                                ? "text-rose-700 dark:text-rose-400"
                                : "text-[var(--c-muted)]"
                          }
                        >
                          報酬 {row.returnPct >= 0 ? "+" : "−"}
                          {Math.abs(row.returnPct * 100).toFixed(2)}%
                        </span>
                        {!isActual && (
                          <span
                            className={
                              diff > 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : diff < 0
                                  ? "text-rose-700 dark:text-rose-400"
                                  : "text-[var(--c-muted)]"
                            }
                          >
                            vs 實際 {diff >= 0 ? "+" : "−"} NT$ {fmtTwd(Math.abs(diff))}
                          </span>
                        )}
                        {row.skipped > 0 && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-300">
                            {row.skipped} 筆投入找不到價格被跳過
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 text-[10px] text-[var(--c-faint)]">
                假設說明：(1) 投入 = transactions.cashflow_twd 為負的紀錄；
                (2) 配息 / 賣出當作沒發生，等同 buy-and-hold；
                (3) SPY / QQQ 用該日收盤 × 當日 USD/TWD；
                (4) 沒考慮交易成本、滑價、ETF 配息與再投資；
                (5) 過去績效不代表未來。
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
