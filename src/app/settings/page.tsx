import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { PageHead } from "@/components/survey";
import { isAdmin } from "@/lib/admin";
import { getUnreadCount } from "@/lib/notifications";
import { SettingsApp } from "./SettingsApp";
import { buildPriceHealth } from "@/lib/price-health";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    unreadCount,
    { data: profile },
    { data: priced },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUnreadCount(),
    supabase
      .from("profiles")
      .select("allocation_targets,concentration_limit_pct")
      .maybeSingle(),
    supabase
      .from("accounts")
      .select("name,last_priced_at")
      .neq("price_market", "manual")
      .not("symbol", "is", null)
      .eq("status", "active"),
  ]);
  const admin = isAdmin(user?.email);
  const initialTargets =
    ((profile?.allocation_targets ?? {}) as Record<string, number>) || {};

  // 報價健康計算在 lib/price-health（server component render 內不可叫 Date.now）。
  const priceHealth = buildPriceHealth(
    (priced ?? []) as { name: string; last_priced_at: string | null }[],
  );

  return (
    <div className="min-h-dvh bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader
        active="settings"
        userEmail={user?.email}
        unreadCount={unreadCount}
      />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1200px] px-4 py-8 pb-32 sm:px-6 sm:py-10 lg:px-8">
        <PageHead
          label="帳號設定"
          title="設定"
          sub={`帳號、偏好、安全與資料 · 登入身分 ${user?.email ?? "—"}`}
          className="mb-8"
        />
        <SettingsApp
          user={{
            email: user?.email ?? null,
            createdAt: user?.created_at ?? null,
          }}
          isAdmin={admin}
          initialTargets={initialTargets}
          initialConcentrationLimitPct={Number(profile?.concentration_limit_pct ?? 25)}
          priceHealth={priceHealth}
        />
      </main>
    </div>
  );
}
