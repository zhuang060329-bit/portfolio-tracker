import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";
import { todayTaipei } from "@/lib/dates";
import { ActivityClient, type ActRow } from "./ActivityClient";

type Row = {
  id: string;
  type: string;
  quantity_after: number | null;
  unit_price: number | null;
  fx_rate: number | null;
  value_after_base: number | null;
  cashflow_twd: number | null;
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

// 用 Asia/Taipei 把 created_at 拆成日期 + 時:分（分組與顯示都要台北時區）
const taipeiDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
const taipeiTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function ActivityPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    unreadCount,
    { data },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUnreadCount(),
    supabase
      .from("transactions")
      .select(
        "id,type,quantity_after,unit_price,fx_rate,value_after_base,cashflow_twd,note,created_at,account_id,accounts(id,name,price_market,symbol)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const raw = (data ?? []) as unknown as Row[];
  const rows: ActRow[] = raw.map((r) => ({
    id: r.id,
    type: r.type,
    accountId: r.accounts?.id ?? null,
    accountName: r.accounts?.name ?? null,
    symbol: r.accounts?.symbol ?? null,
    market: r.accounts?.price_market ?? null,
    qty: r.quantity_after,
    price: r.unit_price,
    fx: r.fx_rate,
    value: Number(r.value_after_base ?? 0),
    amount: r.cashflow_twd != null ? Number(r.cashflow_twd) : null,
    note: r.note,
    date: taipeiDate(r.created_at),
    time: taipeiTime(r.created_at),
  }));

  const today = todayTaipei();
  const yesterday = new Date(`${today}T00:00:00+08:00`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("en-CA", {
    timeZone: "Asia/Taipei",
  });

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="activity" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-[1200px] px-4 py-9 pb-28 sm:px-6 lg:px-7">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-tight">
              活動紀錄
            </h1>
            <p className="mt-1.5 text-[13.5px] text-[var(--c-muted)]">
              所有帳戶的變動，依時間倒序 · 最近 {rows.length} 筆
            </p>
          </div>
          <a
            href="/api/export/csv"
            download
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-[var(--c-line-strong)] bg-[var(--c-surface)] px-4 py-2.5 text-[13.5px] font-medium text-[var(--c-text)] hover:bg-[var(--c-surface-soft)]"
          >
            ⤓ 下載 CSV
          </a>
        </header>

        <ActivityClient rows={rows} today={today} yesterday={yesterdayStr} />
      </main>
    </div>
  );
}
