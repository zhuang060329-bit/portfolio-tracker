import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ImportCsv } from "./ImportCsv";
import { getUnreadCount } from "@/lib/notifications";

const TXN_LABEL: Record<string, string> = {
  create: "新建帳戶",
  adjust_quantity: "調整數量",
  adjust_balance: "修改餘額",
  price_update: "更新價格",
  sell: "賣出",
  dividend: "配息",
  interest: "利息",
};

const TXN_TONE: Record<string, string> = {
  create: "bg-[var(--c-accent)]/10 text-[var(--c-accent)]",
  adjust_quantity: "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300",
  adjust_balance: "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300",
  price_update: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
  sell: "bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300",
  dividend: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300",
  interest: "bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300",
};

const fmtTwd = (n: number) =>
  n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });

const fmtNum = (n: number | null, max = 8) =>
  n === null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("en-US", { maximumFractionDigits: max });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

type Row = {
  id: string;
  type: string;
  quantity_after: number | null;
  unit_price: number | null;
  fx_rate: number | null;
  value_after_base: number | null;
  note: string | null;
  created_at: string;
  account_id: string;
  accounts: {
    id: string;
    name: string;
    price_market: string;
    symbol: string | null;
  } | null;
};

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = await getUnreadCount();

  const { data } = await supabase
    .from("transactions")
    .select(
      "id,type,quantity_after,unit_price,fx_rate,value_after_base,note,created_at,account_id,accounts(id,name,price_market,symbol)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="activity" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              變動紀錄
            </h1>
            <p className="mt-2 text-sm text-[var(--c-muted)]">
              所有帳戶的最近紀錄，依時間倒序，最多 200 筆。
            </p>
          </div>
          <a
            href="/api/export/csv"
            download
            className="shrink-0 rounded-sm border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2 text-sm font-medium text-[var(--c-text)] shadow-sm hover:bg-[var(--c-surface-soft)]"
          >
            下載 CSV
          </a>
        </header>

        {/* 統計摘要 — 避免表格上方一片空白 */}
        {rows.length > 0 && (() => {
          const byType = new Map<string, number>();
          for (const r of rows) byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
          const summary = [...byType.entries()].sort((a, b) => b[1] - a[1]);
          return (
            <section className="mt-6 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm">
              <div>
                <div className="text-[10px] tracking-wider text-[var(--c-faint)]">
                  總筆數
                </div>
                <div className="font-serif text-2xl font-semibold tabular-nums">
                  {rows.length}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {summary.map(([type, count]) => (
                  <span key={type} className="text-[var(--c-muted)]">
                    <span
                      className={`mr-1 inline-flex rounded-sm px-1.5 py-0.5 text-[10px] ${TXN_TONE[type] ?? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}
                    >
                      {TXN_LABEL[type] ?? type}
                    </span>
                    <span className="tabular-nums">{count}</span>
                  </span>
                ))}
              </div>
            </section>
          );
        })()}

        <div className="mt-6">
          <ImportCsv />
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center">
            <p className="text-sm text-[var(--c-muted)]">
              還沒有任何變動。建立帳戶或執行操作後，這裡會出現記錄。
            </p>
          </div>
        ) : (
          <>
            {/* 桌機表格 */}
            <div className="mt-6 hidden overflow-hidden rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] shadow-sm md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--c-border)] bg-[var(--c-surface-soft)] text-xs tracking-wider text-[var(--c-muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">時間</th>
                    <th className="px-4 py-3 text-left font-semibold">帳戶</th>
                    <th className="px-4 py-3 text-left font-semibold">類型</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      持有後
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">單價</th>
                    <th className="px-4 py-3 text-right font-semibold">匯率</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      市值（TWD）
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">備註</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--c-border-soft)]">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--c-surface-soft)]">
                      <td className="whitespace-nowrap px-4 py-2.5 text-[var(--c-muted)]">
                        {fmtTime(r.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.accounts ? (
                          <Link
                            href={`/accounts/${r.accounts.id}`}
                            className="font-medium text-[var(--c-text)] hover:text-[var(--c-accent)] hover:underline"
                          >
                            {r.accounts.name}
                          </Link>
                        ) : (
                          <span className="text-[var(--c-faint)]">已刪除帳戶</span>
                        )}
                        {r.accounts?.symbol && (
                          <span className="ml-2 text-xs text-[var(--c-muted)]">
                            {r.accounts.symbol}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-sm px-2 py-0.5 text-xs ${TXN_TONE[r.type] ?? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}
                        >
                          {TXN_LABEL[r.type] ?? r.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fmtNum(r.quantity_after, 8)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fmtNum(r.unit_price, 4)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--c-muted)]">
                        {fmtNum(r.fx_rate, 4)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                        {fmtTwd(Number(r.value_after_base ?? 0))}
                      </td>
                      <td className="max-w-[16rem] truncate px-4 py-2.5 text-xs text-[var(--c-muted)]">
                        {r.note ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 手機卡片 */}
            <div className="mt-6 flex flex-col gap-3 md:hidden">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {r.accounts ? (
                        <Link
                          href={`/accounts/${r.accounts.id}`}
                          className="truncate font-medium text-[var(--c-text)] hover:text-[var(--c-accent)]"
                        >
                          {r.accounts.name}
                        </Link>
                      ) : (
                        <span className="text-[var(--c-faint)]">已刪除帳戶</span>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-sm px-2 py-0.5 text-[10px] ${TXN_TONE[r.type] ?? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}
                        >
                          {TXN_LABEL[r.type] ?? r.type}
                        </span>
                        <span className="text-[10px] text-[var(--c-muted)]">
                          {fmtTime(r.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                        {fmtTwd(Number(r.value_after_base ?? 0))}
                      </div>
                      <div className="text-[10px] text-[var(--c-muted)]">TWD</div>
                    </div>
                  </div>
                  {r.note && (
                    <div className="mt-2 text-xs text-[var(--c-muted)]">{r.note}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
