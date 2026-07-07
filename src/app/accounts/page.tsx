import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";
import {
  ASSET_CLASS_LABEL,
  MARKET_LABEL,
  valueOf,
  type AccountRow,
} from "@/lib/dashboard-data";
import { fmtFull as fmtTwd } from "@/lib/format";

// 帳戶索引：管理視角（含封存），與總覽持倉表的投資視角互補。
// 未登入會被 proxy 導向 /login。
export default async function AccountsPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    unreadCount,
    { data: accounts },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUnreadCount(),
    supabase
      .from("accounts")
      .select(
        "id,name,asset_class,price_market,symbol,quantity,native_currency,last_unit_price,last_fx_rate,manual_value_base,last_priced_at,cost_basis_twd,realized_pnl_twd,status",
      )
      .order("created_at", { ascending: true }),
  ]);

  const rows = (accounts ?? []) as AccountRow[];
  const active = rows.filter((a) => a.status !== "archived");
  const archived = rows.filter((a) => a.status === "archived");

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="accounts" userEmail={user?.email} unreadCount={unreadCount} />

      <main className="mx-auto max-w-[880px] px-7 py-9 pb-24">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-[26px] font-medium tracking-tight">帳戶</h1>
            <p className="mt-0.5 text-[12.5px] text-[var(--c-muted)]">
              {active.length} 個使用中
              {archived.length > 0 && ` · ${archived.length} 個已封存`}
            </p>
          </div>
          <Link
            href="/accounts/new"
            className="shrink-0 rounded-[var(--r-control)] bg-[var(--c-accent)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--c-btn-strong-text)] transition hover:brightness-110"
          >
            ＋ 新增帳戶
          </Link>
        </div>

        {rows.length === 0 ? (
          <section className="rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center">
            <p className="text-[15px]">還沒有任何帳戶。</p>
            <p className="mt-1 text-[12.5px] text-[var(--c-muted)]">
              先建立第一個資產帳戶，總覽的淨值、趨勢與配置就會開始累積。
            </p>
            <Link
              href="/accounts/new"
              className="mt-5 inline-block rounded-[var(--r-control)] bg-[var(--c-accent)] px-5 py-2.5 text-[13.5px] font-semibold text-[var(--c-btn-strong-text)] transition hover:brightness-110"
            >
              建立第一個帳戶
            </Link>
          </section>
        ) : (
          <>
            <AccountList rows={active} />
            {archived.length > 0 && (
              <details className="mt-6">
                <summary className="cursor-pointer select-none text-[12.5px] text-[var(--c-muted)] hover:text-[var(--c-text)]">
                  已封存（{archived.length}）
                </summary>
                <div className="mt-3 opacity-70">
                  <AccountList rows={archived} />
                </div>
              </details>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function AccountList({ rows }: { rows: AccountRow[] }) {
  return (
    <section className="overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow)]">
      {rows.map((a, i) => (
        <Link
          key={a.id}
          href={`/accounts/${a.id}`}
          className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--c-surface-soft)] ${
            i > 0 ? "border-t border-[var(--c-border)]" : ""
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-medium">{a.name}</div>
            <div className="mt-0.5 text-[11.5px] text-[var(--c-muted)]">
              {ASSET_CLASS_LABEL[a.asset_class] ?? a.asset_class}
              <span className="mx-1.5 text-[var(--c-faint)]">·</span>
              {MARKET_LABEL[a.price_market] ?? a.price_market}
              {a.symbol && (
                <>
                  <span className="mx-1.5 text-[var(--c-faint)]">·</span>
                  {a.symbol}
                </>
              )}
            </div>
          </div>
          <div className="amt shrink-0 text-right text-[14.5px] font-semibold tnum">
            NT$ {fmtTwd(valueOf(a))}
          </div>
        </Link>
      ))}
    </section>
  );
}
