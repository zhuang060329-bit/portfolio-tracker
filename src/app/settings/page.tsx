import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { isAdmin } from "@/lib/admin";
import { getUnreadCount } from "@/lib/notifications";
import { SettingsApp } from "./SettingsApp";
import { buildPriceHealth } from "@/lib/price-health";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = isAdmin(user?.email);
  const unreadCount = await getUnreadCount();

  const { data: profile } = await supabase
    .from("profiles")
    .select("allocation_targets")
    .maybeSingle();
  const initialTargets =
    ((profile?.allocation_targets ?? {}) as Record<string, number>) || {};

  // 報價健康計算在 lib/price-health（server component render 內不可叫 Date.now）。
  const { data: priced } = await supabase
    .from("accounts")
    .select("name,last_priced_at")
    .neq("price_market", "manual")
    .not("symbol", "is", null)
    .eq("status", "active");
  const priceHealth = buildPriceHealth(
    (priced ?? []) as { name: string; last_priced_at: string | null }[],
  );

  return (
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader
        active="settings"
        userEmail={user?.email}
        unreadCount={unreadCount}
      />
      <main className="mx-auto max-w-[1200px] px-4 pb-32 pt-8 sm:px-6 sm:pt-10">
        <header className="mb-6">
          <h1 className="font-serif text-[32px] font-medium tracking-tight">
            設定
          </h1>
          <p className="mt-1.5 text-[13.5px] text-[var(--c-muted)]">
            帳號、偏好、安全與資料 · 登入身分 {user?.email ?? "—"}
          </p>
        </header>
        <SettingsApp
          user={{
            email: user?.email ?? null,
            createdAt: user?.created_at ?? null,
          }}
          isAdmin={admin}
          initialTargets={initialTargets}
          priceHealth={priceHealth}
        />
      </main>
    </div>
  );
}
