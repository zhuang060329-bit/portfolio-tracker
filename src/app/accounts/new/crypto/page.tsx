import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";
import { PageHead } from "@/components/survey";
import { CryptoForm } from "./CryptoForm";

export default async function NewCryptoPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    unreadCount,
  ] = await Promise.all([supabase.auth.getUser(), getUnreadCount()]);

  return (
    <div className="min-h-dvh bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="accounts" userEmail={user?.email} unreadCount={unreadCount} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <Link
          href="/accounts/new"
          className="text-[length:var(--fs-sm)] text-[var(--c-muted)] hover:text-[var(--c-accent)]"
        >
          ← 新增帳戶
        </Link>
        <PageHead
          className="mt-4"
          label="新增帳戶 · 加密貨幣"
          title="新增加密貨幣帳戶"
          sub="以 CoinGecko id 識別幣種（不是交易所 ticker）。建立時會抓 TWD 報價驗證。"
        />

        <CryptoForm />
      </main>
    </div>
  );
}
