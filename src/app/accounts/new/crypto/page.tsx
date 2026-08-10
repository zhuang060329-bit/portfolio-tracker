import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";
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
    <div className="min-h-screen bg-[var(--c-page)] text-[var(--c-text)]">
      <AppHeader active="accounts" userEmail={user?.email} unreadCount={unreadCount} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 text-sm">
          <Link
            href="/accounts/new"
            className="text-[var(--c-muted)] hover:text-[var(--c-text)]"
          >
            ← 回新增帳戶
          </Link>
        </div>
        <header>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            新增加密貨幣帳戶
          </h1>
          <p className="mt-2 text-sm text-[var(--c-muted)]">
            以 CoinGecko id 識別幣種（不是交易所 ticker）。建立時會抓 TWD 報價驗證。
          </p>
        </header>

        <CryptoForm />
      </main>
    </div>
  );
}
