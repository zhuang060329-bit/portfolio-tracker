import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";
import {
  AlertsClient,
  type AlertAccount,
  type AlertItem,
} from "./AlertsClient";

type DriftAccount = {
  asset_class: string;
  price_market: string;
  quantity: number;
  last_unit_price: number | null;
  last_fx_rate: number;
  manual_value_base: number | null;
};

function valueOf(a: DriftAccount): number {
  if (a.price_market === "manual") return Number(a.manual_value_base ?? 0);
  const unit = Number(a.last_unit_price ?? 0);
  const fx = Number(a.last_fx_rate ?? 1);
  return Number(a.quantity) * unit * fx;
}

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = await getUnreadCount();

  const [
    { data: pricedAccounts },
    { data: driftAccounts },
    { data: profile },
    { data: alertRows },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,symbol,price_market,native_currency,last_unit_price")
      .eq("status", "active")
      .neq("price_market", "manual")
      .order("created_at", { ascending: true }),
    supabase
      .from("accounts")
      .select(
        "asset_class,price_market,quantity,last_unit_price,last_fx_rate,manual_value_base",
      )
      .eq("status", "active"),
    supabase.from("profiles").select("allocation_targets").single(),
    supabase
      .from("alerts")
      .select(
        "id,type,account_id,threshold,note,active,last_triggered_at,created_at,account:accounts(id,name,symbol)",
      )
      .order("active", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const accounts: AlertAccount[] = (
    (pricedAccounts ?? []) as {
      id: string;
      name: string;
      symbol: string | null;
      price_market: string;
      native_currency: string;
      last_unit_price: number | null;
    }[]
  ).map((a) => ({
    id: a.id,
    name: a.name,
    symbol: a.symbol,
    market: a.price_market,
    price: a.last_unit_price != null ? Number(a.last_unit_price) : null,
    ccy: a.native_currency,
  }));

  // 目前最大配置偏離（與 cron 同義：只看有設目標的類別，取 max|actual − target|）
  const targets =
    ((profile?.allocation_targets ?? {}) as Record<string, number>) || {};
  const driftList = (driftAccounts ?? []) as DriftAccount[];
  const total = driftList.reduce((s, a) => s + valueOf(a), 0);
  let currentDrift: number | null = null;
  if (total > 0) {
    const byClass = new Map<string, number>();
    for (const a of driftList) {
      byClass.set(a.asset_class, (byClass.get(a.asset_class) ?? 0) + valueOf(a));
    }
    let maxDrift = -1;
    for (const [cls, tgt] of Object.entries(targets)) {
      const tNum = Number(tgt);
      if (!Number.isFinite(tNum) || tNum <= 0) continue;
      const actual = ((byClass.get(cls) ?? 0) / total) * 100;
      maxDrift = Math.max(maxDrift, Math.abs(actual - tNum));
    }
    if (maxDrift >= 0) currentDrift = maxDrift;
  }

  const alerts: AlertItem[] = (
    (alertRows ?? []) as unknown as {
      id: string;
      type: AlertItem["type"];
      account_id: string | null;
      threshold: number;
      note: string | null;
      active: boolean;
      last_triggered_at: string | null;
      account: { id: string; name: string; symbol: string | null } | null;
    }[]
  ).map((a) => ({
    id: a.id,
    type: a.type,
    accountId: a.account_id,
    threshold: Number(a.threshold),
    note: a.note,
    active: a.active,
    lastTriggered: a.last_triggered_at,
    accountName: a.account?.name ?? null,
    accountSymbol: a.account?.symbol ?? null,
  }));

  const activeCount = alerts.filter((a) => a.active).length;

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="alerts" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-[900px] px-7 py-9 pb-28">
        <div className="mb-4 text-sm">
          <Link href="/" className="text-[var(--c-muted)] hover:text-[var(--c-text)]">
            ← 回總覽
          </Link>
        </div>
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-tight">
              提醒
            </h1>
            <p className="mt-1.5 text-[13.5px] text-[var(--c-muted)]">
              價格突破 / 跌破，或配置偏離目標時，在通知中心收到提醒。
            </p>
          </div>
          <div className="whitespace-nowrap text-right">
            <span className="font-serif text-3xl font-medium text-[var(--c-accent)] tnum">
              {activeCount}
            </span>
            <span className="block text-[11px] tracking-wide text-[var(--c-muted)]">
              啟用中
            </span>
          </div>
        </header>

        <div className="mt-6">
          <AlertsClient
            accounts={accounts}
            alerts={alerts}
            currentDrift={currentDrift}
          />
        </div>
      </main>
    </div>
  );
}
