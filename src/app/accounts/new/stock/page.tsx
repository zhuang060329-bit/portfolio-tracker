import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getUnreadCount } from "@/lib/notifications";
import { PageHead } from "@/components/survey";
import { StockForm } from "./StockForm";

export default async function NewStockPage() {
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
          label="新增帳戶 · 股票"
          title="新增股票帳戶"
          sub="建立時即時抓一次價格驗證 symbol；失敗會提示重輸。"
        />

        <StockForm />
      </main>
    </div>
  );
}
