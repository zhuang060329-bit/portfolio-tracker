import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { AlertsManager } from "./AlertsManager";
import { getUnreadCount } from "@/lib/notifications";

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = await getUnreadCount();

  const [{ data: accounts }, { data: alerts }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,symbol,price_market,last_unit_price")
      .eq("status", "active")
      .neq("price_market", "manual")
      .order("created_at", { ascending: true }),
    supabase
      .from("alerts")
      .select(
        "id,type,account_id,threshold,note,active,last_triggered_at,created_at,account:accounts(id,name,symbol)",
      )
      .order("active", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active={null} userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 text-sm">
          <Link href="/" className="text-[var(--c-muted)] hover:text-[var(--c-text)]">
            ← 回總覽
          </Link>
        </div>
        <header>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            警示
          </h1>
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            價格突破 / 跌破，或資產配置偏離目標時，在通知中心收到提醒。
          </p>
        </header>

        <div className="mt-6">
          <AlertsManager
            accounts={(accounts ?? []) as never}
            alerts={(alerts ?? []) as never}
          />
        </div>
      </main>
    </div>
  );
}
